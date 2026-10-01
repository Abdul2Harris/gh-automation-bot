import { ActivityDashboard } from "@/components/dashboard/activity-dashboard";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireUser } from "@/lib/auth/session";
import { getDashboardActivity } from "@/lib/dashboard/activity";

type DashboardProps = {
  searchParams: Promise<{
    installation?: string;
    installation_error?: string;
  }>;
};

const installationErrors: Record<string, string> = {
  account_mismatch:
    "Install the app using the same GitHub account that is signed in here.",
  installation_failed: "The GitHub installation could not be connected.",
};

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const user = await requireUser();
  const [data, params] = await Promise.all([
    getDashboardActivity(user.id),
    searchParams,
  ]);
  const installationError = params.installation_error
    ? installationErrors[params.installation_error] ??
      "The GitHub installation could not be connected."
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardNav
        login={user.login}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        failureCount={data.summary.failures}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {params.installation === "connected" ? (
          <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            GitHub repositories connected successfully
          </div>
        ) : null}
        {installationError ? (
          <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
            {installationError}
          </div>
        ) : null}

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Monitor your repositories, automation rules, and event activity.
          </p>
        </div>

        <ActivityDashboard data={data} />
      </main>
    </div>
  );
}
