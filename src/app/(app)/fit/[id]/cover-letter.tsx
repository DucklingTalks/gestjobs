"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/form-buttons";
import { buttonStyles, fieldClass } from "@/components/ui";

import { saveCoverLetter } from "../actions";

export function CoverLetterEditor({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [copied, setCopied] = useState(false);
  const dirty = value !== initial;

  return (
    <form action={saveCoverLetter} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="coverLetter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={16}
        className={`${fieldClass} font-[inherit] leading-relaxed`}
        aria-label="Cover letter"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{value.trim().split(/\s+/).filter(Boolean).length} words</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={buttonStyles.secondary}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          {dirty ? (
            <button type="button" className={buttonStyles.secondary} onClick={() => setValue(initial)}>
              Discard changes
            </button>
          ) : null}
          <SubmitButton pendingLabel="Saving…" variant={dirty ? "primary" : "secondary"}>
            Save letter
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
