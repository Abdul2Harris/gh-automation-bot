import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";

const RECENT_ROW_LIMIT = 100;

function actionContentMode(type: string, config: unknown): "AI" | "CUSTOM" | null {
  if (type !== "COMMENT" && type !== "SLACK_NOTIFICATION") return null;
  return typeof config === "object" && config !== null && "mode" in config && config.mode === "AI"
    ? "AI"
    : "CUSTOM";
}

function actionDisplayConfig(type: string, config: unknown) {
  const value = typeof config === "object" && config !== null ? config : {};
  return {
    type,
    contentMode: actionContentMode(type, config),
    labels:
      type === "ADD_LABEL" && "labels" in value && Array.isArray(value.labels)
        ? value.labels.filter((label): label is string => typeof label === "string")
        : [],
    commentBody:
      type === "COMMENT" && "body" in value && typeof value.body === "string"
        ? value.body
        : null,
    slackMessage:
      type === "SLACK_NOTIFICATION" && "message" in value && typeof value.message === "string"
        ? value.message
        : null,
  };
}

export async function getDashboardActivity(userId: string) {
  const access = await prisma.userInstallation.findMany({
    where: { userId },
    select: {
      installationId: true,
      installation: { select: { accountLogin: true } },
    },
  });
  const installationIds = access.map(({ installationId }) => installationId);

  if (installationIds.length === 0) {
    return {
      summary: { repositories: 0, events: 0, actions: 0, failures: 0 },
      installations: [],
      repositories: [],
      events: [],
      actions: [],
      rules: [],
      aiConfigured: Boolean(getServerEnv().GEMINI_API_KEY),
    };
  }

  const installationFilter = { in: installationIds };
  const eventFilter = { installationId: installationFilter };
  const actionFilter = { event: { installationId: installationFilter } };

  const [repositories, events, actions, rules, repositoryCount, eventCount, actionCount, failureCount] =
    await Promise.all([
      prisma.repository.findMany({
        where: { installationId: installationFilter, isActive: true },
        orderBy: { fullName: "asc" },
        select: { id: true, installationId: true, fullName: true, isPrivate: true, installation: { select: { accountLogin: true } } },
      }),
      prisma.webhookEvent.findMany({
        where: eventFilter,
        orderBy: { receivedAt: "desc" },
        take: RECENT_ROW_LIMIT,
        select: {
          id: true, deliveryId: true, eventType: true, action: true, status: true,
          errorMessage: true, receivedAt: true,
          repository: { select: { fullName: true } },
          _count: { select: { actionAttempts: true } },
          triage: { select: { status: true, priority: true, summary: true, suggestedLabels: true, errorMessage: true, model: true } },
        },
      }),
      prisma.actionAttempt.findMany({
        where: actionFilter,
        orderBy: { attemptedAt: "desc" },
        take: RECENT_ROW_LIMIT,
        select: {
          id: true, type: true, status: true, target: true, errorMessage: true,
          isRetryable: true, retryCount: true, lastRetriedAt: true,
          attemptedAt: true, completedAt: true,
          event: { select: { deliveryId: true, repository: { select: { fullName: true } } } },
          ruleAction: { select: { rule: { select: { name: true } } } },
        },
      }),
      prisma.automationRule.findMany({
        where: { installationId: installationFilter },
        orderBy: { createdAt: "desc" },
        take: RECENT_ROW_LIMIT,
        select: {
          id: true, installationId: true, repositoryId: true, name: true, isEnabled: true, trigger: true, matchField: true,
          matchValue: true, createdAt: true,
          actions: { orderBy: { position: "asc" }, select: { type: true, config: true } },
          repository: { select: { fullName: true } },
          installation: { select: { accountLogin: true } },
        },
      }),
      prisma.repository.count({ where: { installationId: installationFilter, isActive: true } }),
      prisma.webhookEvent.count({ where: eventFilter }),
      prisma.actionAttempt.count({ where: actionFilter }),
      prisma.actionAttempt.count({ where: { ...actionFilter, status: "FAILED" } }),
    ]);

  return {
    summary: { repositories: repositoryCount, events: eventCount, actions: actionCount, failures: failureCount },
    installations: access.map((item) => ({
      id: item.installationId,
      accountLogin: item.installation.accountLogin,
    })),
    repositories: repositories.map((repository) => ({
      id: repository.id,
      installationId: repository.installationId,
      fullName: repository.fullName,
      accountLogin: repository.installation.accountLogin,
      isPrivate: repository.isPrivate,
    })),
    events: events.map((event) => ({
      id: event.id,
      deliveryId: event.deliveryId,
      eventType: event.eventType,
      action: event.action,
      status: event.status,
      errorMessage: event.errorMessage,
      receivedAt: event.receivedAt.toISOString(),
      repository: event.repository?.fullName ?? "Unknown repository",
      actionCount: event._count.actionAttempts,
      triage: event.triage,
    })),
    actions: actions.map((action) => ({
      id: action.id,
      type: action.type,
      status: action.status,
      target: action.target,
      errorMessage: action.errorMessage,
      attemptedAt: action.attemptedAt.toISOString(),
      completedAt: action.completedAt?.toISOString() ?? null,
      isRetryable: action.isRetryable && Boolean(action.ruleAction),
      retryCount: action.retryCount,
      lastRetriedAt: action.lastRetriedAt?.toISOString() ?? null,
      deliveryId: action.event.deliveryId,
      repository: action.event.repository?.fullName ?? "Unknown repository",
      ruleName: action.ruleAction?.rule.name ?? "Deleted rule",
    })),
    rules: rules.map((rule) => ({
      id: rule.id,
      installationId: rule.installationId,
      repositoryId: rule.repositoryId,
      name: rule.name,
      isEnabled: rule.isEnabled,
      trigger: rule.trigger,
      matchField: rule.matchField,
      matchValue: rule.matchValue,
      actionTypes: rule.actions.map((action) => action.type),
      actionDetails: rule.actions.map((action) => actionDisplayConfig(action.type, action.config)),
      createdAt: rule.createdAt.toISOString(),
      scope: rule.repository?.fullName ?? `${rule.installation.accountLogin} (all repositories)`,
    })),
    aiConfigured: Boolean(getServerEnv().GEMINI_API_KEY),
  };
}

export type DashboardActivity = Awaited<ReturnType<typeof getDashboardActivity>>;
