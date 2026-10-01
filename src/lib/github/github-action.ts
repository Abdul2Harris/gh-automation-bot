import { z } from "zod";
import { AutomationActionType } from "@/generated/prisma";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";

const addLabelConfigSchema = z.object({
  labels: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
});

const commentConfigSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

export type GitHubActionClient = {
  addLabels(input: {
    owner: string;
    repo: string;
    issueNumber: number;
    labels: string[];
  }): Promise<{ status: number; labels: string[] }>;
  createComment(input: {
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<{ status: number; commentId: number; url: string }>;
};

export type GitHubActionRule = {
  actionType: AutomationActionType;
  actionConfig: unknown;
};

export type GitHubActionExecution = {
  target: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
};

export class GitHubActionConfigError extends Error {}
export class GitHubActionNotApplicableError extends Error {}

function issueTarget(event: NormalizedGitHubEvent) {
  if (event.kind === "push") {
    throw new GitHubActionNotApplicableError(
      "GitHub label and comment actions do not apply to push events",
    );
  }

  return {
    owner: event.repository.owner,
    repo: event.repository.name,
    issueNumber:
      event.kind === "issue.opened"
        ? event.issue.number
        : event.pullRequest.number,
  };
}

function parseConfig<T>(schema: z.ZodType<T>, config: unknown, type: string) {
  const result = schema.safeParse(config);

  if (!result.success) {
    throw new GitHubActionConfigError(`Invalid ${type} action configuration`);
  }

  return result.data;
}

export async function executeGitHubRuleAction(
  rule: GitHubActionRule,
  event: NormalizedGitHubEvent,
  client: GitHubActionClient,
): Promise<GitHubActionExecution> {
  const target = issueTarget(event);
  const targetName = `${target.owner}/${target.repo}#${target.issueNumber}`;

  if (rule.actionType === AutomationActionType.ADD_LABEL) {
    const config = parseConfig(
      addLabelConfigSchema,
      rule.actionConfig,
      "ADD_LABEL",
    );
    const response = await client.addLabels({ ...target, labels: config.labels });

    return {
      target: targetName,
      requestPayload: { labels: config.labels },
      responsePayload: {
        status: response.status,
        labels: response.labels,
      },
    };
  }

  if (rule.actionType === AutomationActionType.COMMENT) {
    const config = parseConfig(
      commentConfigSchema,
      rule.actionConfig,
      "COMMENT",
    );
    const response = await client.createComment({ ...target, body: config.body });

    return {
      target: targetName,
      requestPayload: { body: config.body },
      responsePayload: {
        status: response.status,
        commentId: response.commentId,
        url: response.url,
      },
    };
  }

  throw new GitHubActionNotApplicableError(
    `Action ${rule.actionType} is not a GitHub label or comment action`,
  );
}
