import "server-only";

import { ActionAttemptStatus, AutomationActionType, Prisma } from "@/generated/prisma";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { normalizeGitHubEvent } from "@/lib/events/normalize-github-event";
import { executeGitHubAction } from "@/lib/github/action-attempts";
import { GitHubActionConfigError, GitHubActionNotApplicableError } from "@/lib/github/github-action";
import { executeSlackAction, SlackSetupError } from "@/lib/slack/action-attempts";
import { SlackActionConfigError } from "@/lib/slack/slack-action";
import { resolveEventTriage } from "@/lib/ai/event-triage";
import { usesAiGitHubContent } from "@/lib/github/github-action";
import { usesAiSlackContent } from "@/lib/slack/slack-action";

export const MAX_MANUAL_RETRIES = 5;

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1000) : "Unknown retry failure";
}

function canRetryError(error: unknown) {
  return !(
    error instanceof GitHubActionConfigError ||
    error instanceof GitHubActionNotApplicableError ||
    error instanceof SlackActionConfigError ||
    error instanceof SlackSetupError
  );
}

export async function retryActionAttempt(userId: string, attemptId: string) {
  const attempt = await prisma.actionAttempt.findFirst({
    where: {
      id: attemptId,
      event: { installation: { users: { some: { userId } } } },
    },
    select: {
      id: true,
      status: true,
      isRetryable: true,
      retryCount: true,
      type: true,
      event: { select: { id: true, eventType: true, payload: true } },
      ruleAction: { select: { type: true, config: true } },
    },
  });

  if (!attempt) throw new ApiError(404, "Action attempt not found");
  if (!attempt.ruleAction) throw new ApiError(409, "The original rule action no longer exists");
  if (attempt.status !== ActionAttemptStatus.FAILED || !attempt.isRetryable) {
    throw new ApiError(409, "This action cannot be retried");
  }
  if (attempt.retryCount >= MAX_MANUAL_RETRIES) {
    throw new ApiError(409, "Retry limit reached");
  }

  const claimed = await prisma.actionAttempt.updateMany({
    where: {
      id: attempt.id,
      status: ActionAttemptStatus.FAILED,
      isRetryable: true,
      retryCount: { lt: MAX_MANUAL_RETRIES },
    },
    data: {
      status: ActionAttemptStatus.PENDING,
      retryCount: { increment: 1 },
      lastRetriedAt: new Date(),
      completedAt: null,
      errorMessage: null,
    },
  });
  if (claimed.count !== 1) throw new ApiError(409, "This action is already being retried");

  try {
    const payload = attempt.event.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new GitHubActionConfigError("Stored webhook payload is invalid");
    }
    const normalized = normalizeGitHubEvent(
      attempt.event.eventType,
      payload as Record<string, unknown>,
    );
    if (normalized.outcome !== "normalized") {
      throw new GitHubActionConfigError("Stored webhook event can no longer be processed");
    }

    const needsTriage =
      usesAiGitHubContent(attempt.ruleAction.type, attempt.ruleAction.config) ||
      (attempt.ruleAction.type === AutomationActionType.SLACK_NOTIFICATION &&
        usesAiSlackContent(attempt.ruleAction.config));
    const triage = needsTriage
      ? await resolveEventTriage(attempt.event.id, normalized.event, true)
      : undefined;

    const execution =
      attempt.type === AutomationActionType.SLACK_NOTIFICATION
        ? await executeSlackAction(attempt.ruleAction, normalized.event, triage)
        : await executeGitHubAction(attempt.ruleAction, normalized.event, triage);

    await prisma.actionAttempt.update({
      where: { id: attempt.id },
      data: {
        status: ActionAttemptStatus.SUCCEEDED,
        isRetryable: false,
        target: execution.target,
        requestPayload: execution.requestPayload as Prisma.InputJsonObject,
        responsePayload: execution.responsePayload as Prisma.InputJsonObject,
        completedAt: new Date(),
      },
    });
    return ActionAttemptStatus.SUCCEEDED;
  } catch (error) {
    const retryCount = attempt.retryCount + 1;
    const limitReached = retryCount >= MAX_MANUAL_RETRIES;
    const message = limitReached
      ? `Retry limit reached after ${MAX_MANUAL_RETRIES} attempts. Check permissions or configuration.`
      : safeMessage(error);

    await prisma.actionAttempt.update({
      where: { id: attempt.id },
      data: {
        status: ActionAttemptStatus.FAILED,
        isRetryable: canRetryError(error) && !limitReached,
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    return ActionAttemptStatus.FAILED;
  }
}
