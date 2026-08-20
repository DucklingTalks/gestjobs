"use client";

/**
 * Application form — combines platform URL inference, the accessible
 * PlatformCombobox, and the job-proposal text/file/URL inputs.
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
 *   4. On submit, the wrapper form sends the resolved id + name + URL.
 */

import { useId, useMemo, useState } from "react";

import {
  inferPlatformFromUrl,
  normalizeHostname,
  type Platform,
} from "@/lib/platforms/infer";
import { PlatformCombobox } from "@/components/platform-combobox";

import { createApplication } from "../actions";

type StatusOption = {
  id: string;
  name: string;
  is_terminal: boolean | null;
};

type ApplicationFormProps = {
  options: ReadonlyArray<Platform>;
  customPlatforms: ReadonlyArray<Platform>;
  statuses: ReadonlyArray<StatusOption>;
  defaultDate: string;
};

export function ApplicationForm({
  options,
  customPlatforms,
  statuses,
  defaultDate,
}: ApplicationFormProps) {
  const reactId = useId();
  const platformUrlId = `platform-url-${reactId}`;
  const platformNameId = `platform-name-${reactId}`;
  const platformIdId = `platform-id-${reactId}`;
  const companyNameId = `company-name-${reactId}`;
  const positionTitleId = `position-title-${reactId}`;
  const statusIdId = `status-id-${reactId}`;
  const applicationDateId = `application-date-${reactId}`;
  const proposalTextId = `proposal-text-${reactId}`;
  const proposalUrlId = `proposal-url-${reactId}`;
  const proposalFileId = `proposal-file-${reactId}`;

  const allOptions = useMemo<Platform[]>(
    () => [...options, ...customPlatforms],
    [options, customPlatforms],
  );

  const [platformUrl, setPlatformUrl] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
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
        error instanceof Error
          ? error.message
          : "Enter a valid HTTP(S) URL.",
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
      setSelectedPlatform((current) => current);
      setShowNameField(true);
    }
  };

  const handlePlatformChange = (platform: Platform) => {
    setSelectedPlatform(platform);
    // Custom entries (id === null) require a manual name.
    setShowNameField(platform.isCustom || platform.id === null);
  };

  const initialStatusId = statuses.find((s) => s.name === "Applied")?.id
    ?? statuses[0]?.id
    ?? "";

  return (
    <form action={createApplication} className="mt-4 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700" htmlFor={companyNameId}>
          Company name *
          <input
            id={companyNameId}
            name="companyName"
            required
            maxLength={120}
            autoComplete="organization"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>
        <label className="text-sm font-medium text-slate-700" htmlFor={positionTitleId}>
          Position title *
          <input
            id={positionTitleId}
            name="positionTitle"
            required
            maxLength={160}
            autoComplete="organization-title"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700" htmlFor={platformUrlId}>
          Platform URL *
          <input
            id={platformUrlId}
            name="platformUrl"
            type="url"
            required
            maxLength={2048}
            value={platformUrl}
            onChange={(e) => handlePlatformUrlChange(e.target.value)}
            placeholder="https://boards.greenhouse.io/jobs/123"
            className={
              "mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 " +
              (urlError
                ? "border-red-400 focus:border-red-500 focus:ring-red-400"
                : "border-slate-300 focus:border-accent-500 focus:ring-accent-500")
            }
          />
        </label>
        <label className="text-sm font-medium text-slate-700" htmlFor={platformNameId}>
          Platform name *
          <input
            id={platformNameId}
            name="platformName"
            required
            maxLength={120}
            value={selectedPlatform?.name ?? ""}
            readOnly={Boolean(selectedPlatform?.id && !selectedPlatform.isCustom)}
            onChange={(e) =>
              setSelectedPlatform((current) => ({
                id: current?.id ?? null,
                name: e.target.value,
                hostname: current?.hostname ?? "",
                isCustom: true,
              }))
            }
            placeholder="Greenhouse"
            className={
              "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500 " +
              (selectedPlatform?.id && !selectedPlatform.isCustom
                ? "bg-slate-50 text-slate-600"
                : "")
            }
          />
        </label>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Platform
        </p>
        {selectedPlatform ? (
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">
              {selectedPlatform.name || inferred?.name || "Unknown platform"}
            </span>
            {inferred && !selectedPlatform.isCustom ? (
              <span className="ml-2 text-xs text-accent-700">
                Detected from URL
              </span>
            ) : null}
            {showNameField ? (
              <span className="ml-2 text-xs text-amber-700">
                Custom platform — will be saved on submit.
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Pick a platform from the list or type a custom name below.
          </p>
        )}
        <div className="mt-2">
          <PlatformCombobox
            value={selectedPlatform}
            options={allOptions}
            onChange={handlePlatformChange}
            placeholder="Search platforms or type a custom name"
            describedBy={`${platformUrlId}-help`}
          />
        </div>
        <p id={`${platformUrlId}-help`} className="mt-1 text-xs text-slate-500">
          We infer the platform from the URL hostname first. If we cannot
          find a match, pick from the directory or add a custom one.
        </p>
        <input
          id={platformIdId}
          name="platformId"
          type="hidden"
          value={selectedPlatform?.id ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700" htmlFor={statusIdId}>
          Status *
          <select
            id={statusIdId}
            name="statusId"
            required
            defaultValue={initialStatusId}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
                {status.is_terminal ? " (terminal)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700" htmlFor={applicationDateId}>
          Application date *
          <input
            id={applicationDateId}
            name="applicationDate"
            type="date"
            required
            defaultValue={defaultDate}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>
      </div>

      <fieldset className="space-y-3 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          Job proposal (optional)
        </legend>
        <p className="text-xs text-slate-500">
          Provide any one of: pasted text, a file, or an external URL.
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor={proposalTextId}>
          Pasted text
          <textarea
            id={proposalTextId}
            name="jobProposalText"
            rows={4}
            maxLength={20000}
            placeholder="Paste the job description here."
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700" htmlFor={proposalUrlId}>
          External URL
          <input
            id={proposalUrlId}
            name="jobProposalUrl"
            type="url"
            maxLength={2048}
            placeholder="https://example.com/job-posting"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700" htmlFor={proposalFileId}>
          Upload PDF or DOCX
          <input
            id={proposalFileId}
            name="jobProposalFile"
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            className="mt-1 block w-full text-sm text-slate-700"
          />
        </label>
      </fieldset>

      <button
        type="submit"
        className="inline-flex w-fit items-center rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-700"
      >
        Create application
      </button>
    </form>
  );
}
