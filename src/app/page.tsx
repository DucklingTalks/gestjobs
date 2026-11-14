import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonStyles } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    title: "Status workflow",
    body: "Move each role from Applied to Offer and keep an immutable history of every change.",
  },
  {
    title: "Follow-up reminders",
    body: "Get an email 15 days after the last status change so no application goes cold.",
  },
  {
    title: "Contacts & resumes",
    body: "Link recruiters and the exact resume version you sent to every application.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-12 px-6 py-16">
      <header className="space-y-5">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-md bg-accent-600 text-sm font-bold text-white"
          >
            g
          </span>
          gestjobs
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Track every job application in one place.
        </h1>
        <p className="max-w-xl text-lg text-slate-600">
          Status history, contacts, resume versions, and follow-up reminders
          for every role you apply to &mdash; so nothing falls through the
          cracks.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Link href="/login" className={`${buttonStyles.primary} px-5 py-2.5 text-base`}>
            Get started
          </Link>
          <span className="text-sm text-slate-500">
            Sign in with a magic link &mdash; no password needed.
          </span>
        </div>
      </header>

      <section aria-label="Features" className="grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-200 bg-slate-50 p-5"
          >
            <h2 className="text-sm font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-1.5 text-sm text-slate-600">{feature.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
