import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  buttonStyles,
  Chip,
  EmptyState,
  PageHeader,
  PageShell,
  StatusBadge,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type StatusCount = {
  id: string;
  name: string;
  is_terminal: boolean;
  sort_order: number;
  count: number;
};

type PendingReminder = {
  id: string;
  company_name: string;
  position_title: string;
  next_reminder_at: string;
  status_name: string | null;
  platform_name: string | null;
  platform_url: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [statusCounts, pendingReminders] = await Promise.all([
    loadStatusCounts(supabase, user.id),
    loadPendingReminders(supabase, user.id),
  ]);

  const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const active = statusCounts
    .filter((s) => !s.is_terminal)
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Where every application stands and what needs a follow-up next."
        actions={
          <Link href="/applications/new" className={buttonStyles.primary}>
            + New application
          </Link>
        }
      />

      {total === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Add the first role you applied to and gestjobs will start tracking its status and follow-ups."
          action={
            <Link href="/applications/new" className={buttonStyles.primary}>
              Add your first application
            </Link>
          }
        />
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Total applications" value={total} />
            <SummaryTile label="In progress" value={active} />
            <SummaryTile
              label="Follow-ups due"
              value={pendingReminders.length}
              highlight={pendingReminders.length > 0}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Follow-ups due
              </h2>
              <span className="text-xs text-slate-500">
                Sent 15 days after the last status change
              </span>
            </div>
            {pendingReminders.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
                You are all caught up — no follow-ups are due right now.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-amber-200 bg-white">
                {pendingReminders.map((reminder) => (
                  <li key={reminder.id} className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-amber-50/60">
                    <div className="min-w-0">
                      <Link
                        href={`/applications/${reminder.id}`}
                        className="font-medium text-slate-900 after:absolute after:inset-0"
                      >
                        {reminder.position_title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        {reminder.company_name}
                        <StatusBadge name={reminder.status_name} />
                        {reminder.platform_name ? <Chip>{reminder.platform_name}</Chip> : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-amber-700">
                        Due {formatReminderDate(reminder.next_reminder_at)}
                      </span>
                      <a
                        href={reminder.platform_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`relative z-10 text-xs ${buttonStyles.link}`}
                      >
                        Open posting ↗
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Applications by status
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {statusCounts.map((status) => (
                <li key={status.id}>
                  <Link
                    href={`/applications?filter=${status.id}`}
                    className={
                      "flex items-center justify-between rounded-xl border bg-white px-4 py-3 transition hover:border-accent-500 hover:shadow-sm " +
                      (status.count === 0 ? "border-slate-200 opacity-60" : "border-slate-200")
                    }
                  >
                    <StatusBadge name={status.name} />
                    <span className="text-2xl font-semibold tabular-nums text-slate-900">
                      {status.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </PageShell>
  );
}

function SummaryTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border px-5 py-4 " +
        (highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white")
      }
    >
      <p className={"text-sm " + (highlight ? "text-amber-800" : "text-slate-500")}>{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

async function loadStatusCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<StatusCount[]> {
  // One round-trip: aggregate applications per status, joined to the
  // user's own status catalog so zero-count rows are still surfaced
  // (spec scenario "Empty state" + "View counters"). The status
  // catalog is user-scoped via the `create_default_statuses` trigger
  // on auth.users.
  const { data, error } = await supabase
    .from("statuses")
    .select("id, name, is_terminal, sort_order, applications:applications(count)")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as Array<{
    id: string;
    name: string;
    is_terminal: boolean;
    sort_order: number;
    applications: Array<{ count: number }> | { count: number } | null;
  }>).map((row) => {
    const applications = Array.isArray(row.applications)
      ? row.applications
      : row.applications
      ? [row.applications]
      : [];
    const count = applications.reduce(
      (sum, item) => sum + (typeof item?.count === "number" ? item.count : 0),
      0,
    );
    return {
      id: row.id,
      name: row.name,
      is_terminal: Boolean(row.is_terminal),
      sort_order: row.sort_order,
      count,
    };
  });
}

async function loadPendingReminders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<PendingReminder[]> {
  // The "pending" predicate (spec scenario "Sorted pending list"):
  //   - `next_reminder_at <= now()` — overdue OR due today.
  //   - `next_reminder_at IS NOT NULL` — terminal statuses suppress reminders.
  //   - No successful dispatch today — "dismissed" (already emailed) rows
  //     are excluded via the same partial-unique-index logic the cron
  //     uses. RLS restricts everything to the current user.
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, company_name, position_title, platform_url, next_reminder_at, status:statuses!applications_status_id_fkey(name, is_terminal), platform:platforms!applications_platform_id_fkey(name)",
    )
    .eq("user_id", userId)
    .not("next_reminder_at", "is", null)
    .lte("next_reminder_at", new Date().toISOString())
    .order("next_reminder_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rows = data as Array<{
    id: string;
    company_name: string;
    position_title: string;
    platform_url: string;
    next_reminder_at: string;
    status:
      | { name: string; is_terminal: boolean | null }
      | { name: string; is_terminal: boolean | null }[]
      | null;
    platform:
      | { name: string }
      | { name: string }[]
      | null;
  }>;

  const typed = rows
    .filter((row) => {
      const status = Array.isArray(row.status) ? row.status[0] : row.status;
      return status ? status.is_terminal === false : false;
    })
    .map((row) => {
      const status = Array.isArray(row.status) ? row.status[0] : row.status;
      const platform = Array.isArray(row.platform)
        ? row.platform[0]
        : row.platform;
      return {
        id: row.id,
        company_name: row.company_name,
        position_title: row.position_title,
        next_reminder_at: row.next_reminder_at,
        status_name: status?.name ?? null,
        platform_name: platform?.name ?? null,
        platform_url: row.platform_url,
      };
    });

  // Filter out rows that already had a successful dispatch today so the
  // dashboard does not show the same reminder twice. The partial unique
  // index on `reminder_dispatches` makes this set small; one query for
  // the whole page is acceptable.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const { data: dismissed, error: dismissError } = await supabase
    .from("reminder_dispatches")
    .select("application_id")
    .in(
      "application_id",
      typed.map((row) => row.id),
    )
    .is("error", null)
    .gte("sent_at", `${todayUtc}T00:00:00.000Z`)
    .lt("sent_at", `${todayUtc}T23:59:59.999Z`);

  if (dismissError) {
    return typed;
  }

  const dismissedIds = new Set(
    (dismissed ?? []).map(
      (row: { application_id: string }) => row.application_id,
    ),
  );
  return typed.filter((row) => !dismissedIds.has(row.id));
}

function formatReminderDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < -1) {
    return `${Math.abs(diffDays)} days ago`;
  }
  if (diffDays === -1) {
    return "yesterday";
  }
  if (diffDays === 0) {
    return "today";
  }
  if (diffDays === 1) {
    return "tomorrow";
  }
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
