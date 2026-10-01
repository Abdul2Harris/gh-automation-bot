import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGeminiModelCandidates } from "./model-fallback";

describe("getGeminiModelCandidates", () => {
  it("uses 3.8, then 3.5, then 2.5", () => {
    assert.deepEqual(getGeminiModelCandidates(), [
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
    ]);
  });
});
