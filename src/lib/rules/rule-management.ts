import "server-only";

import { Prisma } from "@/generated/prisma";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import type { CreateRuleInput } from "@/lib/rules/rule-input";

async function verifyInstallationAccess(userId: string, installationId: string) {
  const access = await prisma.userInstallation.findUnique({
    where: { userId_installationId: { userId, installationId } },
  });

  if (!access) throw new ApiError(403, "Installation access denied");
}

async function verifyRuleAccess(userId: string, ruleId: string) {
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, installation: { users: { some: { userId } } } },
    select: { id: true },
  });

  if (!rule) throw new ApiError(404, "Rule not found");
}

export async function createRule(userId: string, input: CreateRuleInput) {
  await verifyInstallationAccess(userId, input.installationId);

  if (input.repositoryId) {
    const repository = await prisma.repository.findFirst({
      where: { id: input.repositoryId, installationId: input.installationId, isActive: true },
      select: { id: true },
    });
    if (!repository) throw new ApiError(400, "Repository does not belong to this installation");
  }

  if (
    input.actions.some((action) => action.type === "SLACK_NOTIFICATION") &&
    !getServerEnv().SLACK_WEBHOOK_URL
  ) {
    throw new ApiError(400, "Slack webhook URL is not configured");
  }

  return prisma.automationRule.create({
    data: {
      installationId: input.installationId,
      repositoryId: input.repositoryId,
      createdById: userId,
      name: input.name,
      trigger: input.trigger,
      matchField: input.trigger === "PUSH" ? null : input.matchField,
      matchValue: input.trigger === "PUSH" ? null : input.matchValue,
      actions: {
        create: input.actions.map((action, position) => ({
          type: action.type,
          config: action.config as Prisma.InputJsonObject,
          position,
        })),
      },
    },
    select: { id: true },
  });
}

export async function setRuleEnabled(userId: string, ruleId: string, isEnabled: boolean) {
  await verifyRuleAccess(userId, ruleId);
  await prisma.automationRule.update({ where: { id: ruleId }, data: { isEnabled } });
}

export async function deleteRule(userId: string, ruleId: string) {
  await verifyRuleAccess(userId, ruleId);
  await prisma.automationRule.delete({ where: { id: ruleId } });
}
