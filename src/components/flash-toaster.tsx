"use client";

/**
 * Flash toaster — turns the `?status=` / `?error=` query params that the
 * Server Actions redirect with into toasts that dismiss themselves, then
 * strips those params from the URL so a refresh doesn't replay them.
 *
 * Success toasts auto-dismiss after SUCCESS_MS; error toasts stay longer
 * (ERROR_MS) so they can be read, and every toast can be closed by hand.
 * Hovering a toast pauses its timer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Tone = "success" | "error";
type Toast = { id: number; tone: Tone; message: string };

const SUCCESS_MS = 4_000;
const ERROR_MS = 8_000;

const APPLICATION_MESSAGES: Record<string, string> = {
  created: "Application created.",
  updated: "Changes saved.",
  deleted: "Application deleted.",
  changed: "Status updated.",
  unchanged: "Status was already up to date.",
  "contact-attached": "Contact linked.",
  "contact-detached": "Contact removed.",
};

const CONTACT_MESSAGES: Record<string, string> = {
  created: "Contact added.",
  updated: "Contact saved.",
  deleted: "Contact deleted.",
};

const PROFILE_MESSAGES: Record<string, string> = {
  "profile-saved": "Profile saved.",
};

const FIT_MESSAGES: Record<string, string> = {
  analysed: "Analysis ready.",
  "letter-saved": "Cover letter saved.",
  "keyword-updated": "CV wording updated.",
  "analysis-deleted": "Analysis deleted.",
};

const MESSAGES_BY_PATH: Array<[prefix: string, table: Record<string, string>]> = [
  ["/contacts", CONTACT_MESSAGES],
  ["/profile", PROFILE_MESSAGES],
  ["/fit", FIT_MESSAGES],
];

function statusMessage(pathname: string, status: string): string {
  const table =
    MESSAGES_BY_PATH.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? APPLICATION_MESSAGES;
  return table[status] ?? "Done.";
}

export function FlashToaster() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const status = searchParams.get("status");
    const error = searchParams.get("error");
    if (!status && !error) return;

    const incoming: Toast[] = [];
    if (error) incoming.push({ id: nextId.current++, tone: "error", message: error });
    if (status) {
      incoming.push({
        id: nextId.current++,
        tone: "success",
        message: statusMessage(pathname, status),
      });
    }
    setToasts((current) => [...current, ...incoming].slice(-3));

    // Remove the flash params but keep everything else (e.g. ?filter=).
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("error");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [searchParams, pathname]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);

  // Enter animation on mount.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      toast.tone === "error" ? ERROR_MS : SUCCESS_MS,
    );
    return () => window.clearTimeout(timer);
  }, [paused, toast, onDismiss]);

  const isError = toast.tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg transition duration-200 motion-reduce:transition-none " +
        (isError ? "border-red-200" : "border-emerald-200") +
        (visible ? " translate-y-0 opacity-100" : " translate-y-2 opacity-0")
      }
    >
      <span
        aria-hidden="true"
        className={
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white " +
          (isError ? "bg-red-600" : "bg-emerald-600")
        }
      >
        {isError ? "!" : "✓"}
      </span>
      <p className={"flex-1 " + (isError ? "text-red-800" : "text-slate-800")}>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-m-1 rounded p-1 text-slate-400 hover:text-slate-700"
        aria-label="Dismiss notification"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
