import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert, PageHeader, PageShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadGlobalPlatforms } from "@/lib/platforms/global";
import type { Platform } from "@/lib/platforms/infer";

import { ApplicationForm } from "./application-form";

export const metadata: Metadata = { title: "New application" };

const breadcrumb = { href: "/applications", label: "Applications" };

export default async function NewApplicationPage() {
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
      <PageShell width="3xl">
        <PageHeader breadcrumb={breadcrumb} title="New application" />
        <Alert tone="error">Unable to load your custom platforms. Refresh to try again.</Alert>
      </PageShell>
    );
  }

  const { data: statuses, error: statusesError } = await supabase
    .from("statuses")
    .select("id, name, is_terminal")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (statusesError || !statuses?.length) {
    return (
      <PageShell width="3xl">
        <PageHeader breadcrumb={breadcrumb} title="New application" />
        <Alert tone="error">
          No statuses are configured for this account. Sign out and back in to
          trigger the default status seed, or run the migrations on a
          provisioned Supabase project.
        </Alert>
      </PageShell>
    );
  }

  const customPlatforms: Platform[] = (customRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    isCustom: row.is_custom,
  }));

  const globalPlatforms = await loadGlobalPlatforms(supabase);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageShell width="3xl">
      <PageHeader
        breadcrumb={breadcrumb}
        title="New application"
        description="Capture a new opportunity. Fields marked * are required."
      />

      <ApplicationForm
        options={globalPlatforms}
        customPlatforms={customPlatforms}
        statuses={statuses.map((status) => ({
          id: status.id,
          name: status.name,
          is_terminal: status.is_terminal,
        }))}
        defaultDate={today}
      />
    </PageShell>
  );
}
