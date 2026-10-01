import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  INSTALLATION_STATE_COOKIE_NAME,
  requireUser,
} from "@/lib/auth/session";
import { getGitHubApp } from "@/lib/github/app";

const INSTALLATION_STATE_DURATION_SECONDS = 60 * 10;

export async function GET() {
  await requireUser();

  const state = randomBytes(32).toString("base64url");
  const { data: app } = await getGitHubApp().octokit.rest.apps.getAuthenticated();
  const appSlug = app?.slug;

  if (!appSlug) {
    throw new Error("The authenticated GitHub App does not have a slug");
  }

  (await cookies()).set(INSTALLATION_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INSTALLATION_STATE_DURATION_SECONDS,
  });

  const installUrl = new URL(
    `https://github.com/apps/${appSlug}/installations/new`,
  );
  installUrl.searchParams.set("state", state);

  return NextResponse.redirect(installUrl);
}
