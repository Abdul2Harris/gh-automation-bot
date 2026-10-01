import { z } from "zod";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";

const slackActionConfigSchema = z.object({
  message: z.string().trim().min(1).max(500).optional(),
});

export type SlackActionClient = {
  send(text: string): Promise<{ status: number }>;
};

export class SlackActionConfigError extends Error {}

function escapeSlackText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function eventSummary(event: NormalizedGitHubEvent) {
  const repository = escapeSlackText(event.repository.fullName);
  const sender = escapeSlackText(event.sender.login);

  if (event.kind === "issue.opened") {
    return `Issue #${event.issue.number} opened in ${repository} by ${sender}: ${escapeSlackText(event.issue.title)}\n${event.issue.url}`;
  }

  if (event.kind === "pull_request.opened") {
    return `Pull request #${event.pullRequest.number} opened in ${repository} by ${sender}: ${escapeSlackText(event.pullRequest.title)}\n${event.pullRequest.url}`;
  }

  return `Push to ${repository}/${escapeSlackText(event.push.branch)} by ${sender} (${event.push.commitCount} commit${event.push.commitCount === 1 ? "" : "s"})`;
}

export function buildSlackMessage(
  actionConfig: unknown,
  event: NormalizedGitHubEvent,
) {
  const parsed = slackActionConfigSchema.safeParse(actionConfig);

  if (!parsed.success) {
    throw new SlackActionConfigError(
      "Invalid SLACK_NOTIFICATION action configuration",
    );
  }

  const prefix = parsed.data.message
    ? `${escapeSlackText(parsed.data.message)}\n`
    : "";

  return `${prefix}${eventSummary(event)}`;
}

export async function executeSlackRuleAction(
  actionConfig: unknown,
  event: NormalizedGitHubEvent,
  client: SlackActionClient,
) {
  const text = buildSlackMessage(actionConfig, event);
  const response = await client.send(text);

  return {
    target: "Slack incoming webhook",
    requestPayload: { text },
    responsePayload: { status: response.status, result: "ok" },
  };
}
