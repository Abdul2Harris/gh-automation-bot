import "server-only";

import { getServerEnv } from "@/lib/env";
import {
  buildTriagePrompt,
  parseTriageResult,
  triageJsonSchema,
  type TriageResult,
} from "@/lib/ai/triage";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import { fetchWithTransientRetry } from "@/lib/ai/request-retry";

export class GeminiSetupError extends Error {}
export class GeminiRequestError extends Error {}

type InteractionResponse = {
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export async function generateGeminiTriage(
  event: NormalizedGitHubEvent,
): Promise<{ result: TriageResult; model: string }> {
  const { GEMINI_API_KEY, GEMINI_MODEL } = getServerEnv();
  if (!GEMINI_API_KEY) {
    throw new GeminiSetupError("Gemini API key is not configured");
  }

  const response = await fetchWithTransientRetry(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        store: false,
        input: buildTriagePrompt(event),
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: triageJsonSchema,
        },
      }),
    },
    { timeoutMs: 15_000 },
  );

  if (!response.ok) {
    throw new GeminiRequestError(`Gemini request failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as InteractionResponse;
  const output = data.steps
    ?.find((step) => step.type === "model_output")
    ?.content?.find((content) => content.type === "text")
    ?.text;

  if (!output) {
    throw new GeminiRequestError(
      data.status && data.status !== "completed"
        ? `Gemini interaction ended with status ${data.status}`
        : "Gemini response did not contain structured output",
    );
  }

  try {
    return { result: parseTriageResult(JSON.parse(output)), model: GEMINI_MODEL };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new GeminiRequestError("Gemini returned invalid JSON");
    }
    throw error;
  }
}
