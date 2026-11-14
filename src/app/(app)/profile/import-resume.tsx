"use client";

import { useActionState, useEffect, useRef } from "react";

import { SubmitButton } from "@/components/form-buttons";
import { Alert, Card } from "@/components/ui";
import type { Profile } from "@/lib/validation/profile";

import { importResume, type ImportResumeState } from "./actions";

const initialState: ImportResumeState = { error: null, profile: null, importedAt: null };

/** Keep contact details the user already typed when the import has none. */
function mergeImported(current: Profile, imported: Profile): Profile {
  return {
    ...imported,
    fullName: imported.fullName || current.fullName,
    email: imported.email || current.email,
    phone: imported.phone || current.phone,
    location: imported.location || current.location,
    links: imported.links.length ? imported.links : current.links,
  };
}

function hasContent(profile: Profile): boolean {
  return Boolean(
    profile.bio || profile.experiences.length || profile.education.length || profile.skills.length,
  );
}

export function ImportResume({
  current,
  onImported,
  aiEnabled,
}: {
  current: Profile;
  onImported: (profile: Profile) => void;
  aiEnabled: boolean;
}) {
  const [state, formAction] = useActionState(importResume, initialState);
  const applied = useRef<number | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    if (state.profile && state.importedAt && applied.current !== state.importedAt) {
      applied.current = state.importedAt;
      onImported(mergeImported(currentRef.current, state.profile));
    }
  }, [state, onImported]);

  const imported = state.importedAt !== null && !state.error;

  return (
    <Card
      title="Import from your CV"
      description="Upload a PDF or Word file and the AI will fill the form for you. Email, phone and links are removed before the text is sent and added back here. Nothing is saved until you click Save profile."
    >
      {!aiEnabled ? (
        <Alert tone="error">
          AI is not configured yet. Add OPENCODE_API_KEY to the environment to enable imports.
        </Alert>
      ) : (
        <form
          action={formAction}
          onSubmit={(event) => {
            if (
              hasContent(currentRef.current) &&
              !window.confirm("Replace the current form contents with the imported CV?")
            ) {
              event.preventDefault();
            }
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            type="file"
            name="resume"
            required
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="block w-full text-sm text-slate-700"
            aria-label="CV file"
          />
          <SubmitButton variant="secondary" pendingLabel="Reading your CV…" className="shrink-0">
            Import CV
          </SubmitButton>
        </form>
      )}
      {state.error ? (
        <div className="mt-3">
          <Alert tone="error">{state.error}</Alert>
        </div>
      ) : null}
      {imported ? (
        <div className="mt-3">
          <Alert tone="success">CV imported. Review every section below, then save your profile.</Alert>
        </div>
      ) : null}
    </Card>
  );
}
