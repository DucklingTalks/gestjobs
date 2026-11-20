import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FitScoreBadge } from "@/components/fit-score";
import { Alert, buttonStyles, Card, EmptyState, formatRelative, PageHeader, PageShell } from "@/components/ui";
import { resolveAi } from "@/lib/ai/access";
import { createClient } from "@/lib/supabase/server";
import { isProfileUsable, PROFILE_COLUMNS, profileFromRow } from "@/lib/validation/profile";

import { FitForm } from "./fit-form";

export const metadata: Metadata = { title: "Job fit" };

export default async function FitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRow }, { data: analyses, error }] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("fit_analyses")
      .select("id, job_title, company, score, created_at, application_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const profileReady = isProfileUsable(profileFromRow(profileRow));
  const access = await resolveAi(supabase, user);
  const disabledReason = access.ok ? null : access.error;

  return (
    <PageShell width="4xl">
      <PageHeader
        title="Job fit"
        description="See how well you match a role before you apply, and get a cover letter and a tailored CV for it."
      />

      <div className="space-y-6">
        {!profileReady ? (
          <Alert tone="error">
            Your profile is empty.{" "}
            <Link href="/profile" className="font-semibold underline">
              Fill it in or import your CV
            </Link>{" "}
            first; the analysis compares the posting against it.
          </Alert>
        ) : null}

        <FitForm disabledReason={disabledReason} />

        <Card title="Past analyses">
          {error ? (
            <Alert tone="error">Unable to load your analyses. Refresh to try again.</Alert>
          ) : !analyses?.length ? (
            <EmptyState
              title="No analyses yet"
              description="Analyse a posting above, or use “Analyse fit” on any application."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {analyses.map((analysis) => (
                <li key={analysis.id} className="relative flex items-center gap-4 py-3">
                  <FitScoreBadge score={analysis.score} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/fit/${analysis.id}`}
                      className="block truncate text-sm font-medium text-slate-900 after:absolute after:inset-0 hover:text-accent-700"
                    >
                      {analysis.job_title || "Untitled role"}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {[analysis.company, formatRelative(analysis.created_at)].filter(Boolean).join(" · ")}
                      {analysis.application_id ? " · linked to an application" : ""}
                    </p>
                  </div>
                  <span aria-hidden="true" className="text-slate-300">
                    →
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-xs text-slate-500">
          Your profile (without email, phone or links) and the posting are sent to the AI provider to
          generate the analysis.{" "}
          <Link href="/profile" className={buttonStyles.link}>
            Edit profile
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
