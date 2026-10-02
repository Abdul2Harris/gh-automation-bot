# AI Notes

## Tools and Division of Work

I used OpenAI Codex throughout development as a coding and learning assistant. I worked milestone by milestone: Codex explained each backend integration, proposed an implementation, wrote code and tests after my approval, and helped investigate failures. I reviewed the code, questioned unfamiliar decisions, configured GitHub, Neon, Slack, Gemini, and Vercel, and manually tested the complete workflow in production.

Google Gemini Flash is also used inside the finished product for optional issue and pull-request triage. The configured fallback sequence tries Gemini 3.8 Flash, 3.5 Flash, and 2.5 Flash. Gemini generates a summary, suggested priority and labels, and optional GitHub and Slack messages. Deterministic rules still decide whether automation runs.

The detailed chronological record is in [docs/ai-log.md](docs/ai-log.md).

## Key Decisions I Made

1. **Use one Next.js application instead of a separate Express backend.** Next.js Route Handlers can receive webhooks and serve authenticated APIs while the App Router provides the dashboard. This kept deployment simple on Vercel and avoided maintaining two applications.

2. **Make one deterministic rule support multiple actions.** A matched rule can add a label, post a GitHub comment, and notify Slack instead of requiring duplicate rules. Stored conditions still decide when automation runs; Gemini only improves content and provides informational suggestions.

3. **Review every milestone and test webhooks locally before production.** I decided that each milestone should be explained and reviewed before implementation. I also suggested creating test scripts that generate signed GitHub-like payloads, allowing signature verification, processing, persistence, and deduplication to be tested locally without waiting for a real GitHub webhook.

## Hardest Wrong Turn: Gemini 503 Failures

The hardest debugging problem appeared during live Gemini testing. Requests stayed pending and then failed with HTTP `503`. Because the same API key worked in another application, the initial assumption was that this project's request format, response parsing, or integration code was wrong. AI-assisted fixes focused too heavily on changing integration behavior. Some later changes intended to keep priority and Slack output consistent made the previously working AI path fail again.

I noticed the assumption was wrong by testing through the deployed application, inspecting the recorded HTTP status, and comparing repeated attempts. The failures were transient provider/model availability errors rather than authentication or JSON-validation errors. I reverted the unstable message-processing changes to the last production-confirmed version.

The final fix was bounded resilience instead of continually rewriting parsing logic:

- Try Gemini 3.8 Flash once.
- Fall back to 3.5 Flash once, then 2.5 Flash once.
- If all models return a retryable error, wait with exponential backoff and repeat the complete cycle.
- Persist the failed triage and show it in the dashboard instead of hiding it.
- Retain the existing five-attempt limit for manual action retries.

This taught me to classify external-service errors before changing application logic. A `503` should first be treated as an availability problem, while authentication, malformed requests, and invalid structured responses need different fixes.

## What I Would Improve With More Time

- Process actions in a reliable background queue. The webhook could respond to GitHub immediately while slower GitHub, Slack, or Gemini work continues safely in the background.
- Update the dashboard automatically using polling or Server-Sent Events, so new events and action results appear without manually refreshing the page.
- Automatically retry temporary failures after a delay. Actions that still fail after the retry limit would appear in a separate permanent-failures view.
- Improve monitoring so it is easy to see which webhook failed, which external service caused the failure, how long each service took, and whether the same error keeps happening.
- Let organizations create reusable rule templates for many repositories, while still allowing a specific repository to customize the rule.
- Add full browser tests for important user workflows and more tests for the response formats expected from GitHub, Slack, and Gemini.
- Let users review and approve an AI-suggested label from the dashboard instead of applying it automatically.

## Responsibility and Verification

I did not accept generated code without review. I approved each milestone, supplied and secured service configuration, tested multiple repositories and event types in production, reported incorrect behavior, and chose when to keep or revert changes. Automated checks cover webhook signatures, event normalization, rule matching, GitHub actions, Slack, Gemini fallback, TypeScript, linting, and the production build.
