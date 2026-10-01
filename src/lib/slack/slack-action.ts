import { z } from "zod";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import type { StoredTriage } from "@/lib/ai/event-triage";

const slackActionConfigSchema = z.union([
  z.object({ mode: z.literal("AI") }),
  z.object({ mode: z.literal("CUSTOM"), message: z.string().trim().min(1).max(500).optional() }),
  z.object({ message: z.string().trim().min(1).max(500).optional() }),
]);

export type SlackActionClient = {
  send(text: string): Promise<{ status: number }>;
};

export class SlackActionConfigError extends Error {}
export class SlackAIContentUnavailableError extends Error {}

export function usesAiSlackContent(config: unknown) {
  return typeof config === "object" && config !== null && "mode" in config && config.mode === "AI";
}

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
  triage?: StoredTriage,
) {
  const parsed = slackActionConfigSchema.safeParse(actionConfig);

  if (!parsed.success) {
    throw new SlackActionConfigError(
      "Invalid SLACK_NOTIFICATION action configuration",
    );
  }

  if ("mode" in parsed.data && parsed.data.mode === "AI") {
    if (!triage?.slackMessage) {
      throw new SlackAIContentUnavailableError("AI-generated Slack message is unavailable");
    }
    return `${escapeSlackText(triage.slackMessage)}\n${eventSummary(event)}`;
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
  triage?: StoredTriage,
) {
  const text = buildSlackMessage(actionConfig, event, triage);
  const response = await client.send(text);

  return {
    target: "Slack incoming webhook",
    requestPayload: { text },
    responsePayload: { status: response.status, result: "ok" },
  };
}
