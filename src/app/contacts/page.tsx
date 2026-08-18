import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { createContact, deleteContact, updateContact } from "./actions";

export const metadata: Metadata = { title: "Contacts" };

type SearchParams = { error?: string; status?: string };

const fieldClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

export default async function ContactsPage({
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

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id,name,email,phone,linkedin_url,notes")
    .order("name");

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-accent-600">gestjobs</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Contacts</h1>
        <p className="mt-2 text-sm text-slate-600">Keep a reusable directory of recruiters, referrers, and hiring managers.</p>
      </header>

      {messages.error || error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {messages.error ?? "Unable to load contacts."}
        </p>
      ) : null}
      {messages.status ? (
        <p role="status" className="rounded-md border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">
          Contact {messages.status}.
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-lg font-semibold">Add contact</h2>
        <ContactFields action={createContact} submitLabel="Add contact" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Directory</h2>
        {!contacts?.length ? <p className="text-sm text-slate-500">No contacts yet.</p> : null}
        {contacts?.map((contact) => (
          <details key={contact.id} className="rounded-lg border border-slate-200 p-4">
            <summary className="cursor-pointer font-medium text-slate-900">
              {contact.name}{contact.email ? <span className="ml-2 font-normal text-slate-500">{contact.email}</span> : null}
            </summary>
            <ContactFields action={updateContact} contact={contact} submitLabel="Save changes" />
            <form action={deleteContact} className="mt-3 border-t border-slate-100 pt-3">
              <input type="hidden" name="id" value={contact.id} />
              <button className="text-sm font-medium text-red-700 hover:text-red-800">Delete contact</button>
            </form>
          </details>
        ))}
      </section>
    </main>
  );
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
}: {
  action: (formData: FormData) => Promise<void>;
  contact?: ContactDefaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      {contact ? <input type="hidden" name="id" value={contact.id} /> : null}
      <label className="text-sm font-medium text-slate-700">Name *<input className={fieldClass} name="name" required defaultValue={contact?.name} /></label>
      <label className="text-sm font-medium text-slate-700">Email<input className={fieldClass} name="email" type="email" defaultValue={contact?.email ?? ""} /></label>
      <label className="text-sm font-medium text-slate-700">Phone<input className={fieldClass} name="phone" defaultValue={contact?.phone ?? ""} /></label>
      <label className="text-sm font-medium text-slate-700">LinkedIn URL<input className={fieldClass} name="linkedin_url" type="url" defaultValue={contact?.linkedin_url ?? ""} /></label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Notes<textarea className={fieldClass} name="notes" rows={3} defaultValue={contact?.notes ?? ""} /></label>
      <button className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 sm:w-fit">{submitLabel}</button>
    </form>
  );
}
