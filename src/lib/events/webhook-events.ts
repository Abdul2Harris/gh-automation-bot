import "server-only";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";

type WebhookPayload = Record<string, unknown>;

type StoreWebhookEventInput = {
  deliveryId: string;
  eventType: string;
  payload: WebhookPayload;
};

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function getNestedGitHubId(payload: WebhookPayload, key: string) {
  const value = payload[key];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const id = (value as Record<string, unknown>).id;

  if (typeof id === "number" && Number.isSafeInteger(id) && id > 0) {
    return BigInt(id);
  }

  if (typeof id === "string" && /^\d+$/.test(id)) {
    return BigInt(id);
  }

  return null;
}

export async function storeWebhookEvent({
  deliveryId,
  eventType,
  payload,
}: StoreWebhookEventInput) {
  const githubInstallationId = getNestedGitHubId(payload, "installation");
  const githubRepositoryId = getNestedGitHubId(payload, "repository");

  const [installation, repository] = await Promise.all([
    githubInstallationId
      ? prisma.gitHubInstallation.findUnique({
          where: { githubInstallationId },
          select: { id: true },
        })
      : null,
    githubRepositoryId
      ? prisma.repository.findUnique({
          where: { githubRepositoryId },
          select: { id: true },
        })
      : null,
  ]);

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        deliveryId,
        eventType,
        action: typeof payload.action === "string" ? payload.action : null,
        payload: payload as Prisma.InputJsonObject,
        installationId: installation?.id,
        repositoryId: repository?.id,
      },
      select: { id: true },
    });

    return { created: true as const, eventId: event.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { created: false as const, eventId: null };
    }

    throw error;
  }
}
