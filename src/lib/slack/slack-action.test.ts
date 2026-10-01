import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import {
  buildSlackMessage,
  executeSlackRuleAction,
  SlackActionConfigError,
  type SlackActionClient,
} from "./slack-action";

const commonEvent = {
  installationId: 123,
  repository: {
    id: 456,
    owner: "octocat",
    name: "hello-world",
    fullName: "octocat/hello-world",
    isPrivate: false,
  },
  sender: { id: 789, login: "developer", type: "User" },
};

const issueEvent: NormalizedGitHubEvent = {
  ...commonEvent,
  kind: "issue.opened",
  issue: {
    number: 12,
    title: "Critical <issue>",
    body: null,
    url: "https://github.com/octocat/hello-world/issues/12",
  },
};

describe("Slack action", () => {
  it("uses the persisted Gemini Slack message for AI mode", () => {
    const text = buildSlackMessage(
      { mode: "AI" },
      issueEvent,
      {
        summary: "A bug was reported.", priority: "HIGH", suggestedLabels: ["bug"],
        githubComment: "AI triage comment.", slackMessage: "High-priority bug reported.", model: "test-model",
      },
    );
    assert.match(text, /^High-priority bug reported\./);
    assert.match(text, /Issue #12 opened/);
  });

  it("builds a safe issue notification with an optional prefix", () => {
    const text = buildSlackMessage(
      { message: "Automation alert" },
      issueEvent,
    );

    assert.match(text, /^Automation alert\nIssue #12 opened/);
    assert.match(text, /Critical &lt;issue&gt;/);
    assert.doesNotMatch(text, /Critical <issue>/);
    console.log("[1] builds a safe issue notification with an optional prefix:\n", text);
  });

  it("builds push notifications", () => {
    const pushEvent: NormalizedGitHubEvent = {
      ...commonEvent,
      kind: "push",
      push: {
        ref: "refs/heads/main",
        branch: "main",
        before: "a",
        after: "b",
        created: false,
        deleted: false,
        forced: false,
        commitCount: 2,
        headCommit: null,
      },
    };

    const text = buildSlackMessage({}, pushEvent);
    assert.match(text, /main.*2 commits/);
    console.log("[2] builds push notifications:\n", text);
  });

  it("builds pull request notifications", () => {
    const pullRequestEvent: NormalizedGitHubEvent = {
      ...commonEvent,
      kind: "pull_request.opened",
      pullRequest: {
        number: 15,
        title: "Critical fix",
        body: null,
        url: "https://github.com/octocat/hello-world/pull/15",
        isDraft: false,
      },
    };

    const text = buildSlackMessage({}, pullRequestEvent);
    assert.match(text, /Pull request #15 opened.*Critical fix/);
    console.log("[3] builds pull request notifications:\n", text);
  });

  it("rejects invalid configuration before sending", async () => {
    let sent = false;
    const client: SlackActionClient = {
      async send() {
        sent = true;
        return { status: 200 };
      },
    };

    await assert.rejects(
      executeSlackRuleAction({ message: "" }, issueEvent, client),
      SlackActionConfigError,
    );
    assert.equal(sent, false);
    console.log("[4] rejects invalid configuration before sending: SlackActionConfigError thrown, sent =", sent);
  });

  it("returns only a safe delivery summary", async () => {
    const sent: string[] = [];
    const client: SlackActionClient = {
      async send(text) {
        sent.push(text);
        return { status: 200 };
      },
    };

    const result = await executeSlackRuleAction({}, issueEvent, client);

    assert.equal(sent.length, 1);
    assert.deepEqual(result.responsePayload, { status: 200, result: "ok" });
    assert.equal("webhookUrl" in result.requestPayload, false);
    console.log("[5] returns only a safe delivery summary:", { textSent: sent[0], responsePayload: result.responsePayload, webhookUrlExposed: "webhookUrl" in result.requestPayload });
  });

  it("propagates delivery failures for attempt tracking", async () => {
    const client: SlackActionClient = {
      async send() {
        throw new Error("Slack webhook failed with HTTP 404: no_service");
      },
    };

    await assert.rejects(
      executeSlackRuleAction({}, issueEvent, client),
      /HTTP 404: no_service/,
    );
    console.log("[6] propagates delivery failures: error thrown as expected, attempt tracking can record the failure");
  });
});
