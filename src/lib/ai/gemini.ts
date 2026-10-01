import "server-only";

import { getServerEnv } from "@/lib/env";
import {
  buildTriagePrompt,
  applyPriorityOverrides,
  parseTriageResult,
  triageJsonSchema,
  type TriageResult,
} from "@/lib/ai/triage";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import { runGeminiModelCycles } from "@/lib/ai/model-fallback";

export class GeminiSetupError extends Error {}
export class GeminiRequestError extends Error {}

type InteractionResponse = {
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

async function requestModelTriage(
  event: NormalizedGitHubEvent,
  apiKey: string,
  model: string,
) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: buildTriagePrompt(event),
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: triageJsonSchema,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
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
    return parseTriageResult(JSON.parse(output));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new GeminiRequestError("Gemini returned invalid JSON");
    }
    throw error;
  }
}

export async function generateGeminiTriage(
  event: NormalizedGitHubEvent,
): Promise<{ result: TriageResult; model: string }> {
  const { GEMINI_API_KEY } = getServerEnv();
  if (!GEMINI_API_KEY) {
    throw new GeminiSetupError("Gemini API key is not configured");
  }

  try {
    const generated = await runGeminiModelCycles((model) =>
      requestModelTriage(event, GEMINI_API_KEY, model),
    );
    return {
      ...generated,
      result: applyPriorityOverrides(event, generated.result),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini failure";
    throw new GeminiRequestError(`All Gemini model cycles failed. Last error: ${message}`);
  }
}
