import "server-only";

import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import { prisma } from "@/lib/db/prisma";
import { evaluateAutomationRules } from "@/lib/rules/evaluate-rules";

export async function findMatchingRules(
  webhookEventId: string,
  normalizedEvent: NormalizedGitHubEvent,
) {
  const storedEvent = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: { installationId: true, repositoryId: true },
  });

  if (!storedEvent?.installationId) {
    return [];
  }

  const rules = await prisma.automationRule.findMany({
    where: {
      installationId: storedEvent.installationId,
      isEnabled: true,
      OR: [
        { repositoryId: null },
        ...(storedEvent.repositoryId
          ? [{ repositoryId: storedEvent.repositoryId }]
          : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { actions: { orderBy: { position: "asc" } } },
  });

  return evaluateAutomationRules(
    normalizedEvent,
    rules,
    storedEvent.repositoryId,
  );
}
