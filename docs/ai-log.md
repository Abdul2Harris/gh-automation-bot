# AI Log

This log records real project decisions, mistakes, debugging notes, and fixes. It will later be used to prepare `AI_NOTES.md`.

Do not invent entries. Add notes only when something meaningful happens.

## Architecture Decisions

- 2026-09-30: Initialized a single Next.js App Router application with strict TypeScript, Tailwind CSS, and Ant Design. Ant Design's Next.js registry is mounted in the root layout so its server-rendered styles work with the App Router.
- 2026-09-30: Centralized server environment parsing in `src/lib/env.ts`. Validation is lazy so framework builds do not require deployment secrets, while runtime integration code gets one validated, typed configuration object.
- 2026-09-30: Added Prisma 6.12 with Neon PostgreSQL. Runtime queries use the pooled URL through the standard PostgreSQL adapter, while migrations use a direct Neon URL.
- 2026-09-30: Modeled users, installation access, GitHub installations, repositories, webhook events, automation rules, and action attempts. Database-backed sessions are deferred until the authentication strategy is selected.
- 2026-09-30: Enforced webhook idempotency at the database level with a unique `deliveryId` index.
- 2026-09-30: Added a lazy, server-only Octokit GitHub App client and kept app registration as an explicit developer-owned GitHub settings step.
- 2026-09-30: Selected database-backed authentication sessions. Browsers receive a random HttpOnly cookie, while Neon stores only its SHA-256 hash and expiry; GitHub user tokens are not persisted for login.
- 2026-09-30: Installation ownership is verified with the temporary GitHub App user token by calling GitHub's user-installations endpoint. Only installations GitHub confirms the signed-in user can access are associated in Neon; the user token is discarded after synchronization.
- 2026-10-01: Added a raw-body GitHub webhook endpoint that requires delivery, event, and HMAC-SHA256 signature headers. Signature comparison uses Node's constant-time comparison before JSON parsing; persistence remains a separate milestone.
- 2026-10-01: Verified webhook deliveries are persisted with status `RECEIVED` before any action processing. The database `deliveryId` unique constraint is the idempotency boundary; duplicate deliveries return success without creating another row.
- 2026-10-01: Added a Zod-backed event normalization boundary for issue opened, pull request opened, and push events. Supported payloads become a discriminated internal event type; unsupported actions and bot senders are ignored, while malformed supported payloads remain visible as failed events.
- 2026-10-01: Added a pure rule evaluator separated from database access and route handling. Enabled rules are scoped to the event installation and either its repository or the installation-wide scope; issue and pull request rules support case-insensitive title/body matching, while push rules are trigger-only. A processed event with zero matches represents an unmatched event.
- 2026-10-01: Added GitHub label and comment action execution through installation-authenticated Octokit. Each matched GitHub action creates a `PENDING` attempt before the external request and ends as `SUCCEEDED`, `FAILED`, or `SKIPPED`; a unique event/rule/type index provides action-level idempotency. Action configuration is validated with Zod, and only safe request/response summaries are persisted.
- 2026-10-01: Added Slack Incoming Webhook actions using a server-only `SLACK_WEBHOOK_URL`. The secret URL is not stored in rule configuration or action history. Slack rules may store an optional message prefix, normalized GitHub event text is escaped to prevent unintended Slack mentions, and delivery failures remain visible as failed action attempts.
- 2026-10-01: Added an authenticated activity dashboard backed by a server-only data-access module. Every query is scoped through the signed-in user's installation mappings, and only minimal display DTOs reach the client. Ant Design tables show recent events, action outcomes, failures, rules, and repositories with status/type filters; raw webhook payloads and action request/response JSON remain server-side.
- 2026-10-01: Refactored automation rules to own ordered `AutomationRuleAction` records. Existing single actions and historical attempts are migrated and relinked, while new action idempotency uses the event and rule-action IDs. Added authenticated, same-origin rule APIs with Zod validation and installation/repository ownership checks, plus dashboard controls to create, enable, disable, and delete multi-action rules.
- 2026-10-01: Added manual retry handling on the existing action-attempt row. Retryable external failures can be atomically claimed and rerun by an authorized user; retry count and timestamp are recorded. Invalid action configuration, missing Slack setup, skipped actions, deleted rule actions, successful actions, and concurrent retries are rejected.
- 2026-10-01: Capped manual action retries at five. The database claim checks the retry count atomically; after the fifth failed retry, the attempt becomes non-retryable and shows a retry-limit message directing the user to check permissions or configuration.
- 2026-10-01: Added optional Gemini triage for matched issue and pull-request rules. A single structured response per webhook is Zod-validated and persisted with its summary, suggested priority, suggested labels, GitHub comment, Slack message, model, and failure state. Existing deterministic rule matching still decides whether an action runs; AI suggested labels remain informational and are not applied automatically.
- 2026-10-01: Rule comment and Slack actions now support either custom or AI-generated content while retaining backward compatibility with existing rule configuration. AI failure does not prevent custom actions from running, and failed AI-backed actions remain visible and manually retryable.
- 2026-10-01: After live Gemini requests repeatedly returned HTTP 503, added three automatic retries with exponential backoff and jitter for transient HTTP 408, 429, and selected 5xx responses. Permanent client errors still fail immediately, and the existing five-attempt manual retry limit remains unchanged.
- 2026-10-01: Added ordered Gemini model fallback after repeated production 503 responses. AI triage first tries `gemini-3.8-flash`, then `gemini-3.5-flash`, and finally `gemini-2.5-flash`; the successful model is persisted with the triage result.
- 2026-10-01: Optimized Gemini fallback latency after live testing. Each retry cycle now attempts `3.8`, `3.5`, and `2.5` once before waiting with exponential backoff and repeating the complete model sequence.
- 2026-10-01: Simplified dashboard failure presentation after live usage. Removed the persistent failure warning banner, kept the Actions tab count focused on total actions, and added a latest-failed indicator only when the newest action failed.
- 2026-10-01: Updated the Rules table to show whether GitHub comment and Slack actions use AI-generated or custom content, without exposing the configured message bodies to the client.
- 2026-10-01: Added full rule editing and optimistic dashboard updates. Create, edit, enable/disable, and delete operations update local UI state immediately and roll back on API failure, while database access, same-origin protection, ownership checks, and Zod validation remain server-side. Editing preserves existing rule-action records by action type so historical attempts keep their links.
- 2026-10-02: Added a deterministic triage priority override after live multi-repository testing showed Gemini classifying a critical UI issue as medium. Issue or pull-request title/body containing `critical` now forces `HIGH`; other priorities remain Gemini suggestions.

## Developer Decisions

- 2026-09-30: Before each new milestone, explain the complete implementation and wait until the developer confirms understanding and explicitly approves proceeding.
- 2026-10-01: The developer decided that one matched automation rule should perform multiple actions, such as adding a GitHub label, posting a GitHub comment, and notifying Slack, instead of requiring separate rules for each destination.
- 2026-10-01: The developer approved Gemini-generated GitHub comments and Slack messages after deterministic rule matching, with one AI call reused for both destinations and triage details shown in the dashboard.

## Production Verification

- 2026-10-01: The developer confirmed the Vercel deployment milestone was completed. In production, a GitHub webhook was received and verified, the event was stored, an issue rule matched, a GitHub label was added automatically, bot-triggered events were ignored without an automation loop, and the dashboard displayed the complete history.
- 2026-10-01: The developer also verified pull-request-opened automation and push-event processing in production. A push rule sent its Slack notification, while GitHub label/comment actions were correctly not applied to the push. The developer checked dashboard failure visibility and confirmed no secrets were logged or exposed; no production failure occurred during this test run.
- 2026-10-01: The developer verified Gemini triage in production after adding ordered model fallback. A matched pull request completed successfully, posted its AI-generated GitHub comment, sent its AI-generated Slack notification, and exposed no new errors.

## Alternatives Rejected

- 2026-09-30: Did not adopt Prisma 8 because its PostgreSQL package is still a release candidate. Prisma 7 was also rejected after npm reported high-severity CLI dependency advisories and a Node 22 engine warning.
- 2026-09-30: Replaced the Neon WebSocket adapter with Prisma's PostgreSQL adapter after the WebSocket transport failed in the local Node environment.
- 2026-09-30: Pinned Octokit 4.1.4 because the latest release pulled a transitive package requiring Node 22 while the project uses Node 20.

## AI Mistakes

<!-- Add dated entries here. -->

## Debugging Problems

- 2026-09-30: `create-next-app` would not scaffold directly into the non-empty project root because `AGENTS.md` already existed. The app was generated in a temporary child directory and merged into the root without replacing the planning files.
- 2026-09-30: The first production build failed because the generated `next/font` configuration tried to fetch Geist from Google Fonts in a network-restricted environment.
- 2026-09-30: Prisma 6.12 required the `driverAdapters` preview feature before accepting a database adapter.
- 2026-09-30: ESLint initially scanned the generated Prisma client and reported errors in generated code.
- 2026-09-30: GitHub App JWT authentication initially failed because the Windows clock was about two minutes ahead; syncing the system clock fixed credential verification.
- 2026-10-01: Prisma returned `P2002` for a duplicate webhook delivery, but `instanceof PrismaClientKnownRequestError` failed across the bundled runtime boundary. Deduplication now uses a guarded `code === "P2002"` check.
- 2026-10-01: Prisma client generation initially failed because a background Next.js process locked the Windows query-engine DLL. Stopping only the project development processes allowed generation to complete.

## Incorrect Assumptions

- 2026-09-30: The initial GitHub App guide listed a separate Setup URL while also enabling OAuth during installation. GitHub makes Setup URL unavailable in that mode and returns installation authorization through the OAuth callback, so the guide was corrected.

## Fixes

- 2026-09-30: Replaced the build-time Google Fonts dependency with local system font stacks so development, CI, and production builds do not depend on an external font download.
- 2026-09-30: Enabled Prisma's driver-adapter feature, used the PostgreSQL adapter, and excluded generated Prisma files from ESLint and Git.
