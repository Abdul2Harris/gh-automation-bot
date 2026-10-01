# GitHub App Setup

Create the app under **GitHub Settings > Developer settings > GitHub Apps > New GitHub App**.

## URLs

Replace `APP_URL` with the public HTTPS URL for the application:

- Homepage URL: `APP_URL`
- Callback URL: `APP_URL/api/auth/github/callback`
- Webhook URL: `APP_URL/api/github/webhooks`

Keep **Request user authorization (OAuth) during installation** enabled. GitHub
will return installation flows to the callback URL, so the Setup URL remains
unavailable and is not needed. A public deployment or development tunnel is
required before GitHub can deliver webhooks. Leave webhooks inactive until that
URL is available.

Keep **Expire user authorization tokens** enabled. During development, select **Only on this account** for installation availability.

## Repository permissions

- Contents: Read-only
- Issues: Read and write
- Metadata: Read-only
- Pull requests: Read and write

Leave all other permissions at **No access** unless a later feature requires them.

## Webhook events

When the webhook URL is available, enable webhooks with SSL verification and subscribe to:

- Issues
- Pull request
- Push
- Installation
- Installation repositories

## Credentials

After creating the app:

1. Copy the App ID, Client ID, and a generated client secret into `.env`.
2. Generate a private key, convert its line breaks to `\\n`, and set `GITHUB_PRIVATE_KEY` on one line.
3. Generate a random webhook secret of at least 32 characters and use the same value in GitHub and `.env`.
4. Run `npm run github:check` to authenticate as the app.

Never commit the `.env` file or the downloaded `.pem` file.
