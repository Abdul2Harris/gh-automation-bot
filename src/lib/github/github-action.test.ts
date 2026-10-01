import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AutomationActionType } from "@/generated/prisma";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import {
  executeGitHubRuleAction,
  GitHubActionConfigError,
  GitHubActionNotApplicableError,
  type GitHubActionClient,
} from "./github-action";

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
    title: "Bug report",
    body: null,
    url: "https://github.com/octocat/hello-world/issues/12",
  },
};

const calls: Array<{ method: string; input: unknown }> = [];
const client: GitHubActionClient = {
  async addLabels(input) {
    calls.push({ method: "addLabels", input });
    return { status: 200, labels: input.labels };
  },
  async createComment(input) {
    calls.push({ method: "createComment", input });
    return {
      status: 201,
      commentId: 99,
      url: "https://github.com/octocat/hello-world/issues/12#issuecomment-99",
    };
  },
};

describe("executeGitHubRuleAction", () => {
  it("uses the persisted Gemini comment for AI mode", async () => {
    calls.length = 0;
    await executeGitHubRuleAction(
      { actionType: AutomationActionType.COMMENT, actionConfig: { mode: "AI" } },
      issueEvent,
      client,
      {
        summary: "A bug was reported.", priority: "HIGH", suggestedLabels: ["bug"],
        githubComment: "AI triage: this appears high priority.",
        slackMessage: "High-priority bug reported.", model: "test-model",
      },
    );
    assert.deepEqual(calls[0], {
      method: "createComment",
      input: { owner: "octocat", repo: "hello-world", issueNumber: 12, body: "AI triage: this appears high priority." },
    });
  });

  it("adds validated labels to an issue", async () => {
    calls.length = 0;
    const result = await executeGitHubRuleAction(
      {
        actionType: AutomationActionType.ADD_LABEL,
        actionConfig: { labels: ["bug", "triage"] },
      },
      issueEvent,
      client,
    );

    assert.equal(result.target, "octocat/hello-world#12");
    assert.deepEqual(calls, [
      {
        method: "addLabels",
        input: {
          owner: "octocat",
          repo: "hello-world",
          issueNumber: 12,
          labels: ["bug", "triage"],
        },
      },
    ]);
    console.log("[1] adds validated labels to an issue:", { target: result.target, calls });
  });

  it("posts a validated comment to a pull request through the issues API", async () => {
    calls.length = 0;
    const pullRequestEvent: NormalizedGitHubEvent = {
      ...commonEvent,
      kind: "pull_request.opened",
      pullRequest: {
        number: 15,
        title: "Feature",
        body: "Description",
        url: "https://github.com/octocat/hello-world/pull/15",
        isDraft: false,
      },
    };

    const result = await executeGitHubRuleAction(
      {
        actionType: AutomationActionType.COMMENT,
        actionConfig: { body: "Thanks for opening this." },
      },
      pullRequestEvent,
      client,
    );

    assert.equal(result.target, "octocat/hello-world#15");
    assert.equal(result.responsePayload.commentId, 99);
    assert.equal(calls[0]?.method, "createComment");
    console.log("[2] posts a comment to a pull request:", { target: result.target, commentId: result.responsePayload.commentId, method: calls[0]?.method });
  });

  it("rejects invalid action configuration before calling GitHub", async () => {
    calls.length = 0;

    await assert.rejects(
      executeGitHubRuleAction(
        {
          actionType: AutomationActionType.ADD_LABEL,
          actionConfig: { labels: [] },
        },
        issueEvent,
        client,
      ),
      GitHubActionConfigError,
    );
    assert.equal(calls.length, 0);
    console.log("[3] rejects invalid config before calling GitHub: error thrown as expected, GitHub was never called, calls.length =", calls.length);
  });

  it("skips label and comment actions for push events", async () => {
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
        commitCount: 1,
        headCommit: null,
      },
    };

    await assert.rejects(
      executeGitHubRuleAction(
        {
          actionType: AutomationActionType.COMMENT,
          actionConfig: { body: "Not applicable" },
        },
        pushEvent,
        client,
      ),
      GitHubActionNotApplicableError,
    );
    console.log("[4] skips label/comment actions for push events: GitHubActionNotApplicableError thrown as expected");
  });
});
