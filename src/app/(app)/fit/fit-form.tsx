"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";

import { SubmitButton } from "@/components/form-buttons";
import { Alert, buttonStyles, Card, fieldClass, labelClass } from "@/components/ui";

import { runFitAnalysis, type FitFormState } from "./actions";

const initialState: FitFormState = { error: null };

export function FitForm({ disabledReason }: { disabledReason: string | null }) {
  const [state, formAction, isPending] = useActionState(runFitAnalysis, initialState);
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");

  return (
    <Card
      title="Analyse a job posting"
      description="Paste the description, or a link to it. You get a 1–10 fit score, a short cover letter and a CV tailored to the role, written in the posting's language."
    >
      {disabledReason ? (
        <Alert tone="error">
          {disabledReason}{" "}
          <Link href="/settings" className={buttonStyles.link}>
            Go to Settings
          </Link>
        </Alert>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData();
            formData.set("jobText", jobText);
            formData.set("jobUrl", jobUrl);
            startTransition(() => formAction(formData));
          }}
          className="space-y-4"
        >
          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          <label className={labelClass}>
            Job description
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={10}
              placeholder="Paste the full posting: responsibilities, requirements, nice-to-haves…"
              className={fieldClass}
            />
          </label>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <label className={labelClass}>
            Link to the posting
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://…"
              className={fieldClass}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Used only when the description is empty. Some sites (like LinkedIn) block reading; paste the text there.
            </span>
          </label>
          <div className="flex justify-end">
            <SubmitButton pending={isPending} pendingLabel="Analysing… this can take a minute">
              Analyse fit
            </SubmitButton>
          </div>
        </form>
      )}
    </Card>
  );
}
