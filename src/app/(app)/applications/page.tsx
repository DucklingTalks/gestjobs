import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Applications" };

type SearchParams = { error?: string; status?: string };

type ApplicationRow = {
  id: string;
  company_name: string;
  position_title: string;
  platform_url: string;
  application_date: string;
  updated_at: string;
  status: { id: string; name: string; is_terminal: boolean | null } | null;
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

  const { data: applications, error } = await supabase
    .from("applications")
    .select(
      "id, company_name, position_title, platform_url, application_date, updated_at, status:statuses(id, name, is_terminal), platform:platforms(id, name, hostname)",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-6 py-12">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
            gestjobs
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Applications
          </h1>
        </header>
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Unable to load applications.
        </p>
      </main>
    );
  }

  const rows: ApplicationRow[] = (applications ?? []).map((row) => ({
    ...row,
    status: Array.isArray(row.status) ? row.status[0] ?? null : row.status,
    platform: Array.isArray(row.platform) ? row.platform[0] ?? null : row.platform,
  }));

  const grouped = rows.reduce<Record<string, ApplicationRow[]>>((acc, row) => {
    const key = row.status?.name ?? "Unknown";
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});

  const statusOrder = Object.keys(grouped).sort((a, b) => {
    const aTerminal = grouped[a]?.[0]?.status?.is_terminal ? 1 : 0;
    const bTerminal = grouped[b]?.[0]?.status?.is_terminal ? 1 : 0;
    if (aTerminal !== bTerminal) return aTerminal - bTerminal;
    return a.localeCompare(b);
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
            gestjobs
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Applications
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Track every opportunity, grouped by its current status.
          </p>
        </div>
        <Link
          href="/applications/new"
          className="inline-flex items-center rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-700"
        >
          New application
        </Link>
      </header>

      {messages.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {messages.error}
        </p>
      ) : null}
      {messages.status ? (
        <p
          role="status"
          className="rounded-md border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700"
        >
          {renderStatusMessage(messages.status)}
        </p>
      ) : null}

      {!rows.length ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No applications yet. Create your first one.
        </p>
      ) : null}

      {statusOrder.map((statusName) => (
        <section key={statusName} className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            {statusName}
            <span className="text-xs font-normal text-slate-500">
              {grouped[statusName].length}
            </span>
          </h2>
          <ul className="space-y-2">
            {grouped[statusName].map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-slate-200 px-4 py-3"
              >
                <Link
                  href={`/applications/${row.id}`}
                  className="block hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-slate-900">
                      {row.position_title}
                      <span className="font-normal text-slate-500"> · {row.company_name}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Updated {new Date(row.updated_at).toLocaleDateString("en")}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                      {row.platform?.name ?? "Platform"}
                    </span>
                    <a
                      href={row.platform_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-accent-700 hover:text-accent-800"
                    >
                      {row.platform_url}
                    </a>
                    <span className="text-slate-400">
                      Applied {row.application_date}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function renderStatusMessage(status: string): string {
  switch (status) {
    case "created":
      return "Application created.";
    case "updated":
      return "Application updated.";
    case "deleted":
      return "Application deleted.";
    case "changed":
      return "Status updated.";
    case "unchanged":
      return "Status was already up to date.";
    case "resume-attached":
      return "Resume attached.";
    case "resume-detached":
      return "Resume detached.";
    case "contact-attached":
      return "Contact attached.";
    case "contact-detached":
      return "Contact detached.";
    default:
      return `Application ${status}.`;
  }
}
