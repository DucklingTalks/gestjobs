import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Alert, PageHeader, PageShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadGlobalPlatforms } from "@/lib/platforms/global";
import type { Platform } from "@/lib/platforms/infer";

import { ApplicationForm, type ApplicationFormPrefill } from "./application-form";

export const metadata: Metadata = { title: "New application" };

const breadcrumb = { href: "/applications", label: "Applications" };

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ fromFit?: string }>;
}) {
  const { fromFit } = await searchParams;
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

  // "Add as application" from an AI fit analysis: carry its details over.
  let prefill: ApplicationFormPrefill | undefined;
  if (fromFit && z.string().uuid().safeParse(fromFit).success) {
    const { data: analysis } = await supabase
      .from("fit_analyses")
      .select("id, job_title, company, job_source_url, job_text")
      .eq("id", fromFit)
      .eq("user_id", user.id)
      .is("application_id", null)
      .maybeSingle();
    if (analysis) {
      prefill = {
        fitAnalysisId: analysis.id,
        positionTitle: analysis.job_title.slice(0, 160),
        companyName: analysis.company.slice(0, 120),
        platformUrl: analysis.job_source_url ?? "",
        jobProposalUrl: analysis.job_source_url ?? "",
        jobProposalText: analysis.job_text.slice(0, 20_000),
      };
    }
  }

  return (
    <PageShell width="3xl">
      <PageHeader
        breadcrumb={breadcrumb}
        title="New application"
        description={
          prefill
            ? "Prefilled from your fit analysis — check the details and add the posting URL if it is missing."
            : "Capture a new opportunity. Fields marked * are required."
        }
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
        prefill={prefill}
      />
    </PageShell>
  );
}
