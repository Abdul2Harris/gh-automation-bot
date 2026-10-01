import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  getCurrentUser,
  INSTALLATION_STATE_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { getGitHubApp } from "@/lib/github/app";
import { syncUserInstallations } from "@/lib/github/installations";

function statesMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function errorRedirect(
  request: NextRequest,
  error: string,
  installationFlow = false,
) {
  const path = installationFlow
    ? `/dashboard?installation_error=${error}`
    : `/?auth_error=${error}`;

  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const githubError = request.nextUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedLoginState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const expectedInstallationState = cookieStore.get(
    INSTALLATION_STATE_COOKIE_NAME,
  )?.value;
  const loginFlow = Boolean(
    state && expectedLoginState && statesMatch(state, expectedLoginState),
  );
  const installationFlow = Boolean(
    state &&
      expectedInstallationState &&
      statesMatch(state, expectedInstallationState),
  );

  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
  cookieStore.delete(INSTALLATION_STATE_COOKIE_NAME);

  if (githubError) {
    return errorRedirect(request, "github_denied", installationFlow);
  }

  if (!code || !state || (!loginFlow && !installationFlow)) {
    return errorRedirect(request, "invalid_oauth_state");
  }

  try {
    const env = getServerEnv();
    const redirectUrl = new URL(
      "/api/auth/github/callback",
      env.APP_URL,
    ).toString();
    const octokit = await getGitHubApp().oauth.getUserOctokit({
      code,
      state,
      redirectUrl,
    });
    const { data: profile } = await octokit.request("GET /user");

    if (installationFlow) {
      const currentUser = await getCurrentUser();

      if (!currentUser) {
        return errorRedirect(request, "signin_required");
      }

      if (currentUser.githubUserId !== BigInt(profile.id)) {
        return errorRedirect(request, "account_mismatch", true);
      }

      await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          login: profile.login,
          displayName: profile.name,
          avatarUrl: profile.avatar_url,
        },
      });
      await syncUserInstallations(currentUser.id, octokit);

      return NextResponse.redirect(
        new URL("/dashboard?installation=connected", request.url),
      );
    }

    const user = await prisma.user.upsert({
      where: { githubUserId: BigInt(profile.id) },
      create: {
        githubUserId: BigInt(profile.id),
        login: profile.login,
        displayName: profile.name,
        avatarUrl: profile.avatar_url,
      },
      update: {
        login: profile.login,
        displayName: profile.name,
        avatarUrl: profile.avatar_url,
      },
    });

    await createSession(user.id);

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error(
      "GitHub OAuth callback failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return errorRedirect(
      request,
      installationFlow ? "installation_failed" : "github_auth_failed",
      installationFlow,
    );
  }
}
