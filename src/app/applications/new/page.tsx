import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { seedPlatforms } from "@/lib/platforms/seed";
import type { Platform } from "@/lib/platforms/infer";

import { ApplicationForm } from "./application-form";

export const metadata: Metadata = { title: "New application" };

type SearchParams = { error?: string };

export default async function NewApplicationPage({
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

  const { data: customRows, error: customError } = await supabase
    .from("platforms")
    .select("id, user_id, name, hostname, is_custom")
    .eq("user_id", user.id)
    .eq("is_custom", true)
    .order("name");

  if (customError) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-6 py-12">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
            gestjobs
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            New application
          </h1>
        </header>
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Unable to load your custom platforms.
        </p>
      </main>
    );
  }

  const { data: statuses, error: statusesError } = await supabase
    .from("statuses")
    .select("id, name, is_terminal")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (statusesError || !statuses?.length) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-6 py-12">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
            gestjobs
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            New application
          </h1>
        </header>
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          No statuses are configured for this account. Sign out and back in
          to trigger the default status seed, or run the migrations on a
          provisioned Supabase project.
        </p>
      </main>
    );
  }

  const customPlatforms: Platform[] = (customRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    isCustom: row.is_custom,
  }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-8 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
          gestjobs
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          New application
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Capture a new opportunity. The platform is inferred from the URL
          first; if we cannot find a match, pick one or add a custom entry.
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

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-lg font-semibold">Application details</h2>
        <ApplicationForm
          options={seedPlatforms}
          customPlatforms={customPlatforms}
          statuses={statuses.map((status) => ({
            id: status.id,
            name: status.name,
            is_terminal: status.is_terminal,
          }))}
          defaultDate={today}
        />
      </section>
    </main>
  );
}
