import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { processWebhookEvent } from "@/lib/events/process-webhook-event";
import { storeWebhookEvent } from "@/lib/events/webhook-events";
import { verifyGitHubWebhookSignature } from "@/lib/github/webhook-signature";

export const runtime = "nodejs";

type GitHubWebhookPayload = Record<string, unknown>;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const deliveryId = request.headers.get("x-github-delivery");
  const eventName = request.headers.get("x-github-event");
  const signature = request.headers.get("x-hub-signature-256");

  if (!deliveryId) {
    return badRequest("Missing X-GitHub-Delivery header");
  }

  if (!eventName) {
    return badRequest("Missing X-GitHub-Event header");
  }

  if (!signature) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  const webhookSecret = getServerEnv().GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("GitHub webhook secret is not configured");
    return NextResponse.json(
      { error: "Webhook endpoint is not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();

  if (
    !verifyGitHubWebhookSignature(rawBody, signature, webhookSecret)
  ) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  let payload: GitHubWebhookPayload;

  try {
    const parsedPayload: unknown = JSON.parse(rawBody);

    if (
      !parsedPayload ||
      typeof parsedPayload !== "object" ||
      Array.isArray(parsedPayload)
    ) {
      return badRequest("Webhook payload must be a JSON object");
    }

    payload = parsedPayload as GitHubWebhookPayload;
  } catch {
    return badRequest("Webhook payload is not valid JSON");
  }

  try {
    const result = await storeWebhookEvent({
      deliveryId,
      eventType: eventName,
      payload,
    });

    if (!result.created) {
      return NextResponse.json(
        {
          accepted: true,
          duplicate: true,
          deliveryId,
          event: eventName,
          eventId: null,
        },
        { status: 200 },
      );
    }

    const processing = await processWebhookEvent(
      result.eventId,
      eventName,
      payload,
    );

    return NextResponse.json(
      {
        accepted: true,
        duplicate: false,
        deliveryId,
        event: eventName,
        eventId: result.eventId,
        processingStatus: processing.status,
        matchedRuleCount: processing.matchedRules.length,
        actionAttemptCount: processing.actionAttempts.length,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error(
      "Failed to persist GitHub webhook:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Unable to persist webhook delivery" },
      { status: 500 },
    );
  }
}
