import { LandingHero } from "@/components/home/landing-hero";
import { getCurrentUser } from "@/lib/auth/session";

const errorMessages: Record<string, string> = {
  github_denied: "GitHub authorization was cancelled.",
  invalid_oauth_state: "The sign-in request expired or could not be verified.",
  github_auth_failed: "GitHub sign-in failed. Please try again.",
  signin_required: "Sign in to open the dashboard.",
};

type HomeProps = {
  searchParams: Promise<{ auth_error?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const errorMessage = params.auth_error
    ? errorMessages[params.auth_error]
    : undefined;

  return <LandingHero userLogin={user?.login ?? null} errorMessage={errorMessage} />;
}
