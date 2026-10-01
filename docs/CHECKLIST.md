# Project Checklist

Use this checklist to track assignment requirements and implementation progress for the Event-Driven GitHub Automation Bot.

## Project Setup

- [x] Initialize Next.js with App Router
- [x] Configure TypeScript
- [x] Configure Tailwind CSS
- [x] Add Ant Design for dashboard UI, forms, tables, and controls
- [x] Create `.env.example` with placeholders only
- [x] Configure centralized environment validation with Zod
- [x] Confirm all selected services have free/no-credit-card options (verified 2026-09-30; see `README.md`)

## Database + Persistence

- [x] Set up Neon PostgreSQL
- [x] Add Prisma ORM
- [x] Create shared Prisma database module
- [x] Model users; defer session storage until the authentication strategy requires it
- [x] Model GitHub installations/repositories
- [x] Model received webhook events
- [x] Add `UNIQUE` constraint for GitHub delivery IDs
- [x] Model attempted bot actions with success/failure state
- [x] Model rule configuration

## GitHub App + Authentication

- [x] Create GitHub App
- [x] Configure GitHub App permissions
- [x] Add server-only Octokit GitHub App client
- [x] Verify GitHub App credentials with `npm run github:check`
- [x] Configure installation flow
- [x] Implement GitHub login/authentication
- [x] Protect dashboard routes and APIs
- [x] Verify repository and installation ownership server-side

## Webhooks

- [x] Add GitHub webhook Route Handler
- [x] Read and preserve raw request body for signature verification
- [x] Verify HMAC signature for every webhook
- [x] Use `X-GitHub-Delivery` as the delivery identifier
- [x] Store webhook events before executing actions
- [x] Deduplicate events by delivery ID
- [x] Ignore bot-generated events where needed
- [x] Normalize webhook payloads before rule processing
- [x] Support `issues`
- [x] Support `pull_request`
- [x] Support `push`

## Rule Engine

- [x] Create rule evaluation module
- [x] Support issue opened rules
- [x] Support pull request opened rules
- [x] Support simple title/body matching
- [x] Keep rule evaluation separate from route handling
- [x] Record skipped rules or unmatched events where useful
- [x] Support multiple ordered actions in one rule

## Actions

- [x] Add GitHub label action
- [x] Add GitHub comment action
- [x] Add Slack Incoming Webhook notification action
- [x] Record every attempted action
- [x] Record action success or failure
- [x] Keep failed actions visible in database/dashboard
- [x] Avoid silently swallowing GitHub, Slack, or database errors

## Dashboard

- [x] Build authenticated dashboard layout
- [x] Show received webhook events
- [x] Show action history
- [x] Show failures clearly
- [x] Show configured rules
- [x] Add rule configuration UI
- [x] Use Ant Design tables for event/action history where appropriate
- [x] Use Ant Design forms and controls for rule configuration
- [x] Ensure secrets are never exposed to client components

## Failure + Retry Handling

- [x] Add retry controls for retryable failed actions
- [x] Verify action-attempt ownership before retrying
- [x] Prevent concurrent retries with an atomic database claim
- [x] Track retry count and latest retry time
- [x] Limit manual retries to five attempts
- [x] Do not retry invalid configuration or missing integration setup
- [x] Preserve the latest retry result and error in action history

## Deployment

- [ ] Deploy to Vercel
- [ ] Configure production environment variables
- [ ] Confirm webhook URL points to production
- [ ] Confirm serverless-compatible processing
- [ ] Avoid architectures requiring a persistent worker

## Testing + Verification

- [x] Test GitHub login
- [x] Test GitHub App installation
- [x] Test webhook signature verification
- [x] Test duplicate webhook delivery handling
- [ ] Test issue opened automation
- [ ] Test pull request opened automation
- [ ] Test push event recording
- [x] Test GitHub label action
- [x] Test GitHub comment action
- [x] Test Slack notification action
- [ ] Test failure visibility in dashboard
- [x] Test authorization on dashboard APIs
- [ ] Confirm no secrets are logged or exposed
- [ ] Run final end-to-end production test

## Optional Gemini AI Triage

- [ ] Add only after the complete core flow works
- [ ] Treat issue/PR content as untrusted data
- [ ] Generate summary
- [ ] Generate priority suggestion
- [ ] Generate suggested label
- [ ] Keep AI output informational only at first
- [ ] Do not automatically perform security-sensitive actions based solely on LLM output

## Final Submission

- [ ] Update README
- [ ] Update `AI_NOTES.md` from real `docs/ai-log.md` entries
- [ ] Confirm `.env` is not committed
- [ ] Confirm `.env.example` contains placeholders only
- [ ] Run final lint/type/test checks
- [ ] Document how to run and test the project
- [ ] Suggest final Git commit

