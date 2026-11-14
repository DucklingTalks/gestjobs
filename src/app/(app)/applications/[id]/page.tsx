import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SubmitButton } from "@/components/form-buttons";
import {
  Alert,
  buttonStyles,
  Card,
  fieldClass,
  formatDate,
  formatDateTime,
  hostnameOf,
  labelClass,
  PageHeader,
  PageShell,
  StatusBadge,
} from "@/components/ui";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const hasProposal = Boolean(
    detail.job_proposal_text || detail.job_proposal_url || detail.job_proposal_file_path,
  );

  return (
    <PageShell>
      <PageHeader
        breadcrumb={{ href: "/applications", label: "Applications" }}
        title={detail.position_title}
        badge={<StatusBadge name={detail.status?.name} />}
        description={
          <>
            {detail.company_name} · Applied {formatDate(detail.application_date)}
          </>
        }
        actions={
          <>
            <a
              href={detail.platform_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles.secondary}
            >
              Open posting ↗
            </a>
            <Link href={`/applications/${detail.id}/edit`} className={buttonStyles.primary}>
              Edit
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card
            title="Status"
            description="Every change is added to the timeline below."
          >
            <form action={changeApplicationStatus} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="applicationId" value={detail.id} />
              <label className={`${labelClass} min-w-[12rem] flex-1`}>
                Move to
                <select
                  name="toStatusId"
                  defaultValue={detail.status?.id ?? ""}
                  className={fieldClass}
                >
                  {(statuses ?? []).map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                      {status.is_terminal ? " (closes application)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton pendingLabel="Updating…">Update status</SubmitButton>
            </form>

            <ol className="mt-6 space-y-4">
              {historyRows.length === 0 ? (
                <li className="text-sm text-slate-500">No history yet.</li>
              ) : null}
              {[...historyRows].reverse().map((row, index) => (
                <li key={row.id} className="relative flex gap-3 pl-1">
                  <span
                    aria-hidden="true"
                    className={
                      "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white " +
                      (index === 0 ? "bg-accent-600" : "bg-slate-300")
                    }
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <StatusBadge name={row.to_status?.name} />
                      <span className="text-slate-500">
                        {row.from_status ? `from ${row.from_status.name}` : "initial status"}
                      </span>
                    </div>
                    <time
                      dateTime={row.changed_at}
                      className="mt-0.5 block text-xs text-slate-400"
                    >
                      {formatDateTime(row.changed_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Job proposal">
            {!hasProposal ? (
              <p className="text-sm text-slate-500">No job description was saved.</p>
            ) : (
              <div className="space-y-4">
                {detail.job_proposal_text ? (
                  <details className="group rounded-lg border border-slate-200">
                    <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700">
                      Saved description
                    </summary>
                    <div className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                      {detail.job_proposal_text}
                    </div>
                  </details>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {detail.job_proposal_url ? (
                    <a
                      href={detail.job_proposal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={detail.job_proposal_url}
                      className={buttonStyles.secondary}
                    >
                      View on {hostnameOf(detail.job_proposal_url)} ↗
                    </a>
                  ) : null}
                  {detail.job_proposal_file_path ? (
                    proposalSignedUrl ? (
                      <a href={proposalSignedUrl} className={buttonStyles.secondary}>
                        Download file
                      </a>
                    ) : (
                      <span className="text-sm text-red-700">File download unavailable.</span>
                    )
                  ) : null}
                </div>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Details">
            <dl className="space-y-3 text-sm">
              <DetailRow label="Company">{detail.company_name}</DetailRow>
              <DetailRow label="Platform">
                {detail.platform?.name ?? "Unknown"}
                {detail.platform?.hostname ? (
                  <span className="block text-xs text-slate-500">{detail.platform.hostname}</span>
                ) : null}
              </DetailRow>
              <DetailRow label="Applied">{formatDate(detail.application_date)}</DetailRow>
              <DetailRow label="Last updated">{formatDateTime(detail.updated_at)}</DetailRow>
            </dl>
          </Card>

          <Card title="Resume">
            {attachment && attachment.resume ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{attachment.resume.label}</p>
                <p className="text-xs text-slate-500">
                  Attached {formatDate(attachment.attached_at)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {resumeSignedUrl ? (
                    <a href={resumeSignedUrl} className={`text-sm ${buttonStyles.link}`}>
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-red-700">Download unavailable</span>
                  )}
                  <form action={detachResume}>
                    <input type="hidden" name="applicationId" value={detail.id} />
                    <SubmitButton variant="dangerLink" pendingLabel="Removing…">
                      Detach
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ) : (
              <p className="mb-4 text-sm text-slate-500">No resume attached.</p>
            )}
            {resumeOptions.length ? (
              <form action={attachResume} className="space-y-2">
                <input type="hidden" name="applicationId" value={detail.id} />
                <label className={labelClass}>
                  {attachment ? "Replace with" : "Attach a version"}
                  <select name="resumeId" required defaultValue="" className={fieldClass}>
                    <option value="" disabled>
                      Select a resume
                    </option>
                    {resumeOptions.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resume.label}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton variant="secondary" pendingLabel="Attaching…" className="w-full">
                  Attach resume
                </SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-slate-500">
                <Link href="/resumes" className={buttonStyles.link}>
                  Upload a resume
                </Link>{" "}
                to attach it here.
              </p>
            )}
          </Card>

          <Card title="Contacts">
            {contactLinks.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">No contacts linked.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {contactLinks.map((link) => (
                  <li
                    key={`${link.contact_id}-${link.role}`}
                    className="rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {link.contact?.name ?? "Unknown contact"}
                        </p>
                        <p className="text-xs text-slate-500">{link.role}</p>
                        {link.contact?.email ? (
                          <a
                            href={`mailto:${link.contact.email}`}
                            className={`block truncate text-xs ${buttonStyles.link}`}
                          >
                            {link.contact.email}
                          </a>
                        ) : null}
                      </div>
                      <form action={detachContact}>
                        <input type="hidden" name="applicationId" value={detail.id} />
                        <input type="hidden" name="contactId" value={link.contact_id} />
                        <input type="hidden" name="role" value={link.role} />
                        <SubmitButton variant="dangerLink" pendingLabel="…" className="text-xs">
                          <span aria-hidden="true">✕</span>
                          <span className="sr-only">
                            Remove {link.contact?.name ?? "contact"} as {link.role}
                          </span>
                        </SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {contactOptions.length ? (
              <form action={attachContact} className="space-y-2">
                <input type="hidden" name="applicationId" value={detail.id} />
                <label className={labelClass}>
                  Contact
                  <select name="contactId" required defaultValue="" className={fieldClass}>
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
                <label className={labelClass}>
                  Role
                  <input
                    name="role"
                    required
                    maxLength={80}
                    list="contact-role-suggestions"
                    placeholder="Recruiter"
                    className={fieldClass}
                  />
                  <datalist id="contact-role-suggestions">
                    <option value="Recruiter" />
                    <option value="Hiring manager" />
                    <option value="Referrer" />
                    <option value="Interviewer" />
                  </datalist>
                </label>
                <SubmitButton variant="secondary" pendingLabel="Linking…" className="w-full">
                  Link contact
                </SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-slate-500">
                <Link href="/contacts" className={buttonStyles.link}>
                  Add a contact
                </Link>{" "}
                to link it here.
              </p>
            )}
          </Card>
        </aside>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/50 p-5">
        <div>
          <h2 className="text-sm font-semibold text-red-800">Delete application</h2>
          <p className="mt-0.5 text-sm text-red-700">
            Removes its status history, linked resume and contacts, and the saved
            proposal file. This cannot be undone.
          </p>
        </div>
        <form action={deleteApplication}>
          <input type="hidden" name="applicationId" value={detail.id} />
          <SubmitButton
            variant="danger"
            pendingLabel="Deleting…"
            confirmMessage={`Delete "${detail.position_title}" at ${detail.company_name}? This cannot be undone.`}
          >
            Delete application
          </SubmitButton>
        </form>
      </section>
    </PageShell>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}

function renderErrorPage(message: string) {
  return (
    <PageShell>
      <PageHeader
        breadcrumb={{ href: "/applications", label: "Applications" }}
        title="Application"
      />
      <Alert tone="error">{message}</Alert>
    </PageShell>
  );
}

