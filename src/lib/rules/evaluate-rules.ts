import { RuleMatchField, RuleTrigger } from "@/generated/prisma";
import type { NormalizedGitHubEvent } from "@/lib/events/normalize-github-event";

export type RuleForEvaluation = {
  id: string;
  isEnabled: boolean;
  trigger: RuleTrigger;
  matchField: RuleMatchField | null;
  matchValue: string | null;
  repositoryId: string | null;
};

function eventTrigger(event: NormalizedGitHubEvent) {
  switch (event.kind) {
    case "issue.opened":
      return RuleTrigger.ISSUE_OPENED;
    case "pull_request.opened":
      return RuleTrigger.PULL_REQUEST_OPENED;
    case "push":
      return RuleTrigger.PUSH;
  }
}

function matchesText(event: NormalizedGitHubEvent, rule: RuleForEvaluation) {
  if (event.kind === "push") {
    return true;
  }

  const matchValue = rule.matchValue?.trim().toLocaleLowerCase();

  if (!matchValue) {
    return true;
  }

  if (!rule.matchField) {
    return false;
  }

  const subject =
    event.kind === "issue.opened" ? event.issue : event.pullRequest;
  const title = subject.title.toLocaleLowerCase();
  const body = subject.body?.toLocaleLowerCase() ?? "";

  switch (rule.matchField) {
    case RuleMatchField.TITLE:
      return title.includes(matchValue);
    case RuleMatchField.BODY:
      return body.includes(matchValue);
    case RuleMatchField.TITLE_OR_BODY:
      return title.includes(matchValue) || body.includes(matchValue);
  }
}

export function evaluateAutomationRules<T extends RuleForEvaluation>(
  event: NormalizedGitHubEvent,
  rules: T[],
  repositoryId: string | null,
) {
  const trigger = eventTrigger(event);

  return rules.filter((rule) => {
    if (!rule.isEnabled || rule.trigger !== trigger) {
      return false;
    }

    if (rule.repositoryId && rule.repositoryId !== repositoryId) {
      return false;
    }

    return matchesText(event, rule);
  });
}
