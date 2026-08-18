# Resend setup

Resend will deliver the 15-day follow-up emails planned for Reminders + Dashboard.

## Account and domain

1. Create an account at [resend.com](https://resend.com/).
2. Add a sending domain you control. A personal domain is recommended; avoid using an unverified free-mail address as the sender.
3. Add the DNS records Resend provides (SPF, DKIM, and any return-path records).
4. Wait until the domain is marked **Verified**.
5. Create an API key with the minimum permissions needed to send mail.

## Environment variables

Add these values to `.env.local` and Vercel. Do not commit them:

```dotenv
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=GestJobs <noreply@your-domain.com>
RESEND_REPLY_TO=you@example.com
```

Use the verified domain in `RESEND_FROM_EMAIL`. The current code template contains these variables; the reminder sender is implemented in the Reminders phase.

## Validation

- Send a test email from the verified domain.
- Confirm the reply-to address is correct.
- Check delivery, bounce, and spam events in Resend.
- Record the daily free-tier limit before enabling cron in production.
