import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyGitHubWebhookSignature } from "./webhook-signature";

const githubTestSecret = "It's a Secret to Everybody";
const githubTestPayload = "Hello, World!";
const githubTestSignature =
  "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";

describe("verifyGitHubWebhookSignature", () => {
  it("accepts GitHub's documented test signature", () => {
    assert.equal(
      verifyGitHubWebhookSignature(
        githubTestPayload,
        githubTestSignature,
        githubTestSecret,
      ),
      true,
    );
  });

  it("rejects a modified payload", () => {
    assert.equal(
      verifyGitHubWebhookSignature(
        `${githubTestPayload}!`,
        githubTestSignature,
        githubTestSecret,
      ),
      false,
    );
  });

  it("rejects malformed and legacy signatures", () => {
    assert.equal(
      verifyGitHubWebhookSignature(githubTestPayload, "sha256=invalid", githubTestSecret),
      false,
    );
    assert.equal(
      verifyGitHubWebhookSignature(
        githubTestPayload,
        "sha1=757107ea0eb2509fc211221cce984b8a37570b6d7",
        githubTestSecret,
      ),
      false,
    );
  });
});
