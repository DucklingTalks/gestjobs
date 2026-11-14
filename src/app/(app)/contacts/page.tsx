import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/form-buttons";
import {
  Alert,
  buttonStyles,
  Card,
  EmptyState,
  fieldClass,
  labelClass,
  PageHeader,
  PageShell,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

import { createContact, deleteContact, updateContact } from "./actions";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id,name,email,phone,linkedin_url,notes")
    .order("name");

  return (
    <PageShell width="4xl">
      <PageHeader
        title="Contacts"
        description="A reusable directory of recruiters, referrers, and hiring managers you can link to any application."
      />

      {error ? <Alert tone="error">Unable to load contacts. Refresh to try again.</Alert> : null}

      <Card title="Add a contact">
        <ContactFields action={createContact} submitLabel="Add contact" pendingLabel="Adding…" />
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Directory
          {contacts?.length ? <span className="font-normal">{contacts.length}</span> : null}
        </h2>
        {!contacts?.length ? (
          <EmptyState
            title="No contacts yet"
            description="Add the people you talk to during your search so you can link them to applications."
          />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-50 text-sm font-semibold text-accent-700"
                      >
                        {initials(contact.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{contact.name}</p>
                        <p className="truncate text-sm text-slate-500">
                          {[contact.email, contact.phone].filter(Boolean).join(" · ") ||
                            "No contact details"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-slate-500 group-open:hidden">
                      Edit
                    </span>
                    <span className="hidden shrink-0 text-sm font-medium text-slate-500 group-open:inline">
                      Close
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                    {contact.linkedin_url ? (
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mb-3 inline-block text-sm ${buttonStyles.link}`}
                      >
                        LinkedIn profile ↗
                      </a>
                    ) : null}
                    <ContactFields
                      action={updateContact}
                      contact={contact}
                      submitLabel="Save changes"
                      pendingLabel="Saving…"
                    />
                    <form action={deleteContact} className="mt-4 border-t border-slate-200 pt-3">
                      <input type="hidden" name="id" value={contact.id} />
                      <SubmitButton
                        variant="dangerLink"
                        pendingLabel="Deleting…"
                        confirmMessage={`Delete ${contact.name}? They will be unlinked from every application.`}
                      >
                        Delete contact
                      </SubmitButton>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type ContactDefaults = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
};

function ContactFields({
  action,
  contact,
  submitLabel,
  pendingLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  contact?: ContactDefaults;
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {contact ? <input type="hidden" name="id" value={contact.id} /> : null}
      <label className={labelClass}>
        Name <span className="text-red-600" aria-hidden="true">*</span>
        <input className={fieldClass} name="name" required autoComplete="off" placeholder="Jane Doe" defaultValue={contact?.name} />
      </label>
      <label className={labelClass}>
        Email
        <input className={fieldClass} name="email" type="email" autoComplete="off" placeholder="jane@company.com" defaultValue={contact?.email ?? ""} />
      </label>
      <label className={labelClass}>
        Phone
        <input className={fieldClass} name="phone" type="tel" autoComplete="off" placeholder="+1 555 123 4567" defaultValue={contact?.phone ?? ""} />
      </label>
      <label className={labelClass}>
        LinkedIn URL
        <input className={fieldClass} name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" defaultValue={contact?.linkedin_url ?? ""} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Notes
        <textarea className={fieldClass} name="notes" rows={3} placeholder="How you met, what you talked about…" defaultValue={contact?.notes ?? ""} />
      </label>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
