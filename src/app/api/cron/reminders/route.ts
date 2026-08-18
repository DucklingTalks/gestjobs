/**
 * Cron route — POST /api/cron/reminders
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/reminders/spec.md
 *   § Requirement: Email Dispatch
 *
 * Authorization: shared `CRON_SECRET` header. The route rejects every
 * request without the header (401) and every request with a wrong value
 * (403). The secret is set per-environment via `vercel.json` env or the
 * Vercel dashboard. The header name is `Authorization: Bearer <secret>`
 * to match the convention other Vercel cron examples use; `X-Cron-Secret`
 * is accepted as a fallback so external cron services (GitHub Actions,
 * cron-job.org) that only support custom headers work too.
 *
 * Method policy: POST only. GET returns 410 (consistent with the
 * rollback plan in `openspec/changes/gestjobs-mvp/tasks.md` § 5.8 —
 * "Dashboard degrades to empty pending section; cron route returns
 * 410"). Other methods return 405.
 *
 * Vercel cron note: `vercel.json` schedules a daily 09:00 UTC cron,
 * but Vercel cron fires GET requests natively. This route intentionally
 * does NOT accept GET, so a deployment-time wrapper (a serverless
 * function or external cron service) is required to translate the
 * Vercel cron into a POST with `CRON_SECRET`. Documented in
 * `apply-progress.md` § "Issues Found".
 *
 * Why service-role client: cron has no authenticated user. The route
 * uses `SUPABASE_SERVICE_ROLE_KEY` to query every due application
 * across users, send the email, and write the dispatch row. RLS does
 * not apply for the service role, so the route must enforce its own
 * "due = `next_reminder_at <= now()` AND non-terminal status" filter
 * (see `loadReminderContext`).
 */

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { loadReminderContext, sendReminderEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_SECRET_ENV = "CRON_SECRET";
const APP_URL_ENV = "NEXT_PUBLIC_APP_URL";

type DueApplication = {
  id: string;
  user_id: string;
};

type CronSummary = {
  ok: true;
  dispatchedAt: string;
  totals: { due: number; sent: number; skipped: number; failed: number };
  results: Array<
    | { applicationId: string; status: "sent"; providerMessageId: string }
    | { applicationId: string; status: "skipped"; reason: string }
    | { applicationId: string; status: "failed"; error: string }
  >;
};

function unauthorized(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function methodNotAllowed() {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: { allow: "POST" },
  });
}

function cronGone() {
  // Mirrors the rollback plan in tasks.md § 5.8: a reverted PR 5 returns
  // 410 from this route, so a stale Vercel cron entry does not produce
  // unexpected behaviour after rollback.
  return new NextResponse("Gone", { status: 410 });
}

function extractSecret(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match) return match[1].trim();
  }
  const fallback = request.headers.get("x-cron-secret");
  if (fallback) return fallback.trim();
  return null;
}

export async function GET() {
  // The route is POST-only by spec. Returning 410 matches the PR 5
  // rollback plan so a reverted deployment still responds coherently.
  return cronGone();
}

export async function POST(request: Request) {
  const expectedSecret = process.env[CRON_SECRET_ENV];
  if (!expectedSecret) {
    return unauthorized(`${CRON_SECRET_ENV} is not configured.`, 503);
  }

  const providedSecret = extractSecret(request);
  if (!providedSecret) {
    return unauthorized("Missing cron authorization.", 401);
  }
  if (providedSecret !== expectedSecret) {
    return unauthorized("Invalid cron secret.", 403);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return unauthorized("Supabase service role is not configured.", 503);
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const dispatchedAt = new Date();
  const dueApplications = await selectDueApplications(
    supabase as unknown as Parameters<typeof selectDueApplications>[0],
    dispatchedAt,
  );

  const summary: CronSummary = {
    ok: true,
    dispatchedAt: dispatchedAt.toISOString(),
    totals: {
      due: dueApplications.length,
      sent: 0,
      skipped: 0,
      failed: 0,
    },
    results: [],
  };

  for (const application of dueApplications) {
    const ctx = await loadReminderContext(supabase, application.id, application.user_id);
    if (!ctx) {
      summary.totals.skipped += 1;
      summary.results.push({
        applicationId: application.id,
        status: "skipped",
        reason: "No active reminder context (terminal status or missing row).",
      });
      continue;
    }

    const result = await sendReminderEmail(supabase, ctx, dispatchedAt);
    if (result.status === "sent") {
      summary.totals.sent += 1;
      summary.results.push({
        applicationId: result.applicationId,
        status: "sent",
        providerMessageId: result.providerMessageId,
      });
    } else if (result.status === "skipped") {
      summary.totals.skipped += 1;
      summary.results.push({
        applicationId: result.applicationId,
        status: "skipped",
        reason: result.reason,
      });
    } else {
      summary.totals.failed += 1;
      summary.results.push({
        applicationId: result.applicationId,
        status: "failed",
        error: result.error,
      });
    }
  }

  return NextResponse.json(summary, { status: 200 });
}

export async function PUT() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

/**
 * Select every application whose `next_reminder_at` is overdue and
 * whose status is non-terminal. The query joins `applications`,
 * `statuses`, and filters out rows that already had a successful
 * dispatch today (the dashboard's "dismissed" predicate — a
 * `reminder_dispatches` row with `error IS NULL` for the same
 * `application_id` on the current calendar day).
 */
async function selectDueApplications(
  supabase: ReturnType<typeof createSupabaseClient>,
  dispatchedAt: Date,
): Promise<DueApplication[]> {
  const todayUtc = dispatchedAt.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, user_id, status:statuses!applications_status_id_fkey(id, is_terminal)",
    )
    .lte("next_reminder_at", dispatchedAt.toISOString())
    .not("next_reminder_at", "is", null);

  if (error || !data) {
    return [];
  }

  const filtered = (data as Array<{
    id: string;
    user_id: string;
    status:
      | { id: string; is_terminal: boolean | null }
      | { id: string; is_terminal: boolean | null }[]
      | null;
  }>).filter((row) => {
    const status = Array.isArray(row.status) ? row.status[0] : row.status;
    return status ? status.is_terminal === false : false;
  });

  if (filtered.length === 0) {
    return [];
  }

  // Filter out rows with a successful dispatch today (the dashboard's
  // "dismissed" predicate). Done in a second query so the typed
  // Supabase client does not need to inline a correlated subquery
  // that depends on the partial unique index shape.
  const ids = filtered.map((row) => row.id);
  const { data: dispatchedToday, error: dispatchError } = await supabase
    .from("reminder_dispatches")
    .select("application_id")
    .in("application_id", ids)
    .is("error", null)
    .gte("sent_at", `${todayUtc}T00:00:00.000Z`)
    .lt("sent_at", `${todayUtc}T23:59:59.999Z`);

  if (dispatchError) {
    return filtered.map((row) => ({ id: row.id, user_id: row.user_id }));
  }

  const dismissed = new Set(
    (dispatchedToday ?? []).map((row: { application_id: string }) => row.application_id),
  );
  return filtered
    .filter((row) => !dismissed.has(row.id))
    .map((row) => ({ id: row.id, user_id: row.user_id }));
}

// Re-export so deploy-time tooling (and the PR 6 Vitest harness) can
// import the helper without re-implementing the secret-matching logic.
export { extractSecret as __extractCronSecret };

// Reference APP_URL_ENV at module scope so the linter / bundler
// keeps it in the env contract surface. The reminder email body uses
// `platformUrl` directly, so the constant is reserved for future use
// (e.g. a per-application deep link back to /applications/[id]).
void APP_URL_ENV;
