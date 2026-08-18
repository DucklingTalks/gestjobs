# Vercel setup

Vercel will host the Next.js application and invoke the scheduled reminder endpoint.

## Create the project

1. Create an account at [vercel.com](https://vercel.com/).
2. Import `Sr-Lechuga/gestjobs` from GitHub.
3. Keep the detected Next.js build settings.
4. Use the free Hobby plan for personal development, subject to its current limits.

## Environment variables

Configure these in **Project Settings → Environment Variables** for Preview and Production as appropriate:

| Variable | Value/source |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Preview or production URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings; server-only |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified Resend sender |
| `RESEND_REPLY_TO` | Reply-to address |
| `CRON_SECRET` | Long random secret, unique per environment |

Generate a cron secret locally:

```bash
openssl rand -hex 32
```

## Deploy and configure URLs

- Push a branch to create a Preview deployment.
- Add the Preview and Production URLs to Supabase Auth redirect settings.
- Set `NEXT_PUBLIC_APP_URL` separately for each environment.
- Add a custom domain only if desired; it is not required for the MVP.

The `vercel.json` cron configuration is added in the Reminders phase. Verify the cron request includes the expected `CRON_SECRET` and does not expose it client-side.
