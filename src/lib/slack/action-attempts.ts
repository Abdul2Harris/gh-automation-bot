import "server-only";

import {
  ActionAttemptStatus,
  AutomationActionType,
  Prisma,
} from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import type { StoredTriage } from "@/lib/ai/event-triage";
import {
  executeSlackRuleAction,
  SlackActionConfigError,
  type SlackActionClient,
} from "@/lib/slack/slack-action";

type MatchedRule = {
  id: string;
  actions: Array<{
    id: string;
    type: AutomationActionType;
    config: Prisma.JsonValue;
  }>;
};

export class SlackSetupError extends Error {}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 1000)
    : "Unknown Slack action failure";
}

function slackClient(): SlackActionClient {
  return {
    async send(text) {
      const webhookUrl = getServerEnv().SLACK_WEBHOOK_URL;

      if (!webhookUrl) {
        throw new SlackSetupError("Slack webhook URL is not configured");
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const slackError = (await response.text()).trim().slice(0, 100);
        throw new Error(
          `Slack webhook failed with HTTP ${response.status}${slackError ? `: ${slackError}` : ""}`,
        );
      }

      return { status: response.status };
    },
  };
}

export async function executeSlackAction(
  action: { config: Prisma.JsonValue },
  event: NormalizedGitHubEvent,
  triage?: StoredTriage,
) {
  return executeSlackRuleAction(action.config, event, slackClient(), triage);
}

export async function executeMatchedSlackActions(
  eventId: string,
  event: NormalizedGitHubEvent,
  rules: MatchedRule[],
  triage?: StoredTriage,
) {
  const slackActions = rules.flatMap((rule) =>
    rule.actions
      .filter((action) => action.type === AutomationActionType.SLACK_NOTIFICATION)
      .map((action) => ({ ruleId: rule.id, action })),
  );

  if (slackActions.length === 0) {
    return [];
  }

  const client = slackClient();
  const results = [];

  for (const { ruleId, action } of slackActions) {
    let attempt: { id: string };

    try {
      attempt = await prisma.actionAttempt.create({
        data: {
          eventId,
          ruleActionId: action.id,
          type: action.type,
          status: ActionAttemptStatus.PENDING,
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        results.push({ ruleId, ruleActionId: action.id, duplicate: true });
        continue;
      }

      throw error;
    }

    try {
      const execution = await executeSlackRuleAction(
        action.config,
        event,
        client,
        triage,
      );
      await prisma.actionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: ActionAttemptStatus.SUCCEEDED,
          target: execution.target,
          requestPayload: execution.requestPayload as Prisma.InputJsonObject,
          responsePayload: execution.responsePayload as Prisma.InputJsonObject,
          completedAt: new Date(),
        },
      });
      results.push({ ruleId, ruleActionId: action.id, status: ActionAttemptStatus.SUCCEEDED });
    } catch (error) {
      await prisma.actionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: ActionAttemptStatus.FAILED,
          errorMessage: safeErrorMessage(error),
          isRetryable:
            !(error instanceof SlackActionConfigError) &&
            !(error instanceof SlackSetupError),
          completedAt: new Date(),
        },
      });
      results.push({ ruleId, ruleActionId: action.id, status: ActionAttemptStatus.FAILED });
    }
  }

  return results;
}
