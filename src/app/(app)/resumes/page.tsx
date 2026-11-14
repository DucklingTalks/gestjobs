import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/form-buttons";
import {
  Alert,
  buttonStyles,
  Card,
  EmptyState,
  fieldClass,
  formatDate,
  formatFileSize,
  labelClass,
  PageHeader,
  PageShell,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { MAX_RESUME_FILE_SIZE_MB } from "@/lib/validation/resume";

import { uploadResume } from "./actions";

export const metadata: Metadata = { title: "Resumes" };

export default async function ResumesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: resumes, error } = await supabase
    .from("resumes")
    .select("id,label,file_path,file_hash,file_size,created_at")
    .order("created_at", { ascending: false });

  const versions = await Promise.all(
    (resumes ?? []).map(async (resume) => {
      const { data } = await supabase.storage
        .from("resumes")
        .createSignedUrl(resume.file_path, 3_600);
      return { ...resume, signedUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <PageShell width="4xl">
      <PageHeader
        title="Resumes"
        description="Upload labelled versions of your resume and attach the exact one you sent to each application."
      />

      {error ? (
        <Alert tone="error">Unable to load resume versions. Refresh to try again.</Alert>
      ) : null}

      <Card
        title="Upload a version"
        description={`PDF or DOCX, up to ${MAX_RESUME_FILE_SIZE_MB} MB. Files are private; download links expire after one hour.`}
      >
        <form
          action={uploadResume}
          className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label className={labelClass}>
            Label <span className="text-red-600" aria-hidden="true">*</span>
            <input
              name="label"
              required
              maxLength={120}
              placeholder="Frontend – Senior"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            File <span className="text-red-600" aria-hidden="true">*</span>
            <input
              name="file"
              type="file"
              required
              accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
              className="mt-1.5 block w-full text-sm text-slate-600"
            />
          </label>
          <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
        </form>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Versions
          {versions.length ? <span className="font-normal">{versions.length}</span> : null}
        </h2>
        {!versions.length ? (
          <EmptyState
            title="No resume versions yet"
            description="Upload your first resume above. You can keep several versions tailored to different roles."
          />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {versions.map((resume) => (
              <li
                key={resume.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-[10px] font-bold uppercase text-slate-500"
                  >
                    {fileExtension(resume.file_path)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{resume.label}</p>
                    <p className="text-sm text-slate-500" title={`SHA-256 ${resume.file_hash}`}>
                      {formatFileSize(resume.file_size)} · Uploaded {formatDate(resume.created_at)}
                    </p>
                  </div>
                </div>
                {resume.signedUrl ? (
                  <a href={resume.signedUrl} className={buttonStyles.secondary}>
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-red-700">Download unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function fileExtension(path: string): string {
  const ext = path.split(".").pop() ?? "";
  return ext.length <= 4 ? ext : "file";
}
