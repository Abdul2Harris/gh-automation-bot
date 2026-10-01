export function getGeminiModelCandidates() {
  return ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash"];
}

const CYCLE_DELAYS_MS = [1_000, 2_000, 4_000];

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function runGeminiModelCycles<T>(
  request: (model: string) => Promise<T>,
  options: {
    sleep?: (milliseconds: number) => Promise<void>;
    jitter?: () => number;
  } = {},
) {
  const sleep = options.sleep ?? wait;
  const jitter = options.jitter ?? Math.random;
  let lastError: unknown;

  for (let cycle = 0; cycle <= CYCLE_DELAYS_MS.length; cycle += 1) {
    for (const model of getGeminiModelCandidates()) {
      try {
        return { result: await request(model), model };
      } catch (error) {
        lastError = error;
      }
    }

    if (cycle < CYCLE_DELAYS_MS.length) {
      await sleep(CYCLE_DELAYS_MS[cycle] + Math.floor(jitter() * 250));
    }
  }

  throw lastError ?? new Error("All Gemini model cycles failed");
}
