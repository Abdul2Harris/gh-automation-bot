import "dotenv/config";

import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AutomationActionType,
  InstallationAccountType,
  PrismaClient,
  RuleMatchField,
  RuleTrigger,
} from "../src/generated/prisma";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const appUrl = requiredEnv("APP_URL");
const connectionString = requiredEnv("DATABASE_URL");
const webhookSecret = requiredEnv("GITHUB_WEBHOOK_SECRET");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const runId = randomUUID();
const deliveryIds = {
  processed: `local-processed-test-${runId}`,
  ignored: `local-ignored-test-${runId}`,
  failed: `local-failed-test-${runId}`,
};
const githubInstallationId = 8_000_000_000_000 + Date.now();
const githubRepositoryId = githubInstallationId + 1;
const githubAccountId = githubInstallationId + 2;

const validIssuePayload = {
  action: "opened",
  installation: { id: githubInstallationId },
  repository: {
    id: githubRepositoryId,
    name: "webhook-test",
    full_name: `local/webhook-test-${runId}`,
    private: false,
    owner: { login: "local" },
  },
  sender: { id: 9_000_000_003, login: "local-tester", type: "User" },
  issue: {
    number: 1,
    title: "Local persistence test",
    body: null,
    html_url: "https://github.com/local/webhook-test/issues/1",
  },
};

async function sendWebhook(
  deliveryId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", webhookSecret)
    .update(body, "utf8")
    .digest("hex")}`;
  const response = await fetch(new URL("/api/github/webhooks", appUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-delivery": deliveryId,
      "x-github-event": eventType,
      "x-hub-signature-256": signature,
    },
    body,
  });

  return {
    status: response.status,
    data: (await response.json()) as {
      accepted?: boolean;
      duplicate?: boolean;
      processingStatus?: string;
      matchedRuleCount?: number;
      actionAttemptCount?: number;
    },
  };
}

async function main() {
  let testInstallationId: string | undefined;

  try {
    const testInstallation = await prisma.gitHubInstallation.create({
      data: {
        githubInstallationId: BigInt(githubInstallationId),
        accountId: BigInt(githubAccountId),
        accountLogin: `local-test-${runId}`,
        accountType: InstallationAccountType.USER,
      },
    });
    testInstallationId = testInstallation.id;
    const testRepository = await prisma.repository.create({
      data: {
        githubRepositoryId: BigInt(githubRepositoryId),
        installationId: testInstallation.id,
        owner: "local",
        name: "webhook-test",
        fullName: `local/webhook-test-${runId}`,
        isPrivate: false,
      },
    });
    await prisma.automationRule.create({
      data: {
        installationId: testInstallation.id,
        repositoryId: testRepository.id,
        name: "Local bug-title test",
        trigger: RuleTrigger.ISSUE_OPENED,
        matchField: RuleMatchField.TITLE,
        matchValue: "persistence",
        actions: {
          create: {
            type: AutomationActionType.SLACK_NOTIFICATION,
            config: { message: "" },
          },
        },
      },
    });

    const processed = await sendWebhook(
      deliveryIds.processed,
      "issues",
      validIssuePayload,
    );
    const duplicate = await sendWebhook(
      deliveryIds.processed,
      "issues",
      validIssuePayload,
    );
    const ignored = await sendWebhook(deliveryIds.ignored, "issues", {
      action: "closed",
    });
    const failed = await sendWebhook(deliveryIds.failed, "issues", {
      action: "opened",
    });
    const storedEvents = await prisma.webhookEvent.findMany({
      where: { deliveryId: { in: Object.values(deliveryIds) } },
      select: { deliveryId: true, status: true, errorMessage: true },
    });
    const storedByDelivery = new Map(
      storedEvents.map((event) => [event.deliveryId, event]),
    );

    assert.equal(processed.status, 202);
    assert.equal(processed.data.processingStatus, "PROCESSED");
    assert.equal(processed.data.matchedRuleCount, 1);
    assert.equal(processed.data.actionAttemptCount, 1);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.data.duplicate, true);
    assert.equal(ignored.status, 202);
    assert.equal(ignored.data.processingStatus, "IGNORED");
    assert.equal(failed.status, 202);
    assert.equal(failed.data.processingStatus, "FAILED");
    assert.equal(storedEvents.length, 3);
    assert.equal(storedByDelivery.get(deliveryIds.processed)?.status, "PROCESSED");
    assert.equal(storedByDelivery.get(deliveryIds.ignored)?.status, "IGNORED");
    assert.equal(storedByDelivery.get(deliveryIds.failed)?.status, "FAILED");
    assert.match(
      storedByDelivery.get(deliveryIds.failed)?.errorMessage ?? "",
      /^Invalid issues payload/,
    );

    console.log(
      "Webhook persistence, deduplication, statuses, and rule matching verified.",
    );
  } finally {
    await prisma.webhookEvent.deleteMany({
      where: { deliveryId: { in: Object.values(deliveryIds) } },
    });
    if (testInstallationId) {
      await prisma.gitHubInstallation.delete({
        where: { id: testInstallationId },
      });
    }
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
