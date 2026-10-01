import "server-only";

import { WebhookProcessingStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeGitHubEvent,
  WebhookNormalizationError,
} from "@/lib/events/normalize-github-event";
import { executeMatchedGitHubActions } from "@/lib/github/action-attempts";
import { findMatchingRules } from "@/lib/rules/rule-engine";
import { executeMatchedSlackActions } from "@/lib/slack/action-attempts";
import { resolveEventTriage, type StoredTriage } from "@/lib/ai/event-triage";
import { usesAiGitHubContent } from "@/lib/github/github-action";
import { usesAiSlackContent } from "@/lib/slack/slack-action";

export async function processWebhookEvent(
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      status: WebhookProcessingStatus.PROCESSING,
      errorMessage: null,
    },
  });

  try {
    const result = normalizeGitHubEvent(eventType, payload);
    const matchedRules =
      result.outcome === "normalized"
        ? await findMatchingRules(eventId, result.event)
        : [];
    const actionAttempts = [];
    let triage: StoredTriage | undefined;

    if (result.outcome === "normalized") {
      const needsTriage = matchedRules.some((rule) =>
        rule.actions.some((action) =>
          usesAiGitHubContent(action.type, action.config) ||
          (action.type === "SLACK_NOTIFICATION" && usesAiSlackContent(action.config)),
        ),
      );
      if (needsTriage) {
        try {
          triage = await resolveEventTriage(eventId, result.event);
        } catch {
          // The persisted triage error is surfaced in the dashboard; custom actions still run.
        }
      }
      actionAttempts.push(
        ...(await executeMatchedGitHubActions(
          eventId,
          result.event,
          matchedRules,
          triage,
        )),
        ...(await executeMatchedSlackActions(
          eventId,
          result.event,
          matchedRules,
          triage,
        )),
      );
    }
    const status =
      result.outcome === "normalized"
        ? WebhookProcessingStatus.PROCESSED
        : WebhookProcessingStatus.IGNORED;

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status, processedAt: new Date() },
    });

    return {
      status,
      normalizedEvent:
        result.outcome === "normalized" ? result.event : null,
      ignoredReason: result.outcome === "ignored" ? result.reason : null,
      matchedRules,
      actionAttempts,
    };
  } catch (error) {
    const message =
      error instanceof WebhookNormalizationError
        ? error.message
        : "Unexpected webhook processing failure";

    if (!(error instanceof WebhookNormalizationError)) {
      console.error(
        "Unexpected webhook processing failure:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookProcessingStatus.FAILED,
        errorMessage: message.slice(0, 1000),
        processedAt: new Date(),
      },
    });

    return {
      status: WebhookProcessingStatus.FAILED,
      normalizedEvent: null,
      ignoredReason: null,
      matchedRules: [],
      actionAttempts: [],
    };
  }
}
