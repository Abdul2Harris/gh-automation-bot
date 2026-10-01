"use client";

import { Alert, Button } from "antd";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6">
      <Alert className="max-w-lg" type="error" showIcon title="Dashboard data could not be loaded" description="The database request failed. Try loading the activity again." action={<Button onClick={reset}>Retry</Button>} />
    </main>
  );
}
