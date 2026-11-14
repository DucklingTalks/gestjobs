"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { buttonStyles } from "./ui";

type Variant = keyof typeof buttonStyles;

/**
 * Submit button that disables itself and shows a pending label while the
 * enclosing form's Server Action runs. Optionally asks for confirmation.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  confirmMessage,
  className = "",
  pending: pendingOverride,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  confirmMessage?: string;
  className?: string;
  /** Explicit pending flag for forms submitted via `startTransition`
   *  (where `useFormStatus` cannot observe the submission). */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className={`${buttonStyles[variant]} ${className}`}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel ?? "Saving…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
