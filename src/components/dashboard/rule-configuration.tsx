"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DashboardActivity } from "@/lib/dashboard/activity";

type RuleRow = DashboardActivity["rules"][number];
type FormValues = {
  name: string;
  installationId: string;
  repositoryId?: string;
  trigger: "ISSUE_OPENED" | "PULL_REQUEST_OPENED" | "PUSH";
  matchField?: "TITLE" | "BODY" | "TITLE_OR_BODY";
  matchValue?: string;
  actionTypes: Array<"ADD_LABEL" | "COMMENT" | "SLACK_NOTIFICATION">;
  labels?: string;
  commentBody?: string;
  slackMessage?: string;
  commentMode: "CUSTOM" | "AI";
  slackMode: "CUSTOM" | "AI";
};

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

async function apiRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
}

export function RuleConfiguration({ data }: { data: DashboardActivity }) {
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const installationId = Form.useWatch("installationId", form);
  const trigger = Form.useWatch("trigger", form);
  const actionTypes = Form.useWatch("actionTypes", form) ?? [];
  const commentMode = Form.useWatch("commentMode", form) ?? "CUSTOM";
  const slackMode = Form.useWatch("slackMode", form) ?? "CUSTOM";
  const repositories = useMemo(
    () => data.repositories.filter((repository) => repository.installationId === installationId),
    [data.repositories, installationId],
  );

  async function create(values: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const actions = values.actionTypes.map((type) => {
        if (type === "ADD_LABEL") {
          return { type, config: { labels: (values.labels ?? "").split(",").map((label) => label.trim()).filter(Boolean) } };
        }
        if (type === "COMMENT") {
          return values.commentMode === "AI"
            ? { type, config: { mode: "AI" } }
            : { type, config: { mode: "CUSTOM", body: values.commentBody ?? "" } };
        }
        return values.slackMode === "AI"
          ? { type, config: { mode: "AI" } }
          : { type, config: { mode: "CUSTOM", ...(values.slackMessage?.trim() ? { message: values.slackMessage.trim() } : {}) } };
      });
      await apiRequest("/api/rules", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          installationId: values.installationId,
          repositoryId: values.repositoryId ?? null,
          trigger: values.trigger,
          matchField: values.trigger === "PUSH" ? null : values.matchField ?? null,
          matchValue: values.trigger === "PUSH" ? null : values.matchValue?.trim() || null,
          actions,
        }),
      });
      setOpen(false);
      form.resetFields();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rule could not be created");
    } finally {
      setSubmitting(false);
    }
  }

  async function setEnabled(rule: RuleRow, isEnabled: boolean) {
    setError(null);
    try {
      await apiRequest(`/api/rules/${rule.id}`, { method: "PATCH", body: JSON.stringify({ isEnabled }) });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rule could not be updated");
    }
  }

  async function remove(rule: RuleRow) {
    setError(null);
    try {
      await apiRequest(`/api/rules/${rule.id}`, { method: "DELETE" });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rule could not be deleted");
    }
  }

  const columns: ColumnsType<RuleRow> = [
    { title: "Rule", dataIndex: "name", key: "name" },
    { title: "Scope", dataIndex: "scope", key: "scope" },
    { title: "Trigger", dataIndex: "trigger", key: "trigger", render: (value: string) => <Tag color="purple">{readable(value)}</Tag> },
    { title: "Condition", key: "condition", render: (_, rule) => rule.matchValue ? `${readable(rule.matchField ?? "content")} contains "${rule.matchValue}"` : "Any" },
    {
      title: "Actions",
      dataIndex: "actionDetails",
      key: "actions",
      render: (actions: RuleRow["actionDetails"]) => (
        <div className="flex flex-wrap gap-1">
          {actions.map((action) => (
            <Tag key={action.type} color="geekblue">
              {readable(action.type)}
              {action.contentMode ? ` (${action.contentMode === "AI" ? "AI" : "Custom"})` : ""}
            </Tag>
          ))}
        </div>
      ),
    },
    { title: "Enabled", key: "enabled", render: (_, rule) => <Switch checked={rule.isEnabled} onChange={(value) => void setEnabled(rule, value)} /> },
    { title: "", key: "delete", width: 90, render: (_, rule) => <Popconfirm title="Delete this rule?" description="Existing action history will be kept." onConfirm={() => void remove(rule)}><Button danger type="text">Delete</Button></Popconfirm> },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500">{data.rules.length} configured rules</span>
        <Button type="primary" onClick={() => { setError(null); setOpen(true); }} disabled={data.installations.length === 0}>Create rule</Button>
      </div>
      {error ? <Alert className="mb-4" type="error" title={error} closable onClose={() => setError(null)} /> : null}
      <Table rowKey="id" dataSource={data.rules} columns={columns} pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 1000 }} />

      <Modal title="Create automation rule" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={submitting} okText="Create rule" width={680} destroyOnHidden>
        {error ? <Alert className="mb-4" type="error" title={error} /> : null}
        <Form form={form} layout="vertical" onFinish={(values) => void create(values)} initialValues={{ trigger: "ISSUE_OPENED", actionTypes: ["ADD_LABEL"], commentMode: "CUSTOM", slackMode: "CUSTOM" }}>
          <Form.Item name="name" label="Rule name" rules={[{ required: true }, { max: 100 }]}><Input placeholder="Critical issue response" /></Form.Item>
          <div className="grid gap-4 sm:grid-cols-2">
            <Form.Item name="installationId" label="GitHub account" rules={[{ required: true }]}><Select options={data.installations.map((item) => ({ label: item.accountLogin, value: item.id }))} onChange={() => form.setFieldValue("repositoryId", undefined)} /></Form.Item>
            <Form.Item name="repositoryId" label="Repository"><Select allowClear placeholder="All repositories" disabled={!installationId} options={repositories.map((repository) => ({ label: repository.fullName, value: repository.id }))} /></Form.Item>
          </div>
          <Form.Item name="trigger" label="When" rules={[{ required: true }]}><Select options={[{ label: "Issue opened", value: "ISSUE_OPENED" }, { label: "Pull request opened", value: "PULL_REQUEST_OPENED" }, { label: "Push received", value: "PUSH" }]} /></Form.Item>
          {trigger !== "PUSH" ? <div className="grid gap-4 sm:grid-cols-2">
            <Form.Item name="matchField" label="Match field"><Select allowClear placeholder="Any content" onChange={(value) => { if (!value) form.setFieldValue("matchValue", undefined); }} options={[{ label: "Title", value: "TITLE" }, { label: "Body", value: "BODY" }, { label: "Title or body", value: "TITLE_OR_BODY" }]} /></Form.Item>
            <Form.Item name="matchValue" label="Contains text" dependencies={["matchField"]} rules={[({ getFieldValue }) => ({ validator(_, value) { return getFieldValue("matchField") && !value ? Promise.reject(new Error("Enter text to match")) : Promise.resolve(); } })]}><Input placeholder="critical" /></Form.Item>
          </div> : null}
          <Form.Item name="actionTypes" label="Then" rules={[{ required: true, message: "Select at least one action" }]}><Checkbox.Group options={[{ label: "Add labels", value: "ADD_LABEL" }, { label: "Post GitHub comment", value: "COMMENT" }, { label: "Send Slack notification", value: "SLACK_NOTIFICATION" }]} /></Form.Item>
          {actionTypes.includes("ADD_LABEL") ? <Form.Item name="labels" label="Labels" rules={[{ required: true }]}><Input placeholder="critical, high-priority" /></Form.Item> : null}
          {actionTypes.includes("COMMENT") ? <>
            <Form.Item name="commentMode" label="GitHub comment content"><Select options={[{ label: "Custom message", value: "CUSTOM" }, { label: "Gemini-generated", value: "AI", disabled: !data.aiConfigured || trigger === "PUSH" }]} /></Form.Item>
            {commentMode === "CUSTOM" ? <Form.Item name="commentBody" label="GitHub comment" rules={[{ required: true }]}><Input.TextArea rows={3} placeholder="Thanks. The team will review this." /></Form.Item> : null}
          </> : null}
          {actionTypes.includes("SLACK_NOTIFICATION") ? <>
            <Form.Item name="slackMode" label="Slack message content"><Select options={[{ label: "Custom prefix", value: "CUSTOM" }, { label: "Gemini-generated", value: "AI", disabled: !data.aiConfigured || trigger === "PUSH" }]} /></Form.Item>
            {slackMode === "CUSTOM" ? <Form.Item name="slackMessage" label="Slack message prefix"><Input placeholder="High-priority item opened" /></Form.Item> : null}
          </> : null}
          {!data.aiConfigured && (actionTypes.includes("COMMENT") || actionTypes.includes("SLACK_NOTIFICATION")) ? <Alert type="info" title="Add GEMINI_API_KEY to enable AI-generated content." /> : null}
        </Form>
      </Modal>
    </div>
  );
}
