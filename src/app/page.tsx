import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
          gestjobs
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Track every job application in one place.
        </h1>
        <p className="max-w-xl text-base text-slate-600">
          gestjobs keeps the status workflow, contacts, resume versions, and
          follow-up reminders for every role you apply to &mdash; so nothing
          falls through the cracks.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3">
        <Link
          href="/login"
          className="inline-flex items-center rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-700"
        >
          Sign in to get started
        </Link>
        <span className="text-xs text-slate-500">
          Magic-link authentication. No passwords.
        </span>
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        MVP scaffold &mdash; Foundation PR (gestjobs-mvp).
      </footer>
    </main>
  );
}
