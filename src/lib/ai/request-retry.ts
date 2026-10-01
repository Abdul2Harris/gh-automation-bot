const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

export type RetryFetch = (input: string, init: RequestInit) => Promise<Response>;

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchWithTransientRetry(
  input: string,
  init: RequestInit,
  options: {
    fetcher?: RetryFetch;
    sleep?: (milliseconds: number) => Promise<void>;
    jitter?: () => number;
    timeoutMs?: number;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? wait;
  const jitter = options.jitter ?? Math.random;
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetcher(input, {
        ...init,
        signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : init.signal,
      });
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === RETRY_DELAYS_MS.length) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_DELAYS_MS.length) throw error;
    }

    const delay = RETRY_DELAYS_MS[attempt] + Math.floor(jitter() * 250);
    await sleep(delay);
  }

  throw lastError ?? new Error("Gemini request failed after retries");
}
