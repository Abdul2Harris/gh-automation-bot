"use client";

import { Avatar, Badge, Button, Space } from "antd";
import {
  BellOutlined,
  LogoutOutlined,
  PlusOutlined,
  RobotOutlined,
} from "@ant-design/icons";

type DashboardNavProps = {
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  failureCount: number;
};

export function DashboardNav({
  login,
  displayName,
  avatarUrl,
  failureCount,
}: DashboardNavProps) {
  return (
    <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
              <RobotOutlined className="text-xs text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">GitBot</span>
          </div>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span className="hidden text-sm text-slate-400 sm:block">
            Dashboard
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            count={failureCount > 0 ? failureCount : 0}
            size="small"
            color="#ef4444"
          >
            <BellOutlined className="text-base text-slate-400 hover:text-slate-700 cursor-pointer transition-colors" />
          </Badge>

          <div className="hidden items-center gap-2 sm:flex">
            <Avatar
              size={28}
              src={avatarUrl ?? undefined}
              className="border border-slate-200"
            >
              {login.slice(0, 1).toUpperCase()}
            </Avatar>
            <div className="text-sm">
              <span className="font-medium text-slate-700">
                {displayName ?? login}
              </span>
              <span className="ml-1 text-slate-400">@{login}</span>
            </div>
          </div>

          <Space size="small">
            <a href="/api/github/installations/new">
              <Button type="primary" size="small" icon={<PlusOutlined />}>
                Connect repo
              </Button>
            </a>
            <form action="/api/auth/logout" method="post">
              <Button
                htmlType="submit"
                size="small"
                icon={<LogoutOutlined />}
                className="text-slate-500"
              >
                Sign out
              </Button>
            </form>
          </Space>
        </div>
      </div>
    </nav>
  );
}
