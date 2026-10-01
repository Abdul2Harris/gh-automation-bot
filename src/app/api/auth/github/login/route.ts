import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { getGitHubApp } from "@/lib/github/app";

const OAUTH_STATE_DURATION_SECONDS = 60 * 10;

export async function GET() {
  const env = getServerEnv();
  const state = randomBytes(32).toString("base64url");
  const redirectUrl = new URL(
    "/api/auth/github/callback",
    env.APP_URL,
  ).toString();
  const { url } = getGitHubApp().oauth.getWebFlowAuthorizationUrl({
    state,
    redirectUrl,
  });

  (await cookies()).set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_DURATION_SECONDS,
  });

  return NextResponse.redirect(url);
}
