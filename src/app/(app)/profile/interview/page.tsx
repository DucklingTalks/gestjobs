import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Alert, buttonStyles, PageHeader, PageShell } from "@/components/ui";
import { resolveAi } from "@/lib/ai/access";
import { createClient } from "@/lib/supabase/server";

import { InterviewChat } from "./interview-chat";

export const metadata: Metadata = { title: "Profile interview" };

export default async function ProfileInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ analysis?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ?analysis=<id>: interview about the gaps one fit analysis found.
  const { analysis: rawId } = await searchParams;
  const analysisId = z.string().uuid().safeParse(rawId);
  const { data: analysis } = analysisId.success
    ? await supabase
        .from("fit_analyses")
        .select("id, job_title, company, gaps")
        .eq("id", analysisId.data)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const focus = analysis?.gaps.length ? analysis : null;
  const access = await resolveAi(supabase, user);
  const jobName = focus ? [focus.job_title, focus.company].filter(Boolean).join(" at ") || "this job" : "";

  return (
    <PageShell width="3xl">
      <PageHeader
        breadcrumb={focus ? { href: `/fit/${focus.id}`, label: "Fit analysis" } : { href: "/profile", label: "Profile" }}
        title={focus ? "Interview about the gaps" : "Profile interview"}
        description={
          focus
            ? `The analysis for ${jobName} found gaps. Tell the AI interviewer about related experience your profile doesn't mention. You review everything before it is added to your profile.`
            : "An AI interviewer asks about your experience to find strengths your profile is missing. Answer with real examples. You review everything before it is added to your profile."
        }
      />
      {focus ? (
        <details className="mb-6 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-amber-800">Gaps found ({focus.gaps.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {focus.gaps.map((gap, index) => (
              <li key={index}>{gap}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {access.ok ? (
        <InterviewChat analysisId={focus?.id} />
      ) : (
        <Alert tone="error">
          {access.error}{" "}
          <Link href="/settings" className={buttonStyles.link}>
            Go to Settings
          </Link>
        </Alert>
      )}
    </PageShell>
  );
}
