# Event-Driven GitHub Automation Bot

## Project Goal

Build a full-stack Event-Driven GitHub Automation Bot.

Core flow:

1. User authenticates using GitHub.
2. User installs or connects our GitHub App to one or more repositories.
3. GitHub sends webhooks for:
   - `issues`
   - `pull_request`
   - `push`
4. The backend verifies and records each webhook.
5. Configured rules determine what actions should happen.
6. Supported actions initially:
   - add a GitHub label
   - post a GitHub comment
   - send a Slack notification
7. An authenticated dashboard shows received events, actions, failures, and configured rules.
8. AI triage using Gemini may be added only after the complete core flow works.

## Tech Stack

Use:

- Next.js with App Router
- TypeScript everywhere
- Tailwind CSS
- Ant Design for dashboard UI, forms, tables, and controls
- Next.js Route Handlers for backend APIs and GitHub webhook endpoints
- GitHub App authentication and installation flow
- Octokit for GitHub API access
- Neon PostgreSQL
- Prisma ORM
- Slack Incoming Webhooks
- Google Gemini for the optional AI feature
- Zod for server-side validation
- Vercel for deployment

Everything must use free/no-credit-card services.

Do **not** introduce Express, a separate backend application, Redis, Docker, WebSockets, microservices, or other infrastructure unless we explicitly decide later that it is necessary.

## Architecture Principles

Keep the project simple enough to finish within the deadline but production-minded.

Important requirements:

- Verify every GitHub webhook using its HMAC signature.
- Signature verification must use the raw request body.
- Use `X-GitHub-Delivery` as the delivery identifier.
- Store the delivery ID with a `UNIQUE` database constraint for idempotency.
- Duplicate webhook deliveries must never perform actions twice.
- Save webhook events before executing external actions.
- Record every attempted bot action and whether it succeeded or failed.
- Never silently swallow GitHub, Slack, database, or AI errors.
- Failed actions must remain visible in the database and dashboard.
- Never expose secrets to client components.
- Never log access tokens, private keys, webhook secrets, Slack webhook URLs, or complete sensitive payloads.
- Ignore bot-generated events where necessary to prevent automation loops.
- Normalize GitHub webhook payloads before passing them to rule-processing logic.
- Because deployment is Vercel/serverless, do not copy architectures that depend on a permanently running Node/Express worker.
- Any retry or background-processing design must be compatible with Vercel's execution model.

## Initial Event Types

Support:

- `issues`
- `pull_request`
- `push`

Initially focus actions primarily on issue and PR opened events.

Example rule:

```text
WHEN:
Issue opened

IF:
title contains "bug"

THEN:
- add `bug` label
- optionally post comment
- send Slack notification
```

## Proposed Architecture

Use a single Next.js application:

- App Router pages for the authenticated dashboard.
- Route Handlers for GitHub OAuth, GitHub App installation callbacks, dashboard APIs, and GitHub webhooks.
- Server-only modules for GitHub, Slack, database, rule evaluation, environment validation, and normalized event processing.
- Prisma and Neon PostgreSQL for persistence.
- Ant Design for dashboard-heavy UI pieces such as event tables, rule forms, action status views, filters, and controls.

Suggested module boundaries once application code begins:

- `src/app`: pages, layouts, and route handlers
- `src/lib/env`: centralized environment validation with Zod
- `src/lib/db`: shared Prisma client
- `src/lib/github`: GitHub App auth, Octokit clients, webhook verification, GitHub actions
- `src/lib/slack`: Slack webhook delivery
- `src/lib/rules`: rule evaluation and normalized event matching
- `src/lib/events`: event normalization and persistence helpers
- `src/components`: dashboard components built with Ant Design and Tailwind where appropriate

## Code Quality

- Keep files small and focused.
- Separate route handling from business logic.
- Route Handlers should validate input and call services rather than contain large amounts of business logic.
- Put GitHub integration logic in dedicated server modules.
- Put Slack integration logic in dedicated server modules.
- Put rule evaluation in its own service/module.
- Access Prisma through one shared database module.
- Validate environment variables centrally using Zod.
- Do not access `process.env` throughout random files.
- Prefer simple readable code over unnecessary abstractions.
- Avoid adding dependencies unless they solve a real problem.
- Use clear names rather than clever code.

## Security

Never:

- commit `.env`
- expose secrets through `NEXT_PUBLIC_*`
- return GitHub tokens or private keys from API endpoints
- trust repository or installation IDs supplied by the browser without verifying ownership
- process an unsigned or invalid GitHub webhook
- log secrets

Create `.env.example` containing placeholders only.

Authentication and session cookies must be secure and `httpOnly` where applicable. Server-side authorization must protect dashboard APIs.

## AI Usage

AI is a stretch goal and must not block the core GitHub to webhook to rule to GitHub/Slack flow.

If Gemini is later added:

- Issue and PR content must be treated as untrusted data.
- AI output should initially be informational only:
  - summary
  - priority suggestion
  - suggested label
- Do not automatically perform security-sensitive actions based solely on LLM output.

## Development Workflow

The developer is still learning backend integrations and wants to understand the implementation.

Therefore:

1. Do not generate the entire project at once.
2. Work in small milestones.
3. Before implementing a milestone, briefly explain:
   - what we are building
   - why we need it
   - how the flow works
4. After explaining the complete milestone, wait until the developer confirms they understand it and explicitly asks to proceed with implementation.
5. After implementation, explain the important files and how to test them.
6. Suggest a Git commit after meaningful milestones.

Maintain:

- `docs/CHECKLIST.md` for assignment requirements and implementation progress.
- `docs/ai-log.md` for important architecture decisions, developer decisions, alternatives rejected, AI mistakes, debugging problems, incorrect assumptions, and fixes.

The AI log will later be used to write `AI_NOTES.md`. Do not invent entries.

## Planned Milestones

Use approximately this order:

1. Project initialization and architecture
2. Database + Prisma
3. GitHub App configuration
4. GitHub login/authentication
5. Repository installation/connection
6. GitHub webhook endpoint
7. Webhook signature verification
8. Store and deduplicate events
9. Handle issues, pull requests, and pushes
10. Rule engine
11. GitHub label/comment actions
12. Slack integration
13. Authenticated dashboard/activity history
14. Rule configuration UI
15. Failure/retry handling
16. Deployment to Vercel
17. End-to-end production testing
18. Optional Gemini AI triage
19. README, `.env.example`, `AI_NOTES.md`, and final submission testing

## Current Instruction

The developer approved and completed the Project Setup and Database + Persistence milestones on 2026-09-30. Keep those baselines intact.

The developer completed authentication, repository connection, webhook processing, multi-action rules, GitHub/Slack actions, dashboard activity history, rule configuration, manual failure retries, and Vercel deployment. Production verification covers issue and pull-request automation, push recording and Slack delivery, automatic GitHub labeling, expected skipping of GitHub label/comment actions for pushes, bot-loop prevention, dashboard history/failure visibility, and secret exposure checks. Optional Gemini triage is implemented for issue and pull-request rules with persisted structured output and custom/AI content modes; a live Gemini test remains pending until the API key is configured. Do not begin another milestone until it has been explained and explicitly approved.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
