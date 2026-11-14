/**
 * Shared presentational primitives. Server-safe (no hooks) so pages can
 * use them directly. Interactive pieces live in `form-buttons.tsx`.
 */
import type { ReactNode } from "react";
import Link from "next/link";

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60",
  dangerLink:
    "inline-flex items-center gap-1 rounded text-sm font-medium text-red-700 hover:text-red-800 hover:underline disabled:opacity-60",
  link: "font-medium text-accent-700 underline-offset-2 hover:text-accent-800 hover:underline",
} as const;

export const fieldClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

export const labelClass = "block text-sm font-medium text-slate-700";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  badge,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: { href: string; label: string };
  badge?: ReactNode;
}) {
  return (
    <header className="space-y-3">
      {breadcrumb ? (
        <Link
          href={breadcrumb.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <span aria-hidden="true">←</span> {breadcrumb.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {title}
            </h1>
            {badge}
          </div>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PageShell({
  children,
  width = "5xl",
}: {
  children: ReactNode;
  width?: "3xl" | "4xl" | "5xl";
}) {
  const max = { "3xl": "max-w-3xl", "4xl": "max-w-4xl", "5xl": "max-w-5xl" }[width];
  return (
    <main id="main" className={`mx-auto w-full ${max} space-y-8 px-4 py-8 sm:px-6 sm:py-10`}>
      {children}
    </main>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${styles}`}
    >
      <span aria-hidden="true" className="font-semibold">
        {tone === "error" ? "!" : "✓"}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Card({
  title,
  description,
  children,
  actions,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title ? (
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  applied: "bg-sky-50 text-sky-700 ring-sky-200",
  screening: "bg-violet-50 text-violet-700 ring-violet-200",
  interview: "bg-amber-50 text-amber-800 ring-amber-200",
  offer: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  hired: "bg-emerald-600 text-white ring-emerald-600",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  withdrawn: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function statusTone(name: string | null | undefined): string {
  return STATUS_TONES[(name ?? "").toLowerCase()] ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

export function StatusBadge({ name }: { name: string | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusTone(name)}`}
    >
      {name ?? "Unknown"}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

/** Formatting helpers shared across pages so dates look the same everywhere. */
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? parseDate(value) : value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffDays = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === -1) return "yesterday";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 0 && diffDays > -30) return `${Math.abs(diffDays)} days ago`;
  if (diffDays > 0 && diffDays < 30) return `in ${diffDays} days`;
  return formatDate(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// `YYYY-MM-DD` strings are parsed as UTC by `new Date`, which shifts the
// day backwards in negative-offset timezones. Parse them as local dates.
function parseDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}
