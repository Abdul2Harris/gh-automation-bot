# Event-Driven GitHub Automation Bot

A take-home project for receiving GitHub App webhooks, evaluating automation rules, taking GitHub and Slack actions, and showing the results in an authenticated dashboard.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Configure the GitHub App callback URL as
`http://localhost:3000/api/auth/github/callback`. Sign in from the home page;
successful authentication redirects to the protected `/dashboard` page.

From the dashboard, **Connect repositories** opens the GitHub App installation
page. After repository selection, GitHub returns through the OAuth callback;
the app verifies the user's installation access, synchronizes the selected
repositories, and displays them in the dashboard table.

Environment values are validated through `src/lib/env.ts` when server integrations first access them. Keep real credentials in the ignored `.env` file; only placeholders belong in `.env.example`.

For Neon, `DATABASE_URL` is the pooled runtime connection and `DIRECT_URL` is the direct connection used by Prisma migrations.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
npm run db:check
npm run test:webhooks
npm run test:webhook-persistence
npm run test:events
npm run test:rules
npm run test:rule-input
npm run test:github-actions
npm run test:slack
```

While signed out, `/dashboard` redirects to the login screen and
`/api/auth/session` returns HTTP 401. While signed in, the session endpoint
returns the current public profile fields.

The authenticated dashboard shows repository counts and the 100 most recent
webhook events, action attempts, and rules available through the signed-in
user's GitHub App installations. Event and action tables include status filters,
and failed actions display their stored error message. Raw webhook payloads and
integration secrets are never passed to the client component.

Retryable failed actions show a **Retry** button in the Actions tab. A retry is
ownership-checked, atomically claimed to prevent concurrent execution, and
updates the existing attempt with its retry count, latest result, and timestamp.
Configuration failures and missing integration setup must be corrected instead
of retried. Manual retries are capped at five; after the fifth failed retry the
action remains failed and the Retry control is removed.

## GitHub webhooks

The webhook receiver is `POST /api/github/webhooks`. It validates
`X-GitHub-Delivery`, `X-GitHub-Event`, and `X-Hub-Signature-256` against the
unchanged request body before parsing JSON. Configure the same random
`GITHUB_WEBHOOK_SECRET` in GitHub App settings and the application environment.

`npm run test:webhooks` checks GitHub's documented HMAC-SHA256 test vector and
rejects tampered or malformed signatures.

With the development server running, `npm run test:webhook-persistence` sends
one signed delivery twice, verifies that Neon stores exactly one event, and
removes its temporary test record.

`npm run test:events` verifies normalization for issue opened, pull request
opened, and push payloads, plus unsupported actions, bot events, and malformed
payload handling.

`npm run test:rules` verifies trigger matching, case-insensitive title/body
matching, repository scoping, disabled rules, and trigger-only push rules.

`npm run test:rule-input` verifies that one rule can contain several distinct
GitHub and Slack actions while rejecting duplicate action types and invalid push
conditions. Rules can be created, enabled, disabled, and deleted from the Rules
tab; every write verifies installation and repository access.

`npm run test:github-actions` uses a mocked GitHub client to verify label and
comment execution without changing a real repository. Label rules use
`{ "labels": ["bug"] }`; comment rules use `{ "body": "Message" }` as their
`actionConfig`. Each execution is recorded in `ActionAttempt`, and the database
prevents the same event/rule/action combination from running twice.

`npm run test:slack` verifies formatted issue, pull request, and push
notifications with a mocked Slack client. Set `SLACK_WEBHOOK_URL` only in the
server environment. Slack rule configuration can be `{}` or contain an optional
safe prefix such as `{ "message": "Automation alert" }`; the secret webhook URL
is never stored in a rule or action attempt.

## Database commands

```bash
npm run db:generate
npm run db:migrate -- --name describe_your_change
npm run db:status
npm run db:studio
```

Use `npm run db:deploy` to apply committed migrations in production.

## GitHub App check

After completing [the GitHub App setup](docs/GITHUB_APP_SETUP.md), run:

```bash
npm run github:check
```

## Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS
- Ant Design with App Router style registration
- Zod environment validation
- Neon PostgreSQL with Prisma ORM
- Octokit GitHub App client
- Planned: GitHub App registration and flows, Slack Incoming Webhooks, and optional Gemini triage

## Free-tier verification

Verified on 2026-09-30. Usage limits apply, but each selected external service has a zero-cost starting path:

- [GitHub Free](https://github.com/pricing) is $0 and supports the repositories used by a GitHub App.
- [Neon Free](https://neon.com/pricing) provides a $0 serverless PostgreSQL tier.
- [Slack Free](https://slack.com/pricing/free) supports custom app installations; Incoming Webhooks are a free Slack platform feature.
- [Vercel Hobby](https://vercel.com/docs/plans) is free for personal projects and pauses at its included usage limit.
- [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing) starts new accounts on the optional Free Tier; billing is linked only to upgrade.
