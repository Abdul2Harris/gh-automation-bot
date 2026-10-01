import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeGitHubEvent,
  WebhookNormalizationError,
} from "./normalize-github-event";

const common = {
  installation: { id: 101 },
  repository: {
    id: 202,
    name: "automation-bot",
    full_name: "abdul/automation-bot",
    private: false,
    owner: { login: "abdul" },
  },
  sender: { id: 303, login: "abdul", type: "User" },
};

describe("normalizeGitHubEvent", () => {
  it("normalizes an opened issue", () => {
    const result = normalizeGitHubEvent("issues", {
      ...common,
      action: "opened",
      issue: {
        number: 12,
        title: "Bug in webhook processing",
        body: "Steps to reproduce",
        html_url: "https://github.com/abdul/automation-bot/issues/12",
      },
    });

    assert.equal(result.outcome, "normalized");
    assert.equal(
      result.outcome === "normalized" ? result.event.kind : null,
      "issue.opened",
    );
  });

  it("normalizes an opened pull request", () => {
    const result = normalizeGitHubEvent("pull_request", {
      ...common,
      action: "opened",
      pull_request: {
        number: 8,
        title: "Add webhook support",
        body: null,
        html_url: "https://github.com/abdul/automation-bot/pull/8",
        draft: false,
      },
    });

    assert.equal(result.outcome, "normalized");
    assert.equal(
      result.outcome === "normalized" ? result.event.kind : null,
      "pull_request.opened",
    );
  });

  it("normalizes a push", () => {
    const result = normalizeGitHubEvent("push", {
      ...common,
      ref: "refs/heads/main",
      before: "1111111",
      after: "2222222",
      created: false,
      deleted: false,
      forced: false,
      commits: [
        {
          id: "2222222",
          message: "Add webhook support",
          url: "https://github.com/abdul/automation-bot/commit/2222222",
        },
      ],
      head_commit: {
        id: "2222222",
        message: "Add webhook support",
        url: "https://github.com/abdul/automation-bot/commit/2222222",
      },
    });

    assert.equal(result.outcome, "normalized");
    assert.equal(
      result.outcome === "normalized" && result.event.kind === "push"
        ? result.event.push.branch
        : null,
      "main",
    );
  });

  it("ignores unsupported actions", () => {
    const result = normalizeGitHubEvent("issues", { action: "closed" });
    assert.equal(result.outcome, "ignored");
  });

  it("ignores bot-generated events", () => {
    const result = normalizeGitHubEvent("issues", {
      ...common,
      sender: { id: 404, login: "automation-bot[bot]", type: "Bot" },
      action: "opened",
      issue: {
        number: 12,
        title: "Automated issue",
        body: null,
        html_url: "https://github.com/abdul/automation-bot/issues/12",
      },
    });

    assert.equal(result.outcome, "ignored");
  });

  it("rejects malformed supported payloads", () => {
    assert.throws(
      () => normalizeGitHubEvent("issues", { action: "opened" }),
      WebhookNormalizationError,
    );
  });
});
