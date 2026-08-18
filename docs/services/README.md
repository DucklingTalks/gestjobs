# Service provisioning

Use these guides before continuing implementation or enabling a preview deployment.

## Provisioning order

1. [Supabase](supabase.md) — database, Auth, Storage, migrations, and RLS.
2. [Resend](resend.md) — reminder email delivery and sender-domain verification.
3. [Vercel](vercel.md) — preview/production deployment and scheduled cron requests.
4. [GitHub Actions](github-actions.md) — CI checks and branch protection.

The public GitHub repository already exists: [Sr-Lechuga/gestjobs](https://github.com/Sr-Lechuga/gestjobs).

## Completion checklist

- [ ] Supabase project created; migrations and seed applied.
- [ ] Supabase keys copied to `.env.local` and Vercel.
- [ ] Resend account, API key, verified sender domain, and reply-to configured.
- [ ] Vercel project connected with production and preview variables.
- [ ] `CRON_SECRET` configured in Vercel and cron endpoint protected.
- [ ] GitHub Actions workflow and required branch checks enabled.
- [ ] No secrets committed to Git.
