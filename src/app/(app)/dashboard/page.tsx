import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = { error?: string };

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const messages = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [statusCounts, pendingReminders] = await Promise.all([
    loadStatusCounts(supabase, user.id),
    loadPendingReminders(supabase, user.id),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
          gestjobs
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          A quick read on where every application stands and what needs a
          follow-up next.
        </p>
      </header>

      {messages.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {messages.error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Applications by status</h2>
        {statusCounts.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            No applications yet. Create your first one to see counters here.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {statusCounts.map((status) => (
              <li
                key={status.id}
                className={
                  "rounded-lg border px-4 py-3 " +
                  (status.is_terminal
                    ? "border-slate-200 bg-slate-50"
                    : "border-slate-200 bg-white")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {status.name}
                    {status.is_terminal ? (
                      <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">
                        Terminal
                      </span>
                    ) : null}
                  </span>
                  <span className="text-2xl font-semibold text-slate-900">
                    {status.count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Pending reminders</h2>
        {pendingReminders.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            No reminders are due. Next reminders fire 15 days after the
            last status change.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingReminders.map((reminder) => (
              <li
                key={reminder.id}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <Link
                  href={`/applications/${reminder.id}`}
                  className="block hover:bg-amber-100"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-slate-900">
                      {reminder.position_title}
                      <span className="font-normal text-slate-500">
                        {" · "}
                        {reminder.company_name}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-amber-700">
                      Due {formatReminderDate(reminder.next_reminder_at)}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    {reminder.status_name ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-slate-700">
                        {reminder.status_name}
                      </span>
                    ) : null}
                    {reminder.platform_name ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-slate-700">
                        {reminder.platform_name}
                      </span>
                    ) : null}
                  </div>
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <a
                    href={reminder.platform_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-accent-700 hover:text-accent-800"
                  >
                    {reminder.platform_url}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Link
          href="/applications/new"
          className="inline-flex items-center rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-700"
        >
          New application
        </Link>
        <Link
          href="/applications"
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          View all applications
        </Link>
      </section>
    </main>
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
