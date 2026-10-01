import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGeminiModelCandidates, runGeminiModelCycles } from "./model-fallback";

describe("getGeminiModelCandidates", () => {
  it("uses 3.8, then 3.5, then 2.5", () => {
    assert.deepEqual(getGeminiModelCandidates(), [
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
    ]);
  });

  it("tries every model once before retrying the complete cycle", async () => {
    const calls: string[] = [];
    const delays: number[] = [];

    await assert.rejects(
      runGeminiModelCycles(
        async (model) => {
          calls.push(model);
          throw new Error("unavailable");
        },
        {
          sleep: async (delay) => { delays.push(delay); },
          jitter: () => 0,
        },
      ),
      /unavailable/,
    );

    assert.equal(calls.length, 12);
    assert.deepEqual(calls.slice(0, 6), [
      "gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash",
      "gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash",
    ]);
    assert.deepEqual(delays, [1_000, 2_000, 4_000]);
  });

  it("returns immediately when a fallback model succeeds", async () => {
    const calls: string[] = [];
    const output = await runGeminiModelCycles(async (model) => {
      calls.push(model);
      if (model === "gemini-3.5-flash") return "ok";
      throw new Error("unavailable");
    });

    assert.deepEqual(output, { result: "ok", model: "gemini-3.5-flash" });
    assert.deepEqual(calls, ["gemini-3.8-flash", "gemini-3.5-flash"]);
  });
});
