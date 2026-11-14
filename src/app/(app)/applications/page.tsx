import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Alert,
  buttonStyles,
  Chip,
  EmptyState,
  formatDate,
  formatRelative,
  hostnameOf,
  PageHeader,
  PageShell,
  StatusBadge,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Applications" };

type SearchParams = { filter?: string };

type StatusInfo = {
  id: string;
  name: string;
  is_terminal: boolean | null;
  sort_order: number | null;
};

type ApplicationRow = {
  id: string;
  company_name: string;
  position_title: string;
  platform_url: string;
  application_date: string;
  updated_at: string;
  status: StatusInfo | null;
  platform: { id: string; name: string; hostname: string } | null;
};

export default async function ApplicationsPage({
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

  const newButton = (
    <Link href="/applications/new" className={buttonStyles.primary}>
      + New application
    </Link>
  );

  const { data: applications, error } = await supabase
    .from("applications")
    .select(
      "id, company_name, position_title, platform_url, application_date, updated_at, status:statuses(id, name, is_terminal, sort_order), platform:platforms(id, name, hostname)",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Applications" actions={newButton} />
        <Alert tone="error">Unable to load applications. Refresh to try again.</Alert>
      </PageShell>
    );
  }

  const rows: ApplicationRow[] = (applications ?? []).map((row) => ({
    ...row,
    status: Array.isArray(row.status) ? row.status[0] ?? null : row.status,
    platform: Array.isArray(row.platform) ? row.platform[0] ?? null : row.platform,
  }));

  // Group by status, keeping the workflow order (sort_order) instead of
  // alphabetical so "Applied → Screening → Interview…" reads top-down.
  const groups = new Map<string, { status: StatusInfo | null; rows: ApplicationRow[] }>();
  for (const row of rows) {
    const key = row.status?.id ?? "unknown";
    const group = groups.get(key) ?? { status: row.status, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort(([, a], [, b]) => {
    const aT = a.status?.is_terminal ? 1 : 0;
    const bT = b.status?.is_terminal ? 1 : 0;
    if (aT !== bT) return aT - bT;
    return (a.status?.sort_order ?? 999) - (b.status?.sort_order ?? 999);
  });

  const activeFilter = messages.filter && groups.has(messages.filter) ? messages.filter : null;
  const visible = activeFilter ? ordered.filter(([key]) => key === activeFilter) : ordered;

  return (
    <PageShell>
      <PageHeader
        title="Applications"
        description="Every opportunity, grouped by its current status."
        actions={newButton}
      />

      {!rows.length ? (
        <EmptyState
          title="No applications yet"
          description="Paste the job posting URL and gestjobs detects the platform for you."
          action={newButton}
        />
      ) : (
        <>
          <nav aria-label="Filter by status" className="-mx-1 flex flex-wrap gap-2">
            <FilterPill href="/applications" active={!activeFilter}>
              All <span className="tabular-nums opacity-70">{rows.length}</span>
            </FilterPill>
            {ordered.map(([key, group]) => (
              <FilterPill
                key={key}
                href={`/applications?filter=${key}`}
                active={activeFilter === key}
              >
                {group.status?.name ?? "Unknown"}{" "}
                <span className="tabular-nums opacity-70">{group.rows.length}</span>
              </FilterPill>
            ))}
          </nav>

          {visible.map(([key, group]) => (
            <section key={key} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {group.status?.name ?? "Unknown"}
                <span className="font-normal">{group.rows.length}</span>
              </h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/applications/${row.id}`}
                        className="font-medium text-slate-900 after:absolute after:inset-0"
                      >
                        {row.position_title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                        <span>{row.company_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>Applied {formatDate(row.application_date)}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge name={row.status?.name} />
                      <a
                        href={row.platform_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={row.platform_url}
                        className="relative z-10"
                      >
                        <Chip>{row.platform?.name ?? hostnameOf(row.platform_url)} ↗</Chip>
                      </a>
                      <span className="text-xs text-slate-400">
                        Updated {formatRelative(row.updated_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </PageShell>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-full border px-3 py-1 text-sm font-medium transition " +
        (active
          ? "border-accent-600 bg-accent-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")
      }
    >
      {children}
    </Link>
  );
}

