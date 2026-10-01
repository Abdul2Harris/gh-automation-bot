import "server-only";

import { App } from "octokit";
import { getServerEnv } from "@/lib/env";

let cachedApp: App | undefined;

function normalizePrivateKey(privateKey: string) {
  const lines = privateKey
    .replace(/\\n/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return `${lines.join("\n")}\n`;
}

export function getGitHubApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const env = getServerEnv();

  const webhooks = env.GITHUB_WEBHOOK_SECRET
    ? { webhooks: { secret: env.GITHUB_WEBHOOK_SECRET } }
    : {};

  cachedApp = new App({
    appId: env.GITHUB_APP_ID,
    privateKey: normalizePrivateKey(env.GITHUB_PRIVATE_KEY),
    oauth: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
    ...webhooks,
  });

  return cachedApp;
}

export function getInstallationOctokit(installationId: number) {
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    throw new Error("A positive GitHub installation ID is required");
  }

  return getGitHubApp().getInstallationOctokit(installationId);
}
