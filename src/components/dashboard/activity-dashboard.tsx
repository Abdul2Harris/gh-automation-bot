"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Empty, Table, Tabs, Tag, Typography } from "antd";
import {
  ApiOutlined,
  BranchesOutlined,
  CloseCircleFilled,
  CodeOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { DashboardActivity } from "@/lib/dashboard/activity";
import { RuleConfiguration } from "@/components/dashboard/rule-configuration";

type EventRow = DashboardActivity["events"][number];
type ActionRow = DashboardActivity["actions"][number];
type RepositoryRow = DashboardActivity["repositories"][number];

const statusColors: Record<string, string> = {
  RECEIVED: "default",
  PROCESSING: "processing",
  PROCESSED: "success",
  SUCCEEDED: "success",
  FAILED: "error",
  IGNORED: "warning",
  SKIPPED: "warning",
  PENDING: "processing",
};

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusTag({ status }: { status: string }) {
  return <Tag color={statusColors[status]}>{readable(status)}</Tag>;
}

function FailureText({ message }: { message: string | null }) {
  return message ? (
    <Typography.Text
      type="danger"
      className="block max-w-80"
      ellipsis={{ tooltip: message }}
    >
      {message}
    </Typography.Text>
  ) : (
    <span className="text-slate-300">—</span>
  );
}

const repositoryColumns: ColumnsType<RepositoryRow> = [
  {
    title: "Repository",
    dataIndex: "fullName",
    key: "fullName",
    render: (v: string) => <span className="font-medium text-slate-800">{v}</span>,
  },
  {
    title: "Account",
    dataIndex: "accountLogin",
    key: "accountLogin",
    render: (v: string) => <span className="text-slate-500">{v}</span>,
  },
  {
    title: "Visibility",
    dataIndex: "isPrivate",
    key: "visibility",
    filters: [{ text: "Private", value: true }, { text: "Public", value: false }],
    onFilter: (value, row) => row.isPrivate === value,
    render: (v: boolean) => (
      <Tag color={v ? "gold" : "green"}>{v ? "Private" : "Public"}</Tag>
    ),
  },
];

const eventColumns: ColumnsType<EventRow> = [
  {
    title: "Event",
    key: "event",
    filters: ["issues", "pull_request", "push"].map((v) => ({ text: readable(v), value: v })),
    onFilter: (value, row) => row.eventType === value,
    render: (_, row) => (
      <div>
        <div className="font-medium text-slate-800">{readable(row.eventType)}</div>
        <div className="text-xs text-slate-400">{row.action ?? "event"}</div>
      </div>
    ),
  },
  {
    title: "Repository",
    dataIndex: "repository",
    key: "repository",
    render: (v: string) => <span className="text-slate-500">{v}</span>,
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    filters: ["PROCESSED", "FAILED", "IGNORED", "PROCESSING", "RECEIVED"].map((v) => ({ text: readable(v), value: v })),
    onFilter: (value, row) => row.status === value,
    render: (v: string) => <StatusTag status={v} />,
  },
  {
    title: "AI triage",
    key: "triage",
    render: (_, row) => row.triage ? (
      <div className="max-w-72">
        <div className="mb-1 flex gap-1"><StatusTag status={row.triage.status} />{row.triage.priority ? <Tag color={row.triage.priority === "HIGH" ? "red" : row.triage.priority === "MEDIUM" ? "gold" : "green"}>{readable(row.triage.priority)}</Tag> : null}</div>
        <Typography.Text className="block text-xs" ellipsis={{ tooltip: row.triage.summary ?? row.triage.errorMessage }}>{row.triage.summary ?? row.triage.errorMessage}</Typography.Text>
      </div>
    ) : <span className="text-slate-300">Not requested</span>,
  },
  {
    title: "Actions",
    dataIndex: "actionCount",
    key: "actionCount",
    width: 90,
    render: (v: number) => <span className="text-slate-500">{v}</span>,
  },
  {
    title: "Received",
    dataIndex: "receivedAt",
    key: "receivedAt",
    render: (v: string) => <span className="text-xs text-slate-400">{dateTime(v)}</span>,
  },
  {
    title: "Error",
    dataIndex: "errorMessage",
    key: "error",
    render: (v) => <FailureText message={v} />,
  },
];

const actionColumns: ColumnsType<ActionRow> = [
  {
    title: "Rule",
    dataIndex: "ruleName",
    key: "ruleName",
    render: (v: string) => <span className="font-medium text-slate-800">{v}</span>,
  },
  {
    title: "Action",
    dataIndex: "type",
    key: "type",
    filters: ["ADD_LABEL", "COMMENT", "SLACK_NOTIFICATION"].map((v) => ({ text: readable(v), value: v })),
    onFilter: (value, row) => row.type === value,
    render: (v: string) => <Tag color="geekblue">{readable(v)}</Tag>,
  },
  {
    title: "Target",
    dataIndex: "target",
    key: "target",
    render: (v) => (
      <span className="font-mono text-xs text-slate-500">{v ?? "Not reached"}</span>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    filters: ["SUCCEEDED", "FAILED", "PENDING", "SKIPPED"].map((v) => ({ text: readable(v), value: v })),
    onFilter: (value, row) => row.status === value,
    render: (v: string) => <StatusTag status={v} />,
  },
  {
    title: "Attempted",
    dataIndex: "attemptedAt",
    key: "attemptedAt",
    render: (v: string, row) => (
      <div className="text-xs text-slate-400">
        <div>{dateTime(v)}</div>
        {row.retryCount > 0 ? <div>{row.retryCount} retr{row.retryCount === 1 ? "y" : "ies"}</div> : null}
      </div>
    ),
  },
  {
    title: "Error",
    dataIndex: "errorMessage",
    key: "error",
    render: (v) => <FailureText message={v} />,
  },
];

function ActionHistory({ rows }: { rows: ActionRow[] }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry(row: ActionRow) {
    setRetrying(row.id);
    setError(null);
    try {
      const response = await fetch(`/api/actions/${row.id}/retry`, { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Retry failed");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  const columns: ColumnsType<ActionRow> = [
    ...actionColumns,
    {
      title: "",
      key: "retry",
      width: 90,
      render: (_, row) =>
        row.status === "FAILED" && row.isRetryable ? (
          <Button size="small" loading={retrying === row.id} onClick={() => void retry(row)}>
            Retry
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      {error ? <Alert className="mb-4" type="error" title={error} closable onClose={() => setError(null)} /> : null}
      <DataTable rows={rows} columns={columns} empty="No actions attempted yet" />
    </>
  );
}


function DataTable<T extends { id: string }>({
  rows,
  columns,
  empty,
}: {
  rows: T[];
  columns: ColumnsType<T>;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-16">
        <Empty description={<span className="text-slate-400">{empty}</span>} />
      </div>
    );
  }
  return (
    <Table
      rowKey="id"
      dataSource={rows}
      columns={columns}
      pagination={{ pageSize: 10, showSizeChanger: false }}
      scroll={{ x: 900 }}
      size="middle"
    />
  );
}

type StatCardProps = {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  alert?: boolean;
};

function StatCard({ title, value, icon, iconBg, iconColor, alert }: StatCardProps) {
  const isAlert = alert && value > 0;
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-xs ${isAlert ? "border-red-200" : "border-slate-200"}`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <span className={`text-sm ${iconColor}`}>{icon}</span>
        </div>
      </div>
      <div className={`text-3xl font-bold ${isAlert ? "text-red-500" : "text-slate-900"}`}>
        {value.toLocaleString()}
      </div>
      {isAlert && (
        <p className="mt-1 text-xs text-red-400">Needs attention</p>
      )}
    </div>
  );
}

export function ActivityDashboard({ data }: { data: DashboardActivity }) {
  const hasFailures = data.summary.failures > 0;
  const latestActionFailed = data.actions[0]?.status === "FAILED";

  return (
    <>
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Repositories"
          value={data.summary.repositories}
          icon={<CodeOutlined />}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <StatCard
          title="Events"
          value={data.summary.events}
          icon={<ThunderboltOutlined />}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          title="Actions"
          value={data.summary.actions}
          icon={<ApiOutlined />}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Failures"
          value={data.summary.failures}
          icon={<CloseCircleFilled />}
          iconBg={hasFailures ? "bg-red-50" : "bg-slate-50"}
          iconColor={hasFailures ? "text-red-500" : "text-slate-400"}
          alert
        />
      </section>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="px-5 pt-1">
          <Tabs
          defaultActiveKey={latestActionFailed ? "actions" : "events"}
          items={[
            {
              key: "events",
              label: (
                <span className="flex items-center gap-1.5">
                  <ThunderboltOutlined />
                  Events
                  <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {data.summary.events}
                  </span>
                </span>
              ),
              children: (
                <div className="px-5 pb-5">
                  <DataTable rows={data.events} columns={eventColumns} empty="No webhook events received yet" />
                </div>
              ),
            },
            {
              key: "actions",
              label: (
                <span className="flex items-center gap-1.5">
                  <ApiOutlined />
                  Actions
                  <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {data.summary.actions}
                  </span>
                  {latestActionFailed ? (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
                      Latest failed
                    </span>
                  ) : null}
                </span>
              ),
              children: (
                <div className="px-5 pb-5">
                  <ActionHistory rows={data.actions} />
                </div>
              ),
            },
            {
              key: "rules",
              label: (
                <span className="flex items-center gap-1.5">
                  <BranchesOutlined />
                  Rules
                  <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {data.rules.length}
                  </span>
                </span>
              ),
              children: (
                <div className="px-5 pb-5">
                  <RuleConfiguration data={data} />
                </div>
              ),
            },
            {
              key: "repositories",
              label: (
                <span className="flex items-center gap-1.5">
                  <DatabaseOutlined />
                  Repositories
                  <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {data.summary.repositories}
                  </span>
                </span>
              ),
              children: (
                <div className="px-5 pb-5">
                  <DataTable rows={data.repositories} columns={repositoryColumns} empty="No repositories connected yet" />
                </div>
              ),
            },
          ]}
          />
        </div>
      </div>
    </>
  );
}
