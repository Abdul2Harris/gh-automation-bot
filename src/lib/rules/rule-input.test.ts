import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRuleSchema } from "./rule-input";

const baseRule = {
  installationId: "installation-1",
  repositoryId: "repository-1",
  name: "Critical bug response",
  trigger: "PULL_REQUEST_OPENED",
  matchField: "TITLE_OR_BODY",
  matchValue: "critical",
};

describe("createRuleSchema", () => {
  it("accepts one rule with GitHub and Slack actions", () => {
    const result = createRuleSchema.safeParse({
      ...baseRule,
      actions: [
        { type: "ADD_LABEL", config: { labels: ["critical", "high-priority"] } },
        { type: "COMMENT", config: { body: "The team will review this." } },
        { type: "SLACK_NOTIFICATION", config: { message: "Critical PR opened" } },
      ],
    });
    assert.equal(result.success, true);
  });

  it("rejects duplicate action types", () => {
    const result = createRuleSchema.safeParse({
      ...baseRule,
      actions: [
        { type: "COMMENT", config: { body: "First" } },
        { type: "COMMENT", config: { body: "Second" } },
      ],
    });
    assert.equal(result.success, false);
  });

  it("rejects text conditions for push rules", () => {
    const result = createRuleSchema.safeParse({
      ...baseRule,
      trigger: "PUSH",
      actions: [{ type: "SLACK_NOTIFICATION", config: {} }],
    });
    assert.equal(result.success, false);
  });

  it("accepts a trigger-only push rule", () => {
    const result = createRuleSchema.safeParse({
      ...baseRule,
      trigger: "PUSH",
      matchField: null,
      matchValue: null,
      actions: [{ type: "SLACK_NOTIFICATION", config: {} }],
    });
    assert.equal(result.success, true);
  });

  it("accepts AI-generated content for issue and pull request actions", () => {
    const result = createRuleSchema.safeParse({
      ...baseRule,
      actions: [
        { type: "COMMENT", config: { mode: "AI" } },
        { type: "SLACK_NOTIFICATION", config: { mode: "AI" } },
      ],
    });
    assert.equal(result.success, true);
  });

  it("rejects AI-generated content for push actions", () => {
    const result = createRuleSchema.safeParse({
      ...baseRule,
      trigger: "PUSH",
      matchField: null,
      matchValue: null,
      actions: [{ type: "SLACK_NOTIFICATION", config: { mode: "AI" } }],
    });
    assert.equal(result.success, false);
  });
});
