import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RuleMatchField, RuleTrigger } from "@/generated/prisma";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";
import {
  evaluateAutomationRules,
  type RuleForEvaluation,
} from "./evaluate-rules";

const commonEvent = {
  installationId: 101,
  repository: {
    id: 202,
    owner: "abdul",
    name: "automation-bot",
    fullName: "abdul/automation-bot",
    isPrivate: false,
  },
  sender: { id: 303, login: "abdul", type: "User" },
};

const issueEvent: NormalizedGitHubEvent = {
  ...commonEvent,
  kind: "issue.opened",
  issue: {
    number: 12,
    title: "Critical BUG in webhook processing",
    body: "The production callback is unavailable.",
    url: "https://github.com/abdul/automation-bot/issues/12",
  },
};

const pushEvent: NormalizedGitHubEvent = {
  ...commonEvent,
  kind: "push",
  push: {
    ref: "refs/heads/main",
    branch: "main",
    before: "1111111",
    after: "2222222",
    created: false,
    deleted: false,
    forced: false,
    commitCount: 1,
    headCommit: null,
  },
};

function rule(
  overrides: Partial<RuleForEvaluation> = {},
): RuleForEvaluation {
  return {
    id: "rule-1",
    isEnabled: true,
    trigger: RuleTrigger.ISSUE_OPENED,
    matchField: RuleMatchField.TITLE,
    matchValue: "bug",
    repositoryId: null,
    ...overrides,
  };
}

describe("evaluateAutomationRules", () => {
  it("matches title text without case sensitivity", () => {
    const matches = evaluateAutomationRules(issueEvent, [rule()], "repo-1");
    console.log("[1] matches title text without case sensitivity:", matches.map(({ id }) => id));
    assert.deepEqual(matches.map(({ id }) => id), ["rule-1"]);
  });

  it("matches body and title-or-body conditions", () => {
    const matches = evaluateAutomationRules(
      issueEvent,
      [
        rule({
          id: "body",
          matchField: RuleMatchField.BODY,
          matchValue: "callback",
        }),
        rule({
          id: "either",
          matchField: RuleMatchField.TITLE_OR_BODY,
          matchValue: "production",
        }),
      ],
      "repo-1",
    );

    console.log("[2] matches body and title-or-body conditions:", matches.map(({ id }) => id));
    assert.deepEqual(
      matches.map(({ id }) => id),
      ["body", "either"],
    );
  });

  it("rejects non-matching, disabled, and wrong-trigger rules", () => {
    const matches = evaluateAutomationRules(
      issueEvent,
      [
        rule({ id: "no-text", matchValue: "feature" }),
        rule({ id: "disabled", isEnabled: false }),
        rule({ id: "wrong-trigger", trigger: RuleTrigger.PUSH }),
      ],
      "repo-1",
    );

    console.log("[3] rejects non-matching, disabled, and wrong-trigger rules:", matches.map(({ id }) => id));
    assert.equal(matches.length, 0);
  });

  it("matches global and current-repository rules only", () => {
    const matches = evaluateAutomationRules(
      issueEvent,
      [
        rule({ id: "global", repositoryId: null }),
        rule({ id: "current", repositoryId: "repo-1" }),
        rule({ id: "other", repositoryId: "repo-2" }),
      ],
      "repo-1",
    );

    console.log("[4] matches global and current-repository rules only:", matches.map(({ id }) => id));
    assert.deepEqual(
      matches.map(({ id }) => id),
      ["global", "current"],
    );
  });

  it("treats push rules as trigger-only", () => {
    const matches = evaluateAutomationRules(
      pushEvent,
      [
        rule({
          id: "push",
          trigger: RuleTrigger.PUSH,
          matchValue: "text is ignored for push rules",
        }),
      ],
      "repo-1",
    );

    console.log("[5] treats push rules as trigger-only:", matches.map(({ id }) => id));
    assert.deepEqual(matches.map(({ id }) => id), ["push"]);
  });
});
