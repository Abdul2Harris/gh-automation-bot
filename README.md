# Event-Driven GitHub Automation Bot

A full-stack GitHub App that receives repository events, evaluates configurable automation rules, performs GitHub and Slack actions, and records the complete execution history in an authenticated dashboard.

## Features

- GitHub OAuth login with database-backed, HttpOnly sessions
- GitHub App installation and multi-repository synchronization
- Signed webhook handling for issues, pull requests, and pushes
- Database-level delivery deduplication
- Repository-specific and installation-wide automation rules
- Case-insensitive title and body conditions
- Multiple ordered actions in one rule
- GitHub label and comment actions
- Slack Incoming Webhook notifications
- Optional Gemini issue and pull-request triage
- Action failure history and up to five authorized manual retries
- Rule creation, editing, enable/disable, and deletion with optimistic UI
- Authenticated Ant Design dashboard for events, actions, rules, and repositories

## Architecture

The project is one Next.js App Router application. It does not require a separate Express server or persistent worker.

```text
GitHub OAuth / App installation
            |
            v
Next.js Route Handlers -----> Neon PostgreSQL via Prisma
            |
GitHub webhook (raw body)
            |
HMAC verification -> persistence/deduplication -> normalization
            |
rule evaluation -> optional Gemini triage -> GitHub / Slack actions
            |
action attempts, outcomes, and errors -> authenticated dashboard
```

Important module boundaries:

- `src/app`: pages and Route Handlers
- `src/lib/auth`: sessions and GitHub OAuth
- `src/lib/github`: GitHub App clients, webhook verification, and actions
- `src/lib/events`: webhook normalization, persistence, and processing
- `src/lib/rules`: rule validation, evaluation, and management
- `src/lib/slack`: Slack formatting and delivery
- `src/lib/ai`: Gemini triage and model fallback
- `src/lib/dashboard`: authorized dashboard data access
- `src/lib/db`: shared Prisma client
- `src/components/dashboard`: Ant Design dashboard UI

## Technology

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS and Ant Design
- Neon PostgreSQL and Prisma ORM
- GitHub Apps and Octokit
- Slack Incoming Webhooks
- Google Gemini API
- Zod
- Vercel

## Local Setup

Requirements:

- Node.js 20.9 or newer
- npm
- Neon PostgreSQL database
- GitHub App

Install dependencies and create the local environment file:

```bash
npm install
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead.

Generate Prisma Client, apply committed migrations, and start Next.js:

```bash
npm run db:generate
npm run db:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Yes | Application origin, such as `http://localhost:3000` |
| `AUTH_SECRET` | Yes | At least 32 random characters for authentication state |
| `DATABASE_URL` | Yes | Pooled Neon PostgreSQL runtime URL |
| `DIRECT_URL` | Yes | Direct Neon URL used by Prisma migrations |
| `GITHUB_APP_ID` | Yes | GitHub App numeric ID |
| `GITHUB_CLIENT_ID` | Yes | GitHub App OAuth client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub App OAuth client secret |
| `GITHUB_PRIVATE_KEY` | Yes | Complete PEM private key, including BEGIN/END lines |
| `GITHUB_WEBHOOK_SECRET` | Yes | Shared webhook secret of at least 32 characters |
| `SLACK_WEBHOOK_URL` | Optional | Server-only Slack Incoming Webhook URL |
| `GEMINI_API_KEY` | Optional | Server-only Gemini API key |

For hosted environments, preserve private-key line breaks using `\n` if multiline values are not supported. Never prefix secrets with `NEXT_PUBLIC_`.

## GitHub App Setup

Follow [docs/GITHUB_APP_SETUP.md](docs/GITHUB_APP_SETUP.md).

Use these URLs, replacing `APP_URL` with the deployed HTTPS origin:

```text
Homepage: APP_URL
Callback: APP_URL/api/auth/github/callback
Webhook:  APP_URL/api/github/webhooks
```

Required repository permissions:

- Contents: Read-only
- Issues: Read and write
- Metadata: Read-only
- Pull requests: Read and write

Subscribe to Issues, Pull request, Push, Installation, and Installation repositories events. Use the same webhook secret in GitHub and the application environment.

Verify the configured credentials:

```bash
npm run github:check
```

## Rules and Actions

A rule is scoped to one repository or every repository in an installation. Issue and pull-request rules may match the title, body, or either field. Push rules are trigger-only.

A rule can contain each supported action once:

- Add GitHub labels
- Post a GitHub comment
- Send a Slack notification

Comment and Slack content may be custom or Gemini-generated. Suggested AI labels and priorities are informational; repository labels are applied only from deterministic rule configuration.

## Gemini Triage

Gemini runs only when a matched comment or Slack action selects AI-generated content. Issue and pull-request text is treated as untrusted input. One structured result is reused across all AI-enabled actions for the event and persisted with its summary, suggested priority, suggested labels, GitHub comment, Slack message, model, and processing status.

The model sequence is `gemini-3.8-flash`, `gemini-3.5-flash`, then `gemini-2.5-flash`. Each model is attempted once before retrying the complete sequence with bounded backoff.

## Security and Reliability

- Webhooks are verified against the unchanged raw body using HMAC-SHA256.
- Signatures are compared with a constant-time operation.
- `X-GitHub-Delivery` has a database `UNIQUE` constraint.
- Events are saved before external actions run.
- Each event/rule-action combination is executed at most once.
- Bot-generated events are ignored to prevent automation loops.
- Dashboard queries and writes verify installation ownership server-side.
- Session tokens are random; only their SHA-256 hashes are stored in Neon.
- Session cookies are HttpOnly, same-site, and secure in production.
- Secrets and raw webhook payloads are not sent to client components.
- External-action failures remain visible and retryable where appropriate.

## Testing

Run the complete local verification suite:

```bash
npm run lint
npm run typecheck
npm run test:webhooks
npm run test:events
npm run test:rules
npm run test:rule-input
npm run test:github-actions
npm run test:slack
npm run test:ai
npm run build
```

Database and integration checks:

```bash
npm run db:check
npm run db:status
npm run github:check
```

With the development server running, `npm run test:webhook-persistence` sends signed local test deliveries, verifies processing and deduplication, and removes its temporary data.

Mocked unit tests do not modify GitHub or Slack. Final end-to-end verification requires the deployed webhook URL and a real test repository.

## Deployment

1. Import the repository into Vercel.
2. Add all required environment variables.
3. Apply migrations with `npm run db:deploy`.
4. Deploy the application.
5. Configure the production callback and webhook URLs in the GitHub App.
6. Install the GitHub App on selected repositories.
7. Create a rule and open a matching issue or pull request.
8. Confirm the event, action results, GitHub changes, Slack notification, and optional AI triage in the dashboard.

The webhook processing design is serverless-compatible and does not depend on a continuously running process.

## Database Commands

```bash
npm run db:generate
npm run db:migrate -- --name describe_your_change
npm run db:deploy
npm run db:status
npm run db:studio
```

## Project Documentation

- [Implementation checklist](docs/CHECKLIST.md)
- [GitHub App setup](docs/GITHUB_APP_SETUP.md)
- [AI development log](docs/ai-log.md)
- [AI usage notes](AI_NOTES.md)

## Known Limitations

- Only opened issues and opened pull requests are automated initially.
- Push rules do not perform GitHub label or comment actions.
- Retry processing is manual and capped at five retries per action.
- The dashboard shows the 100 most recent events, actions, and rules.
- Gemini output is probabilistic and may occasionally fail or vary; deterministic rule matching remains the automation boundary.
