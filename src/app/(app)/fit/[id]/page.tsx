import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { SubmitButton } from "@/components/form-buttons";
import { fitLabel, FitScoreHero } from "@/components/fit-score";
import { buttonStyles, Card, formatDateTime, PageHeader, PageShell } from "@/components/ui";
import { tailoredCvSchema } from "@/lib/ai/fit";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow } from "@/lib/validation/profile";

import { deleteAnalysis } from "../actions";
import { CoverLetterEditor } from "./cover-letter";
import { CvPreview } from "./cv-preview";

export const metadata: Metadata = { title: "Fit analysis" };

export default async function FitAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: analysis }, { data: profileRow }] = await Promise.all([
    supabase
      .from("fit_analyses")
      .select(
        "id, application_id, job_title, company, job_source_url, job_text, language, score, summary, cover_letter, cv, model, created_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, headline, email, phone, location, bio, skills, links, languages, experiences, education, certifications")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!analysis) notFound();

  const profile = profileFromRow(profileRow);
  const cv = tailoredCvSchema.safeParse(analysis.cv);
  const contact = {
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    links: profile.links,
  };

  return (
    <PageShell width="5xl">
      <PageHeader
        breadcrumb={{ href: "/fit", label: "Job fit" }}
        title={analysis.job_title || "Fit analysis"}
        description={[analysis.company, `Analysed ${formatDateTime(analysis.created_at)}`].filter(Boolean).join(" · ")}
        actions={
          analysis.application_id ? (
            <Link href={`/applications/${analysis.application_id}`} className={buttonStyles.secondary}>
              View application
            </Link>
          ) : null
        }
      />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <FitScoreHero score={analysis.score} />
            <div>
              <p className="text-sm font-semibold text-slate-900">{fitLabel(analysis.score)}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card title="Cover letter" description="Edit it freely; your changes are saved here.">
            <CoverLetterEditor id={analysis.id} initial={analysis.cover_letter} />
          </Card>

          <Card
            title="Tailored CV"
            description="Built only from your profile, reordered and rephrased for this role."
            actions={
              cv.success ? (
                <a href={`/fit/${analysis.id}/cv`} className={buttonStyles.primary} download>
                  Download PDF
                </a>
              ) : null
            }
          >
            {cv.success ? (
              <CvPreview cv={cv.data} contact={contact} language={analysis.language} />
            ) : (
              <p className="text-sm text-slate-500">This CV could not be displayed. Run the analysis again.</p>
            )}
          </Card>
        </div>

        <Card title="Job posting">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-accent-700">Show the analysed text</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-xs text-slate-700">
              {analysis.job_text}
            </pre>
          </details>
          {analysis.job_source_url ? (
            <p className="mt-3 text-sm">
              <a href={analysis.job_source_url} target="_blank" rel="noreferrer" className={buttonStyles.link}>
                Open original posting ↗
              </a>
            </p>
          ) : null}
        </Card>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Generated with {analysis.model || "AI"}. Review everything before sending it.</span>
          <form action={deleteAnalysis}>
            <input type="hidden" name="id" value={analysis.id} />
            <SubmitButton
              variant="dangerLink"
              pendingLabel="Deleting…"
              confirmMessage="Delete this analysis, its cover letter and tailored CV?"
            >
              Delete analysis
            </SubmitButton>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
