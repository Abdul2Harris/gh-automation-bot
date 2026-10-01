import { z } from "zod";

const labelAction = z.object({
  type: z.literal("ADD_LABEL"),
  config: z.object({
    labels: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
  }),
});

const commentAction = z.object({
  type: z.literal("COMMENT"),
  config: z.union([
    z.object({ mode: z.literal("AI") }),
    z.object({ mode: z.literal("CUSTOM"), body: z.string().trim().min(1).max(10_000) }),
    z.object({ body: z.string().trim().min(1).max(10_000) }),
  ]),
});

const slackAction = z.object({
  type: z.literal("SLACK_NOTIFICATION"),
  config: z.union([
    z.object({ mode: z.literal("AI") }),
    z.object({ mode: z.literal("CUSTOM"), message: z.string().trim().min(1).max(500).optional() }),
    z.object({ message: z.string().trim().min(1).max(500).optional() }),
  ]),
});

export const createRuleSchema = z
  .object({
    installationId: z.string().min(1),
    repositoryId: z.string().min(1).nullable(),
    name: z.string().trim().min(1).max(100),
    trigger: z.enum(["ISSUE_OPENED", "PULL_REQUEST_OPENED", "PUSH"]),
    matchField: z.enum(["TITLE", "BODY", "TITLE_OR_BODY"]).nullable(),
    matchValue: z.string().trim().max(500).nullable(),
    actions: z
      .array(z.discriminatedUnion("type", [labelAction, commentAction, slackAction]))
      .min(1)
      .max(3),
  })
  .superRefine((value, context) => {
    if (value.trigger === "PUSH" && (value.matchField || value.matchValue)) {
      context.addIssue({ code: "custom", path: ["matchValue"], message: "Push rules cannot use a text condition" });
    }

    if (value.trigger === "PUSH" && value.actions.some((action) => "mode" in action.config && action.config.mode === "AI")) {
      context.addIssue({ code: "custom", path: ["actions"], message: "AI content applies only to issue and pull request rules" });
    }

    if (value.trigger !== "PUSH" && Boolean(value.matchField) !== Boolean(value.matchValue)) {
      context.addIssue({ code: "custom", path: ["matchValue"], message: "Condition field and text must be provided together" });
    }

    const types = value.actions.map((action) => action.type);
    if (new Set(types).size !== types.length) {
      context.addIssue({ code: "custom", path: ["actions"], message: "Each action type can be selected once" });
    }
  });

export const updateRuleSchema = z.object({ isEnabled: z.boolean() });

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
