/**
 * Resend email sender for reminder dispatch.
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/reminders/spec.md
 *   § Requirement: Email Dispatch
 *
 * `sendReminderEmail(application, user)` resolves the application’s
 * reminder context, sends a transactional email via Resend, and writes
 * the outcome to `reminder_dispatches`. Idempotency is enforced via:
 *   1. The unique partial index on `reminder_dispatches` keyed by
 *      `(application_id, sent_at::date)` WHERE `error IS NULL`
 *      (created in 003_reminder_trigger.sql). A second successful
 *      dispatch on the same calendar day is rejected by the DB.
 *   2. The Resend SDK `idempotencyKey` header, so a retry from this
 *      function does not produce a duplicate provider message id.
 *
 * The function never throws on Resend failure: the contract returns a
 * discriminated union so the cron route can record success / failure
 * counts without try/catch noise. The in-app dashboard surface stays
 * unaffected when email fails (spec scenario "Email failure logged").
 *
 * Why a server-side singleton: the Resend SDK holds an HTTP client
 * pool. We initialize one client per process and reuse it across
 * cron invocations to avoid TLS handshake overhead on every reminder.
 */

import { Resend } from "resend";

export const RESEND_FROM_ENV = "RESEND_FROM_EMAIL";
export const RESEND_REPLY_TO_ENV = "RESEND_REPLY_TO";

export type ReminderEmailResult =
  | { status: "sent"; providerMessageId: string; applicationId: string }
  | { status: "skipped"; reason: string; applicationId: string }
  | { status: "failed"; error: string; applicationId: string };

/**
 * The Supabase client type from `@supabase/supabase-js` is generic over
 * the `Database` schema. The cron route creates a service-role client
 * WITHOUT the typed schema (it bypasses RLS anyway), and the typed
 * client from `src/lib/supabase/server.ts` carries the `Database` stub.
 * We accept `unknown` here and cast at the call site so both shapes
 * work; the helper’s behaviour does not depend on the schema generic.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabaseClient = any;

export type ReminderContext = {
  applicationId: string;
  recipientEmail: string;
  recipientName: string | null;
  companyName: string;
  positionTitle: string;
  statusName: string;
  platformName: string | null;
  platformUrl: string;
  nextReminderAt: string | null;
  applicationDate: string;
};

/**
 * Format an ISO timestamp as a short English date. Centralized so the
 * email body, the dashboard, and the cron summary all render dates the
 * same way. `Intl.DateTimeFormat` is built into Node and the Edge
 * runtime, so no dependency is added here.
 */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * Render the reminder email body. Pure HTML, no JS, no remote assets,
 * so it survives every email client’s sanitization. Kept inline so the
 * reminder module owns its own copy; PR 6 may swap in a React Email
 * template if/when one lands.
 */
function renderReminderEmail(ctx: ReminderContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Follow up on your ${ctx.companyName} application`;
  const greeting = ctx.recipientName ? `Hi ${ctx.recipientName},` : "Hi there,";
  const platform = ctx.platformName ?? "the job platform";
  const statusLine = `Current status: ${ctx.statusName}`;
  const appliedLine = `Applied ${formatDate(ctx.applicationDate)}`;
  const dueLine = ctx.nextReminderAt
    ? `Next reminder fires ${formatDate(ctx.nextReminderAt)}.`
    : "This reminder was due today.";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; line-height: 1.5; max-width: 560px;">
      <p style="margin: 0 0 16px;">${greeting}</p>
      <p style="margin: 0 0 16px;">
        Your application for <strong>${ctx.positionTitle}</strong> at
        <strong>${ctx.companyName}</strong> has been quiet for a couple of
        weeks. ${appliedLine} · ${statusLine}.
      </p>
      <p style="margin: 0 0 16px;">
        A short follow-up email or a LinkedIn check-in usually moves things
        forward. You can find the original posting on
        <a href="${ctx.platformUrl}" style="color: #1d4ed8;">${platform}</a>.
      </p>
      <p style="margin: 0 0 16px; color: #475569; font-size: 14px;">
        ${dueLine}
      </p>
      <p style="margin: 24px 0 0;">
        &mdash; gestjobs
      </p>
    </div>
  `.trim();

  const text = [
    greeting,
    "",
    `Your application for ${ctx.positionTitle} at ${ctx.companyName} has been quiet for a couple of weeks. ${appliedLine} · ${statusLine}.`,
    "",
    `A short follow-up email or a LinkedIn check-in usually moves things forward. You can find the original posting on ${platform}: ${ctx.platformUrl}.`,
    "",
    dueLine,
    "",
    "— gestjobs",
  ].join("\n");

  return { subject, html, text };
}

/**
 * Resolve the reminder context for one application by joining the
 * application, status, and platform tables. Returns `null` when the
 * application has no `next_reminder_at` (terminal status or the row
 * has been deleted out from under the cron). The cron route logs and
 * continues; this function is intentionally non-throwing so a single
 * bad row cannot stop the whole batch.
 */
export async function loadReminderContext(
  supabase: AnySupabaseClient,
  applicationId: string,
  userId: string,
): Promise<ReminderContext | null> {
  // Cast at the boundary: the typed Supabase client below uses
  // `Database` (the hand-maintained stub), but this helper is also
  // unit-tested in PR 6 with a stub object. Keeping the call site
  // typed loosely avoids a circular import on `database.types.ts`.
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
    auth: {
      admin: {
        getUserById: (
          id: string,
        ) => Promise<{
          data: { user: { id: string; email: string | null } | null } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data: application, error: applicationError } = await client
    .from("applications")
    .select(
      "id, user_id, company_name, position_title, platform_url, application_date, next_reminder_at, status:statuses(id, name, is_terminal), platform:platforms(id, name, hostname)",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError || !application) {
    return null;
  }

  const typed = application as {
    id: string;
    user_id: string;
    company_name: string;
    position_title: string;
    platform_url: string;
    application_date: string;
    next_reminder_at: string | null;
    status:
      | { id: string; name: string; is_terminal: boolean | null }
      | { id: string; name: string; is_terminal: boolean | null }[]
      | null;
    platform:
      | { id: string; name: string; hostname: string }
      | { id: string; name: string; hostname: string }[]
      | null;
  };

  if (typed.user_id !== userId) {
    return null;
  }

  if (typed.status && (Array.isArray(typed.status) ? typed.status[0]?.is_terminal : typed.status.is_terminal)) {
    return null;
  }

  if (!typed.next_reminder_at) {
    return null;
  }

  const { data: authData, error: authError } = await client.auth.admin.getUserById(userId);
  if (authError || !authData?.user?.email) {
    return null;
  }

  const statusRow = Array.isArray(typed.status) ? typed.status[0] : typed.status;
  const platformRow = Array.isArray(typed.platform) ? typed.platform[0] : typed.platform;

  return {
    applicationId: typed.id,
    recipientEmail: authData.user.email,
    recipientName: null,
    companyName: typed.company_name,
    positionTitle: typed.position_title,
    statusName: statusRow?.name ?? "Unknown",
    platformName: platformRow?.name ?? null,
    platformUrl: typed.platform_url,
    nextReminderAt: typed.next_reminder_at,
    applicationDate: typed.application_date,
  };
}

/**
 * Build a stable idempotency key per (application, calendar day) so a
 * cron retry within the same UTC day does not produce duplicate
 * Resend message ids. Matches the partial unique index on
 * `reminder_dispatches` created in `003_reminder_trigger.sql`.
 */
export function reminderIdempotencyKey(applicationId: string, when: Date): string {
  const day = when.toISOString().slice(0, 10);
  return `reminder/${applicationId}/${day}`;
}

let cachedResend: Resend | null = null;

/**
 * Lazy singleton — the SDK caches an HTTP keep-alive agent, so
 * instantiating on every send wastes a TCP handshake. Re-instantiating
 * after a `RESEND_API_KEY` change is rare enough that we accept the
 * restart cost over the alternative.
 */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!cachedResend) {
    cachedResend = new Resend(apiKey);
  }
  return cachedResend;
}

/**
 * Send a reminder email for one application and record the dispatch.
 *
 * Returns a discriminated union so the cron route can summarize
 * `sent` / `skipped` / `failed` counts without try/catch noise. The
 * function never throws; Resend SDK errors are caught and converted to
 * `{ status: "failed", error }` so the cron route stays linear.
 */
export async function sendReminderEmail(
  supabase: AnySupabaseClient,
  ctx: ReminderContext,
  now: Date = new Date(),
): Promise<ReminderEmailResult> {
  const from = process.env[RESEND_FROM_ENV];
  if (!from) {
    return {
      status: "failed",
      error: `${RESEND_FROM_ENV} is not configured.`,
      applicationId: ctx.applicationId,
    };
  }

  const resend = getResendClient();
  if (!resend) {
    return {
      status: "failed",
      error: "RESEND_API_KEY is not configured.",
      applicationId: ctx.applicationId,
    };
  }

  const { subject, html, text } = renderReminderEmail(ctx);
  const idempotencyKey = reminderIdempotencyKey(ctx.applicationId, now);
  const replyTo = process.env[RESEND_REPLY_TO_ENV];

  try {
    const { data, error } = await resend.emails.send(
      {
        from,
        to: [ctx.recipientEmail],
        subject,
        html,
        text,
        ...(replyTo ? { replyTo: [replyTo] } : {}),
        tags: [
          { name: "feature", value: "reminders" },
          { name: "application_id", value: ctx.applicationId },
        ],
      },
      { idempotencyKey },
    );

    if (error) {
      await recordDispatch(supabase, ctx.applicationId, now, {
        providerMessageId: null,
        error: error.message,
      });
      return {
        status: "failed",
        error: error.message,
        applicationId: ctx.applicationId,
      };
    }

    const providerMessageId = data?.id ?? null;
    await recordDispatch(supabase, ctx.applicationId, now, {
      providerMessageId,
      error: null,
    });

    if (!providerMessageId) {
      return {
        status: "skipped",
        reason: "Resend returned no message id.",
        applicationId: ctx.applicationId,
      };
    }

    return {
      status: "sent",
      providerMessageId,
      applicationId: ctx.applicationId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    await recordDispatch(supabase, ctx.applicationId, now, {
      providerMessageId: null,
      error: message,
    });
    return {
      status: "failed",
      error: message,
      applicationId: ctx.applicationId,
    };
  }
}

async function recordDispatch(
  supabase: AnySupabaseClient,
  applicationId: string,
  sentAt: Date,
  payload: { providerMessageId: string | null; error: string | null },
): Promise<void> {
  const client = supabase as {
    from: (table: string) => {
      insert: (values: {
        application_id: string;
        sent_at: string;
        provider_message_id: string | null;
        error: string | null;
      }) => Promise<{ error: { message: string } | null }>;
    };
  };

  await client.from("reminder_dispatches").insert({
    application_id: applicationId,
    sent_at: sentAt.toISOString(),
    provider_message_id: payload.providerMessageId,
    error: payload.error,
  });
}
