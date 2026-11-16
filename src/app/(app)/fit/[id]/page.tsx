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
        "id, application_id, job_title, company, job_source_url, job_text, language, score, summary, strengths, gaps, cover_letter, cv, model, created_at",
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
          <>
            <Link href="/fit" className={buttonStyles.secondary}>
              <span aria-hidden="true">+</span> New analysis
            </Link>
            {analysis.application_id ? (
              <Link href={`/applications/${analysis.application_id}`} className={buttonStyles.primary}>
                View application
              </Link>
            ) : (
              <Link href={`/applications/new?fromFit=${analysis.id}`} className={buttonStyles.primary}>
                Add as application
              </Link>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <FitScoreHero score={analysis.score} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{fitLabel(analysis.score)}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
              {!analysis.application_id && analysis.score >= 5 ? (
                <p className="mt-3 text-sm">
                  <Link href={`/applications/new?fromFit=${analysis.id}`} className={buttonStyles.link}>
                    Worth applying? Add it to your applications →
                  </Link>
                </p>
              ) : null}
            </div>
          </div>

          {analysis.strengths.length || analysis.gaps.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ReasonList tone="fit" title="Fit" subtitle="Why you match" items={analysis.strengths} />
              <ReasonList tone="gap" title="Gap" subtitle="What may hold you back" items={analysis.gaps} />
            </div>
          ) : null}
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

const reasonTones = {
  fit: { box: "bg-emerald-50/60 ring-emerald-600/15", title: "text-emerald-800", icon: "text-emerald-600", mark: "✓" },
  gap: { box: "bg-amber-50/60 ring-amber-600/15", title: "text-amber-800", icon: "text-amber-600", mark: "!" },
} as const;

function ReasonList({
  tone,
  title,
  subtitle,
  items,
}: {
  tone: keyof typeof reasonTones;
  title: string;
  subtitle: string;
  items: string[];
}) {
  const t = reasonTones[tone];
  return (
    <section className={`rounded-xl p-4 ring-1 ring-inset ${t.box}`} aria-label={`${title}: ${subtitle}`}>
      <h2 className={`text-sm font-semibold ${t.title}`}>
        {title} <span className="font-normal text-slate-500">· {subtitle}</span>
      </h2>
      {items.length ? (
        <ul className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span aria-hidden="true" className={`mt-px w-3 shrink-0 text-center font-bold ${t.icon}`}>
                {t.mark}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Nothing significant.</p>
      )}
    </section>
  );
}
