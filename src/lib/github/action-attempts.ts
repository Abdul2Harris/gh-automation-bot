import "server-only";

import {
  ActionAttemptStatus,
  AutomationActionType,
  Prisma,
} from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import { getInstallationOctokit } from "@/lib/github/app";
import {
  executeGitHubRuleAction,
  GitHubActionConfigError,
  GitHubActionNotApplicableError,
  type GitHubActionClient,
} from "@/lib/github/github-action";

type MatchedRule = {
  id: string;
  actions: Array<{
    id: string;
    type: AutomationActionType;
    config: Prisma.JsonValue;
  }>;
};

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Unknown GitHub action failure";
}

function actionClient(installationId: number): GitHubActionClient {
  const octokitPromise = getInstallationOctokit(installationId);

  return {
    async addLabels(input) {
      const octokit = await octokitPromise;
      const response = await octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
        {
          owner: input.owner,
          repo: input.repo,
          issue_number: input.issueNumber,
          labels: input.labels,
        },
      );

      return {
        status: response.status,
        labels: response.data.map((label) => label.name),
      };
    },
    async createComment(input) {
      const octokit = await octokitPromise;
      const response = await octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: input.owner,
          repo: input.repo,
          issue_number: input.issueNumber,
          body: input.body,
        },
      );

      return {
        status: response.status,
        commentId: response.data.id,
        url: response.data.html_url,
      };
    },
  };
}

export async function executeGitHubAction(
  action: { type: AutomationActionType; config: Prisma.JsonValue },
  event: NormalizedGitHubEvent,
) {
  return executeGitHubRuleAction(
    { actionType: action.type, actionConfig: action.config },
    event,
    actionClient(event.installationId),
  );
}

export async function executeMatchedGitHubActions(
  eventId: string,
  event: NormalizedGitHubEvent,
  rules: MatchedRule[],
) {
  const githubActions = rules.flatMap((rule) =>
    rule.actions
      .filter(
        (action) =>
          action.type === AutomationActionType.ADD_LABEL ||
          action.type === AutomationActionType.COMMENT,
      )
      .map((action) => ({ ruleId: rule.id, action })),
  );

  if (githubActions.length === 0) {
    return [];
  }

  const client = actionClient(event.installationId);
  const results = [];

  for (const { ruleId, action } of githubActions) {
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
      const execution = await executeGitHubRuleAction(
        { actionType: action.type, actionConfig: action.config }, event, client,
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
      const status =
        error instanceof GitHubActionNotApplicableError
          ? ActionAttemptStatus.SKIPPED
          : ActionAttemptStatus.FAILED;

      await prisma.actionAttempt.update({
        where: { id: attempt.id },
        data: {
          status,
          errorMessage: safeErrorMessage(error),
          isRetryable:
            !(error instanceof GitHubActionConfigError) &&
            !(error instanceof GitHubActionNotApplicableError),
          completedAt: new Date(),
        },
      });
      results.push({ ruleId, ruleActionId: action.id, status });
    }
  }

  return results;
}
