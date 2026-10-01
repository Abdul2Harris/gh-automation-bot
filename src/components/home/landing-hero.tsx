"use client";

import Link from "next/link";
import { Alert, Button } from "antd";
import {
  BranchesOutlined,
  CheckCircleOutlined,
  GithubOutlined,
  RobotOutlined,
  ThunderboltFilled,
} from "@ant-design/icons";

const features = [
  "Receive and verify GitHub webhooks in real time",
  "Configure rules to auto-label issues and pull requests",
  "Post automated comments on matched events",
  "Send Slack notifications for any GitHub activity",
  "Full audit trail of every action and failure",
];

type LandingHeroProps = {
  userLogin: string | null;
  errorMessage: string | undefined;
};

export function LandingHero({ userLogin, errorMessage }: LandingHeroProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <nav className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <RobotOutlined className="text-sm text-white" />
            </div>
            <span className="text-base font-semibold text-slate-900">
              GitBot
            </span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <GithubOutlined />
            GitHub
          </a>
        </div>
      </nav>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-medium text-indigo-600">
          <ThunderboltFilled className="text-indigo-500" />
          Event-driven GitHub automation
        </div>

        <h1 className="mb-5 max-w-2xl text-center text-5xl font-bold leading-tight tracking-tight text-slate-900">
          Automate your{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            GitHub workflow
          </span>
        </h1>

        <p className="mb-10 max-w-md text-center text-base leading-relaxed text-slate-500">
          Connect repositories, define rules, and let GitBot handle labeling,
          commenting, and Slack notifications — triggered by real GitHub events.
        </p>

        <div className="mb-14 flex w-full max-w-sm flex-col gap-3">
          {errorMessage ? (
            <Alert type="warning" message={errorMessage} showIcon />
          ) : null}

          {userLogin ? (
            <>
              <p className="text-center text-sm text-slate-500">
                Signed in as{" "}
                <span className="font-semibold text-slate-800">
                  @{userLogin}
                </span>
              </p>
              <Link href="/dashboard">
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<BranchesOutlined />}
                >
                  Open dashboard
                </Button>
              </Link>
            </>
          ) : (
            <a href="/api/auth/github/login">
              <Button
                type="primary"
                size="large"
                block
                icon={<GithubOutlined />}
              >
                Sign in with GitHub
              </Button>
            </a>
          )}
        </div>

        <div className="w-full max-w-md rounded-xl border border-slate-100 bg-slate-50 p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            What GitBot does
          </p>
          <ul className="flex flex-col gap-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-slate-600">
                <CheckCircleOutlined className="mt-0.5 shrink-0 text-indigo-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="border-t border-slate-100 px-6 py-5 text-center text-xs text-slate-400">
        Built with Next.js · Deployed on Vercel · All services free tier
      </footer>
    </div>
  );
}
