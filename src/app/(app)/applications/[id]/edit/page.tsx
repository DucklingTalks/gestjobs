import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Alert, PageHeader, PageShell } from "@/components/ui";
import type { Platform } from "@/lib/platforms/infer";
import { seedPlatforms } from "@/lib/platforms/seed";
import { createClient } from "@/lib/supabase/server";
import { applicationIdSchema } from "@/lib/validation/application";

import { ApplicationForm } from "../../new/application-form";

export const metadata: Metadata = { title: "Edit application" };

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!applicationIdSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const breadcrumb = { href: `/applications/${id}`, label: "Back to application" };

  const [{ data: application, error }, { data: customRows }, { data: statuses }] =
    await Promise.all([
      supabase
        .from("applications")
        .select(
          "id, company_name, position_title, platform_url, application_date, status_id, job_proposal_text, job_proposal_url, job_proposal_file_path, platform:platforms(id, name, hostname, is_custom)",
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("platforms")
        .select("id, name, hostname, is_custom")
        .eq("user_id", user.id)
        .eq("is_custom", true)
        .order("name"),
      supabase
        .from("statuses")
        .select("id, name, is_terminal")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
    ]);

  if (error) {
    return (
      <PageShell width="3xl">
        <PageHeader breadcrumb={breadcrumb} title="Edit application" />
        <Alert tone="error">Unable to load this application. Refresh to try again.</Alert>
      </PageShell>
    );
  }
  if (!application) notFound();

  const platformRow = Array.isArray(application.platform)
    ? application.platform[0] ?? null
    : application.platform;
  const platform: Platform | null = platformRow
    ? {
        id: platformRow.id,
        name: platformRow.name,
        hostname: platformRow.hostname,
        isCustom: platformRow.is_custom,
      }
    : null;

  const customPlatforms: Platform[] = (customRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    isCustom: row.is_custom,
  }));

  return (
    <PageShell width="3xl">
      <PageHeader
        breadcrumb={breadcrumb}
        title="Edit application"
        description={`${application.position_title} · ${application.company_name}. To change the status, use the workflow on the application page.`}
      />

      <ApplicationForm
        options={seedPlatforms}
        customPlatforms={customPlatforms}
        statuses={statuses ?? []}
        defaultDate={application.application_date}
        initial={{
          id: application.id,
          companyName: application.company_name,
          positionTitle: application.position_title,
          platformUrl: application.platform_url,
          platform,
          statusId: application.status_id,
          applicationDate: application.application_date,
          jobProposalText: application.job_proposal_text ?? "",
          jobProposalUrl: application.job_proposal_url ?? "",
          hasProposalFile: Boolean(application.job_proposal_file_path),
        }}
      />
    </PageShell>
  );
}
