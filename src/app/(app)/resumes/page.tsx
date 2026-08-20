import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { MAX_RESUME_FILE_SIZE_MB } from "@/lib/validation/resume";

import { uploadResume } from "./actions";

export const metadata: Metadata = { title: "Resumes" };

type SearchParams = { error?: string; status?: string };

export default async function ResumesPage({
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
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-accent-600">gestjobs</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Resume versions</h1>
        <p className="mt-2 text-sm text-slate-600">Upload private PDF or DOCX versions and label each one for reuse.</p>
      </header>

      {messages.error || error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {messages.error ?? "Unable to load resume versions."}
        </p>
      ) : null}
      {messages.status === "uploaded" ? (
        <p role="status" className="rounded-md border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">Resume version uploaded.</p>
      ) : null}

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-lg font-semibold">Upload a version</h2>
        <form action={uploadResume} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium text-slate-700">Label *<input name="label" required maxLength={120} placeholder="Frontend-Senior" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-sm font-medium text-slate-700">File *<input name="file" type="file" required accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx" className="mt-1 block w-full text-sm text-slate-700" /></label>
          <button className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">Upload</button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Maximum {MAX_RESUME_FILE_SIZE_MB} MB. Files stay private; download links expire after one hour.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Versions</h2>
        {!versions.length ? <p className="text-sm text-slate-500">No resume versions yet.</p> : null}
        {versions.map((resume) => (
          <article key={resume.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-slate-900">{resume.label}</h3>
                <p className="text-xs text-slate-500">{(resume.file_size / 1024).toFixed(1)} KB · {new Date(resume.created_at).toLocaleString("en")}</p>
              </div>
              {resume.signedUrl ? <a href={resume.signedUrl} className="text-sm font-medium text-accent-700 hover:text-accent-800">Download</a> : <span className="text-xs text-red-700">Download unavailable</span>}
            </div>
            <p className="mt-2 truncate font-mono text-xs text-slate-400" title={resume.file_hash}>SHA-256 {resume.file_hash}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
