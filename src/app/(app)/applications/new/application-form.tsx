"use client";

/**
 * Application form — used by both "New application" and "Edit application".
 * Combines platform URL inference, the accessible PlatformCombobox, and the
 * job-proposal text/file/URL inputs.
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/applications/spec.md
 *   sections: Mandatory Platform URL, Job Proposal Capture.
 *
 * URL-first platform inference:
 *   1. User types the URL of the job posting.
 *   2. As the URL changes, we run `inferPlatformFromUrl` against the
 *      combined list (seed + custom + saved). If a match exists, the
 *      platform name and id auto-populate.
 *   3. If no match, the combobox shows the free-text "Add as a new
 *      platform" affordance. The submit handler carries both
 *      `platformId` (set when a known match is selected) and `platformName`
 *      (always set, so the server can upsert on a custom row).
 *
 * Submission goes through `useActionState` + `startTransition` instead of
 * the form `action` prop: React resets uncontrolled fields after an
 * `action` submission, which would wipe the user's input when the server
 * returns a validation error.
 */

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";

import { SubmitButton } from "@/components/form-buttons";
import { PlatformCombobox } from "@/components/platform-combobox";
import { Alert, buttonStyles, Card, fieldClass, labelClass } from "@/components/ui";
import {
  inferPlatformFromUrl,
  normalizeHostname,
  type Platform,
} from "@/lib/platforms/infer";

import {
  createApplication,
  updateApplication,
  type ApplicationFormState,
} from "../actions";

type StatusOption = {
  id: string;
  name: string;
  is_terminal: boolean | null;
};

export type ApplicationFormInitial = {
  id: string;
  companyName: string;
  positionTitle: string;
  platformUrl: string;
  platform: Platform | null;
  statusId: string;
  applicationDate: string;
  jobProposalText: string;
  jobProposalUrl: string;
  hasProposalFile: boolean;
};

type ApplicationFormProps = {
  options: ReadonlyArray<Platform>;
  customPlatforms: ReadonlyArray<Platform>;
  statuses: ReadonlyArray<StatusOption>;
  defaultDate: string;
  /** When provided, the form edits this application instead of creating one. */
  initial?: ApplicationFormInitial;
};

const initialState: ApplicationFormState = { error: null };

export function ApplicationForm({
  options,
  customPlatforms,
  statuses,
  defaultDate,
  initial,
}: ApplicationFormProps) {
  const isEdit = Boolean(initial);
  const reactId = useId();
  const platformUrlId = `platform-url-${reactId}`;
  const platformNameId = `platform-name-${reactId}`;
  const companyNameId = `company-name-${reactId}`;
  const positionTitleId = `position-title-${reactId}`;
  const statusIdId = `status-id-${reactId}`;
  const applicationDateId = `application-date-${reactId}`;
  const proposalTextId = `proposal-text-${reactId}`;
  const proposalUrlId = `proposal-url-${reactId}`;
  const proposalFileId = `proposal-file-${reactId}`;

  const [state, formAction, isPending] = useActionState(
    isEdit ? updateApplication : createApplication,
    initialState,
  );

  // Bring server-side errors into view: the submit button sits at the
  // bottom of a long form, the error banner at the top.
  const errorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (state.error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  const allOptions = useMemo<Platform[]>(
    () => [...options, ...customPlatforms],
    [options, customPlatforms],
  );

  const [platformUrl, setPlatformUrl] = useState(initial?.platformUrl ?? "");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(
    initial?.platform ?? null,
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showNameField, setShowNameField] = useState(false);

  const inferred = useMemo(() => {
    if (!platformUrl.trim()) return null;
    return inferPlatformFromUrl(platformUrl, allOptions);
  }, [platformUrl, allOptions]);

  // When the URL changes to a known hostname, auto-select the platform.
  // When inference fails, require the user to pick or create via combobox.
  const handlePlatformUrlChange = (next: string) => {
    setPlatformUrl(next);
    setUrlError(null);

    try {
      normalizeHostname(next);
    } catch (error) {
      setUrlError(
        error instanceof Error ? error.message : "Enter a valid HTTP(S) URL.",
      );
    }

    if (!next.trim()) {
      setSelectedPlatform(null);
      setShowNameField(false);
      return;
    }

    const match = inferPlatformFromUrl(next, allOptions);
    if (match) {
      setSelectedPlatform(match);
      setShowNameField(false);
    } else {
      // Keep the user's typed-in platform name (if any) so they can refine.
      setShowNameField(true);
    }
  };

  const handlePlatformChange = (platform: Platform) => {
    setSelectedPlatform(platform);
    // Custom entries (id === null) require a manual name.
    setShowNameField(platform.isCustom || platform.id === null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  const initialStatusId =
    initial?.statusId ??
    statuses.find((s) => s.name === "Applied")?.id ??
    statuses[0]?.id ??
    "";

  const platformLocked = Boolean(selectedPlatform?.id && !selectedPlatform.isCustom);
  const cancelHref = initial ? `/applications/${initial.id}` : "/applications";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {initial ? <input type="hidden" name="applicationId" value={initial.id} /> : null}

      {state.error ? (
        <div ref={errorRef}>
          <Alert tone="error">{state.error}</Alert>
        </div>
      ) : null}

      <Card title="The role">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass} htmlFor={positionTitleId}>
            Position title <Required />
            <input
              id={positionTitleId}
              name="positionTitle"
              required
              maxLength={160}
              autoFocus={!isEdit}
              autoComplete="organization-title"
              placeholder="Senior Frontend Engineer"
              defaultValue={initial?.positionTitle}
              className={fieldClass}
            />
          </label>
          <label className={labelClass} htmlFor={companyNameId}>
            Company <Required />
            <input
              id={companyNameId}
              name="companyName"
              required
              maxLength={120}
              autoComplete="organization"
              placeholder="Acme Inc."
              defaultValue={initial?.companyName}
              className={fieldClass}
            />
          </label>
          {isEdit ? (
            // Status changes go through the workflow on the detail page so
            // every change lands in the timeline. The update schema still
            // requires a status id, so the current one is carried along.
            <input type="hidden" name="statusId" value={initialStatusId} />
          ) : (
            <label className={labelClass} htmlFor={statusIdId}>
              Current status <Required />
              <select
                id={statusIdId}
                name="statusId"
                required
                defaultValue={initialStatusId}
                className={fieldClass}
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                    {status.is_terminal ? " (closes application)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={labelClass} htmlFor={applicationDateId}>
            Applied on <Required />
            <input
              id={applicationDateId}
              name="applicationDate"
              type="date"
              required
              defaultValue={initial?.applicationDate ?? defaultDate}
              className={fieldClass}
            />
          </label>
        </div>
      </Card>

      <Card
        title="Where you applied"
        description="Paste the posting URL — we detect the platform automatically."
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor={platformUrlId}>
              Posting URL <Required />
              <input
                id={platformUrlId}
                name="platformUrl"
                type="url"
                required
                maxLength={2048}
                value={platformUrl}
                onChange={(e) => handlePlatformUrlChange(e.target.value)}
                placeholder="https://boards.greenhouse.io/acme/jobs/123"
                aria-invalid={urlError ? true : undefined}
                aria-describedby={`${platformUrlId}-status`}
                className={
                  fieldClass +
                  (urlError ? " border-red-400 focus:border-red-500 focus:ring-red-400" : "")
                }
              />
            </label>
            <p
              id={`${platformUrlId}-status`}
              className="mt-1.5 min-h-[1.25rem] text-xs"
              aria-live="polite"
            >
              {urlError && platformUrl.trim() ? (
                <span className="text-red-700">{urlError}</span>
              ) : inferred && !selectedPlatform?.isCustom ? (
                <span className="font-medium text-emerald-700">✓ Detected {inferred.name}</span>
              ) : showNameField ? (
                <span className="text-amber-700">
                  We don&apos;t recognise this site — choose a platform or add a new one below.
                </span>
              ) : (
                <span className="text-slate-500">
                  Works with LinkedIn, Greenhouse, Lever, Indeed and more.
                </span>
              )}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelClass}>Choose platform</span>
              <div className="mt-1">
                <PlatformCombobox
                  value={selectedPlatform}
                  options={allOptions}
                  onChange={handlePlatformChange}
                  placeholder="Search or type a new name"
                  describedBy={`${platformUrlId}-status`}
                />
              </div>
            </div>
            <label className={labelClass} htmlFor={platformNameId}>
              Platform name <Required />
              <input
                id={platformNameId}
                name="platformName"
                required
                maxLength={120}
                value={selectedPlatform?.name ?? ""}
                readOnly={platformLocked}
                onChange={(e) =>
                  setSelectedPlatform((current) => ({
                    id: current?.id ?? null,
                    name: e.target.value,
                    hostname: current?.hostname ?? "",
                    isCustom: true,
                  }))
                }
                placeholder="Greenhouse"
                className={fieldClass + (platformLocked ? " bg-slate-50 text-slate-600" : "")}
              />
              {showNameField && selectedPlatform?.name ? (
                <span className="mt-1 block text-xs font-normal text-amber-700">
                  New platform — saved when you submit.
                </span>
              ) : null}
            </label>
          </div>
          <input type="hidden" name="platformId" value={selectedPlatform?.id ?? ""} />
        </div>
      </Card>

      <Card
        title="Job description"
        description="Optional. Save a copy in case the posting is taken down — any one of these is enough."
      >
        <div className="space-y-4">
          <label className={labelClass} htmlFor={proposalTextId}>
            Paste the description
            <textarea
              id={proposalTextId}
              name="jobProposalText"
              rows={5}
              maxLength={20000}
              placeholder="Paste the job description here."
              defaultValue={initial?.jobProposalText}
              className={fieldClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass} htmlFor={proposalUrlId}>
              Link to the description
              <input
                id={proposalUrlId}
                name="jobProposalUrl"
                type="url"
                maxLength={2048}
                placeholder="https://example.com/job-posting"
                defaultValue={initial?.jobProposalUrl}
                className={fieldClass}
              />
            </label>
            <div>
              <label className={labelClass} htmlFor={proposalFileId}>
                {initial?.hasProposalFile
                  ? "Replace the saved file (PDF / DOCX)"
                  : "Or upload a file (PDF / DOCX)"}
                <input
                  id={proposalFileId}
                  name="jobProposalFile"
                  type="file"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
                  className="mt-1.5 block w-full text-sm text-slate-600"
                />
              </label>
              {initial?.hasProposalFile ? (
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="removeProposalFile"
                    className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                  />
                  Remove the saved file
                </label>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={cancelHref} className={buttonStyles.secondary}>
          Cancel
        </Link>
        <SubmitButton
          pending={isPending}
          pendingLabel={isEdit ? "Saving…" : "Creating…"}
        >
          {isEdit ? "Save changes" : "Create application"}
        </SubmitButton>
      </div>
    </form>
  );
}

function Required() {
  return (
    <span className="text-red-600" aria-hidden="true">
      *
    </span>
  );
}
