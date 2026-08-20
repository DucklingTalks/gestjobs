import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { applicationIdSchema } from "@/lib/validation/application";

import {
  attachContact,
  attachResume,
  changeApplicationStatus,
  deleteApplication,
  detachContact,
  detachResume,
} from "../actions";

export const metadata: Metadata = { title: "Application detail" };

type SearchParams = { error?: string; status?: string };

type ApplicationDetail = {
  id: string;
  company_name: string;
  position_title: string;
  platform_url: string;
  application_date: string;
  job_proposal_text: string | null;
  job_proposal_url: string | null;
  job_proposal_file_path: string | null;
  created_at: string;
  updated_at: string;
  status: {
    id: string;
    name: string;
    is_terminal: boolean | null;
  } | null;
  platform: {
    id: string;
    name: string;
    hostname: string;
  } | null;
};

type HistoryRow = {
  id: string;
  changed_at: string;
  from_status: { id: string; name: string } | null;
  to_status: { id: string; name: string } | null;
};

type ResumeOption = {
  id: string;
  label: string;
  created_at: string;
};

type ContactOption = {
  id: string;
  name: string;
  email: string | null;
};

type ResumeAttachment = {
  resume_id: string;
  attached_at: string;
  resume: {
    id: string;
    label: string;
    file_path: string;
  } | null;
};

type ContactLink = {
  contact_id: string;
  role: string;
  contact: { id: string; name: string; email: string | null } | null;
};

const PROPOSAL_BUCKET = "proposals";

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const messages = await searchParams;

  if (!applicationIdSchema.safeParse(id).success) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select(
      "id, company_name, position_title, platform_url, application_date, job_proposal_text, job_proposal_url, job_proposal_file_path, created_at, updated_at, status:statuses(id, name, is_terminal), platform:platforms(id, name, hostname)",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (applicationError) {
    return renderErrorPage("Unable to load application.");
  }

  if (!application) {
    notFound();
  }

  const detail: ApplicationDetail = {
    ...application,
    status: Array.isArray(application.status)
      ? application.status[0] ?? null
      : application.status,
    platform: Array.isArray(application.platform)
      ? application.platform[0] ?? null
      : application.platform,
  };

  const [
    { data: history },
    { data: statuses },
    { data: resumes },
    { data: contacts },
    { data: applicationResume },
    { data: applicationContacts },
  ] = await Promise.all([
    supabase
      .from("application_status_history")
      .select(
        "id, changed_at, from_status:statuses!application_status_history_from_status_id_fkey(id, name), to_status:statuses!application_status_history_to_status_id_fkey(id, name)",
      )
      .eq("application_id", id)
      .order("changed_at", { ascending: true }),
    supabase
      .from("statuses")
      .select("id, name, is_terminal, sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("resumes")
      .select("id, label, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, name, email")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("application_resumes")
      .select("resume_id, attached_at, resume:resumes(id, label, file_path)")
      .eq("application_id", id)
      .maybeSingle(),
    supabase
      .from("application_contacts")
      .select("contact_id, role, contact:contacts(id, name, email)")
      .eq("application_id", id),
  ]);

  const historyRows: HistoryRow[] = (history ?? []).map((row) => ({
    id: row.id,
    changed_at: row.changed_at,
    from_status: Array.isArray(row.from_status)
      ? row.from_status[0] ?? null
      : row.from_status,
    to_status: Array.isArray(row.to_status)
      ? row.to_status[0] ?? null
      : row.to_status,
  }));

  const resumeOptions: ResumeOption[] = (resumes ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    created_at: row.created_at,
  }));

  const contactOptions: ContactOption[] = (contacts ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
  }));

  const attachment: ResumeAttachment | null = applicationResume
    ? {
        resume_id: applicationResume.resume_id,
        attached_at: applicationResume.attached_at,
        resume: Array.isArray(applicationResume.resume)
          ? applicationResume.resume[0] ?? null
          : applicationResume.resume,
      }
    : null;

  const contactLinks: ContactLink[] = (applicationContacts ?? []).map(
    (row) => ({
      contact_id: row.contact_id,
      role: row.role,
      contact: Array.isArray(row.contact)
        ? row.contact[0] ?? null
        : row.contact,
    }),
  );

  let proposalSignedUrl: string | null = null;
  if (detail.job_proposal_file_path) {
    const { data } = await supabase.storage
      .from(PROPOSAL_BUCKET)
      .createSignedUrl(detail.job_proposal_file_path, 3_600);
    proposalSignedUrl = data?.signedUrl ?? null;
  }

  let resumeSignedUrl: string | null = null;
  if (attachment?.resume?.file_path) {
    const { data } = await supabase.storage
      .from("resumes")
      .createSignedUrl(attachment.resume.file_path, 3_600);
    resumeSignedUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
          gestjobs
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          {detail.position_title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {detail.company_name} · Applied {detail.application_date}
        </p>
      </header>

      {messages.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {messages.error}
        </p>
      ) : null}
      {messages.status ? (
        <p
          role="status"
          className="rounded-md border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700"
        >
          {renderStatusMessage(messages.status)}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-lg font-semibold">Overview</h2>
        <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Status</dt>
            <dd className="mt-1">
              {detail.status?.name ?? "Unknown"}
              {detail.status?.is_terminal ? (
                <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">
                  Terminal
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Platform</dt>
            <dd className="mt-1">
              {detail.platform?.name ?? "Unknown"}
              <span className="ml-2 text-xs text-slate-500">
                {detail.platform?.hostname}
              </span>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-500">Platform URL</dt>
            <dd className="mt-1 break-all">
              <a
                href={detail.platform_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-700 hover:text-accent-800"
              >
                {detail.platform_url}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Created</dt>
            <dd className="mt-1">
              {new Date(detail.created_at).toLocaleString("en")}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Updated</dt>
            <dd className="mt-1">
              {new Date(detail.updated_at).toLocaleString("en")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-lg font-semibold">Status</h2>
        <p className="mt-1 text-xs text-slate-500">
          Change the current status. Every change appends an immutable row
          to the timeline below.
        </p>
        <form
          action={changeApplicationStatus}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="applicationId" value={detail.id} />
          <label className="text-sm font-medium text-slate-700">
            New status
            <select
              name="toStatusId"
              defaultValue={detail.status?.id ?? ""}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              {(statuses ?? []).map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                  {status.is_terminal ? " (terminal)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
            Update status
          </button>
        </form>

        <ol className="mt-5 space-y-2 border-l border-slate-200 pl-4">
          {historyRows.length === 0 ? (
            <li className="text-xs text-slate-500">No history yet.</li>
          ) : null}
          {historyRows.map((row) => (
            <li key={row.id} className="text-sm">
              <div className="font-medium text-slate-900">
                {row.to_status?.name ?? "Unknown"}
                {row.from_status ? (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    from {row.from_status.name}
                  </span>
                ) : (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    (initial)
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {new Date(row.changed_at).toLocaleString("en")}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-lg font-semibold">Resume</h2>
        {attachment && attachment.resume ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-700">
              Attached: <span className="font-medium">{attachment.resume.label}</span>
              <span className="ml-2 text-xs text-slate-500">
                (since {new Date(attachment.attached_at).toLocaleString("en")})
              </span>
            </p>
            {resumeSignedUrl ? (
              <a
                href={resumeSignedUrl}
                className="text-sm font-medium text-accent-700 hover:text-accent-800"
              >
                Download resume
              </a>
            ) : (
              <p className="text-xs text-red-700">Download unavailable.</p>
            )}
            <form action={detachResume} className="pt-2">
              <input type="hidden" name="applicationId" value={detail.id} />
              <button className="text-xs font-medium text-red-700 hover:text-red-800">
                Detach resume
              </button>
            </form>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No resume attached.</p>
        )}
        <form
          action={attachResume}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
        >
          <input type="hidden" name="applicationId" value={detail.id} />
          <label className="text-sm font-medium text-slate-700">
            Attach resume version
            <select
              name="resumeId"
              required
              defaultValue=""
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="" disabled>
                Select a resume version
              </option>
              {resumeOptions.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.label}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
            Attach resume
          </button>
        </form>
        {!resumeOptions.length ? (
          <p className="mt-2 text-xs text-slate-500">
            Need a resume version? Upload one at{" "}
            <Link href="/resumes" className="text-accent-700 hover:text-accent-800">
              /resumes
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-lg font-semibold">Contacts</h2>
        {contactLinks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No contacts linked.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {contactLinks.map((link) => (
              <li
                key={`${link.contact_id}-${link.role}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-slate-900">
                    {link.contact?.name ?? "Unknown contact"}
                  </span>
                  <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">
                    {link.role}
                  </span>
                  {link.contact?.email ? (
                    <span className="ml-2 text-xs text-slate-500">
                      {link.contact.email}
                    </span>
                  ) : null}
                </div>
                <form action={detachContact}>
                  <input
                    type="hidden"
                    name="applicationId"
                    value={detail.id}
                  />
                  <input
                    type="hidden"
                    name="contactId"
                    value={link.contact_id}
                  />
                  <input type="hidden" name="role" value={link.role} />
                  <button className="text-xs font-medium text-red-700 hover:text-red-800">
                    Remove role
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form
          action={attachContact}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
        >
          <input type="hidden" name="applicationId" value={detail.id} />
          <label className="text-sm font-medium text-slate-700">
            Contact
            <select
              name="contactId"
              required
              defaultValue=""
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="" disabled>
                Select a contact
              </option>
              {contactOptions.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                  {contact.email ? ` (${contact.email})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Role
            <input
              name="role"
              required
              maxLength={80}
              placeholder="Recruiter"
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </label>
          <button className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
            Attach contact
          </button>
        </form>
        {!contactOptions.length ? (
          <p className="mt-2 text-xs text-slate-500">
            Need a contact? Create one at{" "}
            <Link href="/contacts" className="text-accent-700 hover:text-accent-800">
              /contacts
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-lg font-semibold">Job proposal</h2>
        {!detail.job_proposal_text &&
        !detail.job_proposal_url &&
        !detail.job_proposal_file_path ? (
          <p className="mt-2 text-sm text-slate-500">
            No job proposal captured.
          </p>
        ) : null}
        {detail.job_proposal_text ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Saved text
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {detail.job_proposal_text}
            </pre>
          </details>
        ) : null}
        {detail.job_proposal_url ? (
          <p className="mt-3 text-sm">
            <span className="font-medium text-slate-700">External URL:</span>{" "}
            <a
              href={detail.job_proposal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-accent-700 hover:text-accent-800"
            >
              {detail.job_proposal_url}
            </a>
          </p>
        ) : null}
        {detail.job_proposal_file_path ? (
          <p className="mt-3 text-sm">
            <span className="font-medium text-slate-700">File:</span>{" "}
            {proposalSignedUrl ? (
              <a
                href={proposalSignedUrl}
                className="text-accent-700 hover:text-accent-800"
              >
                Download proposal
              </a>
            ) : (
              <span className="text-xs text-red-700">
                Download unavailable.
              </span>
            )}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50 p-5">
        <h2 className="text-lg font-semibold text-red-800">Danger zone</h2>
        <p className="mt-1 text-sm text-red-700">
          Deleting this application removes its status history, attached
          resume and contacts, and the saved job proposal file.
        </p>
        <form action={deleteApplication} className="mt-3">
          <input type="hidden" name="applicationId" value={detail.id} />
          <button className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
            Delete application
          </button>
        </form>
      </section>
    </main>
  );
}

function renderErrorPage(message: string) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
          gestjobs
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          Application
        </h1>
      </header>
      <p
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {message}
      </p>
    </main>
  );
}

function renderStatusMessage(status: string): string {
  switch (status) {
    case "changed":
      return "Status updated.";
    case "unchanged":
      return "Status was already up to date.";
    case "resume-attached":
      return "Resume attached.";
    case "resume-detached":
      return "Resume detached.";
    case "contact-attached":
      return "Contact attached.";
    case "contact-detached":
      return "Contact detached.";
    case "updated":
      return "Application updated.";
    case "created":
      return "Application created.";
    default:
      return `Application ${status}.`;
  }
}
