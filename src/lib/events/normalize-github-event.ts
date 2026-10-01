import { z } from "zod";

const githubIdSchema = z.number().int().positive();

const installationSchema = z.object({
  id: githubIdSchema,
});

const repositorySchema = z.object({
  id: githubIdSchema,
  name: z.string().min(1),
  full_name: z.string().min(1),
  private: z.boolean(),
  owner: z.object({ login: z.string().min(1) }),
});

const senderSchema = z.object({
  id: githubIdSchema,
  login: z.string().min(1),
  type: z.string().min(1),
});

const issueOpenedSchema = z.object({
  action: z.literal("opened"),
  installation: installationSchema,
  repository: repositorySchema,
  sender: senderSchema,
  issue: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string().url(),
  }),
});

const pullRequestOpenedSchema = z.object({
  action: z.literal("opened"),
  installation: installationSchema,
  repository: repositorySchema,
  sender: senderSchema,
  pull_request: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string().url(),
    draft: z.boolean(),
  }),
});

const pushSchema = z.object({
  ref: z.string().min(1),
  before: z.string().min(1),
  after: z.string().min(1),
  created: z.boolean(),
  deleted: z.boolean(),
  forced: z.boolean(),
  installation: installationSchema,
  repository: repositorySchema,
  sender: senderSchema,
  commits: z.array(
    z.object({
      id: z.string().min(1),
      message: z.string(),
      url: z.string().url(),
    }),
  ),
  head_commit: z
    .object({
      id: z.string().min(1),
      message: z.string(),
      url: z.string().url(),
    })
    .nullable(),
});

type RepositoryData = z.infer<typeof repositorySchema>;
type SenderData = z.infer<typeof senderSchema>;

type NormalizedCommon = {
  installationId: number;
  repository: {
    id: number;
    owner: string;
    name: string;
    fullName: string;
    isPrivate: boolean;
  };
  sender: {
    id: number;
    login: string;
    type: string;
  };
};

export type NormalizedGitHubEvent = NormalizedCommon &
  (
    | {
        kind: "issue.opened";
        issue: {
          number: number;
          title: string;
          body: string | null;
          url: string;
        };
      }
    | {
        kind: "pull_request.opened";
        pullRequest: {
          number: number;
          title: string;
          body: string | null;
          url: string;
          isDraft: boolean;
        };
      }
    | {
        kind: "push";
        push: {
          ref: string;
          branch: string;
          before: string;
          after: string;
          created: boolean;
          deleted: boolean;
          forced: boolean;
          commitCount: number;
          headCommit: {
            id: string;
            message: string;
            url: string;
          } | null;
        };
      }
  );

export type NormalizeGitHubEventResult =
  | { outcome: "normalized"; event: NormalizedGitHubEvent }
  | { outcome: "ignored"; reason: string };

export class WebhookNormalizationError extends Error {}

function isBot(sender: SenderData) {
  return sender.type === "Bot" || sender.login.endsWith("[bot]");
}

function normalizeCommon(
  installationId: number,
  repository: RepositoryData,
  sender: SenderData,
): NormalizedCommon {
  return {
    installationId,
    repository: {
      id: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      isPrivate: repository.private,
    },
    sender: {
      id: sender.id,
      login: sender.login,
      type: sender.type,
    },
  };
}

function parsePayload<T>(
  schema: z.ZodType<T>,
  payload: Record<string, unknown>,
  eventType: string,
) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");

    throw new WebhookNormalizationError(
      `Invalid ${eventType} payload${fields ? `: ${fields}` : ""}`,
    );
  }

  return result.data;
}

export function normalizeGitHubEvent(
  eventType: string,
  payload: Record<string, unknown>,
): NormalizeGitHubEventResult {
  if (eventType === "issues") {
    if (payload.action !== "opened") {
      return { outcome: "ignored", reason: "Unsupported issues action" };
    }

    const parsed = parsePayload(issueOpenedSchema, payload, eventType);

    if (isBot(parsed.sender)) {
      return { outcome: "ignored", reason: "Bot-generated event" };
    }

    return {
      outcome: "normalized",
      event: {
        kind: "issue.opened",
        ...normalizeCommon(
          parsed.installation.id,
          parsed.repository,
          parsed.sender,
        ),
        issue: {
          number: parsed.issue.number,
          title: parsed.issue.title,
          body: parsed.issue.body,
          url: parsed.issue.html_url,
        },
      },
    };
  }

  if (eventType === "pull_request") {
    if (payload.action !== "opened") {
      return {
        outcome: "ignored",
        reason: "Unsupported pull_request action",
      };
    }

    const parsed = parsePayload(pullRequestOpenedSchema, payload, eventType);

    if (isBot(parsed.sender)) {
      return { outcome: "ignored", reason: "Bot-generated event" };
    }

    return {
      outcome: "normalized",
      event: {
        kind: "pull_request.opened",
        ...normalizeCommon(
          parsed.installation.id,
          parsed.repository,
          parsed.sender,
        ),
        pullRequest: {
          number: parsed.pull_request.number,
          title: parsed.pull_request.title,
          body: parsed.pull_request.body,
          url: parsed.pull_request.html_url,
          isDraft: parsed.pull_request.draft,
        },
      },
    };
  }

  if (eventType === "push") {
    const parsed = parsePayload(pushSchema, payload, eventType);

    if (isBot(parsed.sender)) {
      return { outcome: "ignored", reason: "Bot-generated event" };
    }

    return {
      outcome: "normalized",
      event: {
        kind: "push",
        ...normalizeCommon(
          parsed.installation.id,
          parsed.repository,
          parsed.sender,
        ),
        push: {
          ref: parsed.ref,
          branch: parsed.ref.startsWith("refs/heads/")
            ? parsed.ref.slice("refs/heads/".length)
            : parsed.ref,
          before: parsed.before,
          after: parsed.after,
          created: parsed.created,
          deleted: parsed.deleted,
          forced: parsed.forced,
          commitCount: parsed.commits.length,
          headCommit: parsed.head_commit,
        },
      },
    };
  }

  return { outcome: "ignored", reason: "Unsupported event type" };
}
