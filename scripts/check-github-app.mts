import "dotenv/config";

import { App } from "octokit";
import { z } from "zod";

function normalizePrivateKey(privateKey: string) {
  const lines = privateKey
    .replace(/\\n/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return `${lines.join("\n")}\n`;
}

const credentialsSchema = z.object({
  GITHUB_APP_ID: z.string().regex(/^\d+$/),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_PRIVATE_KEY: z
    .string()
    .transform(normalizePrivateKey)
    .refine((value) => value.includes("BEGIN") && value.includes("PRIVATE KEY"), {
      message: "must contain a PEM private key",
    }),
  GITHUB_WEBHOOK_SECRET: z.string().min(32).optional().or(z.literal("")),
});

async function main() {
  const credentials = credentialsSchema.parse(process.env);
  const webhooks = credentials.GITHUB_WEBHOOK_SECRET
    ? { webhooks: { secret: credentials.GITHUB_WEBHOOK_SECRET } }
    : {};

  const app = new App({
    appId: credentials.GITHUB_APP_ID,
    privateKey: credentials.GITHUB_PRIVATE_KEY,
    oauth: {
      clientId: credentials.GITHUB_CLIENT_ID,
      clientSecret: credentials.GITHUB_CLIENT_SECRET,
    },
    ...webhooks,
  });

  const { data } = await app.octokit.rest.apps.getAuthenticated();

  if (!data) {
    throw new Error("GitHub returned an empty app response");
  }

  console.log(`Authenticated GitHub App: ${data.slug ?? data.name}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`GitHub App authentication failed: ${message}`);
  process.exitCode = 1;
});
