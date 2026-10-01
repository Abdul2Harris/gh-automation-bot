import "server-only";

import { TriageStatus } from "@/generated/prisma";
import { generateGeminiTriage } from "@/lib/ai/gemini";
import type { TriageResult } from "@/lib/ai/triage";
import { prisma } from "@/lib/db/prisma";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";

export type StoredTriage = TriageResult & { model: string };

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1000) : "Unknown AI triage failure";
}

export async function resolveEventTriage(
  eventId: string,
  event: NormalizedGitHubEvent,
  forceRetry = false,
): Promise<StoredTriage> {
  const existing = await prisma.eventTriage.findUnique({ where: { eventId } });
  if (
    existing?.status === TriageStatus.SUCCEEDED &&
    existing.summary && existing.priority && existing.githubComment && existing.slackMessage && existing.model
  ) {
    return {
      summary: existing.summary,
      priority: existing.priority,
      suggestedLabels: existing.suggestedLabels,
      githubComment: existing.githubComment,
      slackMessage: existing.slackMessage,
      model: existing.model,
    };
  }
  if (existing?.status === TriageStatus.FAILED && !forceRetry) {
    throw new Error(existing.errorMessage ?? "AI triage failed");
  }

  await prisma.eventTriage.upsert({
    where: { eventId },
    create: { eventId, status: TriageStatus.PENDING },
    update: { status: TriageStatus.PENDING, errorMessage: null, completedAt: null },
  });

  try {
    const { result, model } = await generateGeminiTriage(event);
    await prisma.eventTriage.update({
      where: { eventId },
      data: { ...result, model, status: TriageStatus.SUCCEEDED, completedAt: new Date() },
    });
    return { ...result, model };
  } catch (error) {
    await prisma.eventTriage.update({
      where: { eventId },
      data: { status: TriageStatus.FAILED, errorMessage: safeMessage(error), completedAt: new Date() },
    });
    throw error;
  }
}
