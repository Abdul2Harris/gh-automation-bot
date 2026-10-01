import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchWithTransientRetry } from "./request-retry";

describe("fetchWithTransientRetry", () => {
  it("retries transient responses with exponential backoff", async () => {
    const statuses = [503, 503, 200];
    const delays: number[] = [];
    let calls = 0;

    const response = await fetchWithTransientRetry("https://example.test", {}, {
      fetcher: async () => new Response(null, { status: statuses[calls++] }),
      sleep: async (delay) => { delays.push(delay); },
      jitter: () => 0,
    });

    assert.equal(response.status, 200);
    assert.equal(calls, 3);
    assert.deepEqual(delays, [1_000, 2_000]);
  });

  it("returns the final transient response after three retries", async () => {
    let calls = 0;
    const response = await fetchWithTransientRetry("https://example.test", {}, {
      fetcher: async () => { calls += 1; return new Response(null, { status: 503 }); },
      sleep: async () => undefined,
      jitter: () => 0,
    });

    assert.equal(response.status, 503);
    assert.equal(calls, 4);
  });

  it("does not retry permanent client errors", async () => {
    let calls = 0;
    const response = await fetchWithTransientRetry("https://example.test", {}, {
      fetcher: async () => { calls += 1; return new Response(null, { status: 400 }); },
      sleep: async () => undefined,
    });

    assert.equal(response.status, 400);
    assert.equal(calls, 1);
  });
});
