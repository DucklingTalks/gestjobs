"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { aiModel, isAiConfigured } from "@/lib/ai/client";
import { extractDocumentText } from "@/lib/ai/documents";
import { analyzeFit, finalizeCoverLetter, writeFitDocuments, type FitDocuments } from "@/lib/ai/fit";
import { parseStoredKeywords, toStoredKeywords } from "@/lib/ats/cv";
import { findEvidence, matchKeywords, profileEvidence, type PersonalAlias } from "@/lib/ats/keywords";
import { fetchJobPosting } from "@/lib/jobs/fetch-posting";
import { createClient } from "@/lib/supabase/server";
import { isProfileUsable, PROFILE_COLUMNS, profileFromRow } from "@/lib/validation/profile";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MIN_JOB_TEXT = 120;

type CreateResult = { ok: true; id: string } | { ok: false; error: string };

async function createAnalysis(
  supabase: Supabase,
  userId: string,
  job: { text: string; sourceUrl: string | null; title: string; company: string; applicationId: string | null },
): Promise<CreateResult> {
  if (!isAiConfigured()) {
    return { ok: false, error: "AI is not configured. Add OPENCODE_API_KEY to the environment." };
  }

  const { data: row, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) return { ok: false, error: "Unable to load your profile." };

  const profile = profileFromRow(row);
  if (!isProfileUsable(profile)) {
    return {
      ok: false,
      error: "Complete your profile first (experience, education or skills) so there is something to compare.",
    };
  }

  if (job.text.trim().length < MIN_JOB_TEXT) {
    return { ok: false, error: "The job posting is too short to analyse. Paste the full description." };
  }

  const [result, personal] = await Promise.all([analyzeFit(profile, job.text), loadPersonalAliases(supabase, userId)]);
  if (!result.ok) return result;

  const fit = result.data;
  const keywords = toStoredKeywords(matchKeywords(fit.keywords, profileEvidence(profile), job.text, personal));
  const { data: inserted, error } = await supabase
    .from("fit_analyses")
    .insert({
      user_id: userId,
      application_id: job.applicationId,
      job_title: job.title || fit.jobTitle,
      company: job.company || fit.company,
      job_source_url: job.sourceUrl,
      job_text: job.text,
      language: fit.language,
      score: fit.score,
      summary: fit.summary,
      strengths: fit.strengths,
      gaps: fit.gaps,
      cover_letter: finalizeCoverLetter(fit.coverLetter, profile.fullName),
      cv: fit.cv,
      keywords,
      model: aiModel(),
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, error: "The analysis finished but could not be saved." };
  return { ok: true, id: inserted.id };
}

/** The user's confirmed pairs. A failure only means no personal matches. */
async function loadPersonalAliases(supabase: Supabase, userId: string): Promise<PersonalAlias[]> {
  const { data } = await supabase.from("skill_aliases").select("posting_term, profile_term").eq("user_id", userId);
  return (data ?? []).map((row) => ({ postingTerm: row.posting_term, profileTerm: row.profile_term }));
}

export type FitFormState = { error: string | null };

/** Standalone analysis from pasted text or a URL (/fit). */
export async function runFitAnalysis(_prev: FitFormState, formData: FormData): Promise<FitFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pasted = String(formData.get("jobText") ?? "").trim();
  const url = String(formData.get("jobUrl") ?? "").trim();

  let job = { text: pasted, sourceUrl: url || null, title: "", company: "" };
  if (!pasted) {
    if (!url) return { error: "Paste the job description or a link to it." };
    const posting = await fetchJobPosting(url);
    if (!posting.ok) return { error: posting.error };
    job = { text: posting.text, sourceUrl: url, title: posting.title, company: posting.company };
  }

  const result = await createAnalysis(supabase, user.id, { ...job, applicationId: null });
  if (!result.ok) return { error: result.error };

  revalidatePath("/fit");
  redirect(`/fit/${result.id}?status=analysed`);
}

const idSchema = z.string().uuid();

/** Analysis for an existing application, using its stored job description. */
export async function analyzeApplication(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!idSchema.safeParse(applicationId).success) redirect("/applications");

  const back = (message: string): never =>
    redirect(`/applications/${applicationId}?error=${encodeURIComponent(message)}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: application } = await supabase
    .from("applications")
    .select("id, company_name, position_title, platform_url, job_proposal_text, job_proposal_url, job_proposal_file_path")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!application) redirect("/applications");

  let text = application.job_proposal_text?.trim() ?? "";
  let sourceUrl: string | null = application.job_proposal_url ?? null;

  if (!text && application.job_proposal_file_path) {
    const { data: blob } = await supabase.storage.from("proposals").download(application.job_proposal_file_path);
    if (blob) {
      const name = application.job_proposal_file_path.split("/").pop() ?? "proposal";
      const extracted = await extractDocumentText(new File([blob], name, { type: blob.type }));
      if (extracted.ok) text = extracted.text;
    }
  }

  if (!text) {
    const url = application.job_proposal_url || application.platform_url;
    if (url) {
      const posting = await fetchJobPosting(url);
      if (posting.ok) {
        text = posting.text;
        sourceUrl = url;
      }
    }
  }

  if (!text) {
    back("Add the job description to this application (Edit → Job description) to analyse your fit.");
  }

  const header = `${application.position_title} — ${application.company_name}`;
  const result = await createAnalysis(supabase, user.id, {
    text: text.startsWith(header) ? text : `${header}\n\n${text}`,
    sourceUrl,
    title: application.position_title,
    company: application.company_name,
    applicationId: application.id,
  });
  if (!result.ok) back(result.error);

  revalidatePath(`/applications/${applicationId}`);
  redirect(`/fit/${(result as { id: string }).id}?status=analysed`);
}

/**
 * Analyse the same posting again with the current profile, e.g. after the
 * gap interview added strengths. The new analysis is kept alongside the old
 * one, linked to the same application.
 */
export async function reanalyzeFit(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!idSchema.safeParse(id).success) redirect("/fit");
  const back = (message: string): never => redirect(`/fit/${id}?error=${encodeURIComponent(message)}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: analysis } = await supabase
    .from("fit_analyses")
    .select("id, application_id, job_title, company, job_source_url, job_text")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis) redirect("/fit");

  const result = await createAnalysis(supabase, user.id, {
    text: analysis.job_text,
    sourceUrl: analysis.job_source_url,
    title: analysis.job_title,
    company: analysis.company,
    applicationId: analysis.application_id,
  });
  if (!result.ok) back(result.error);

  revalidatePath("/fit");
  if (analysis.application_id) revalidatePath(`/applications/${analysis.application_id}`);
  redirect(`/fit/${(result as { id: string }).id}?status=analysed`);
}

/**
 * Write the cover letter and CV for a low-fit analysis, when the candidate
 * decides to apply anyway. This is the only extra AI call; good fits get
 * their documents in the analysis call itself.
 */
export async function generateFitDocuments(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!idSchema.safeParse(id).success) redirect("/fit");
  const back = (message: string): never => redirect(`/fit/${id}?error=${encodeURIComponent(message)}`);

  if (!isAiConfigured()) back("AI is not configured. Add OPENCODE_API_KEY to the environment.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: analysis }, { data: profileRow }] = await Promise.all([
    supabase
      .from("fit_analyses")
      .select("id, job_text, language, score, summary, strengths, gaps, cover_letter")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!analysis) redirect("/fit");
  // Already written (e.g. a double submit): nothing to pay for.
  if (analysis.cover_letter.trim()) redirect(`/fit/${id}`);

  const profile = profileFromRow(profileRow);
  const result = await writeFitDocuments(profile, analysis.job_text, analysis);
  if (!result.ok) back(result.error);
  const documents = (result as { ok: true; data: FitDocuments }).data;

  const { error } = await supabase
    .from("fit_analyses")
    .update({
      cover_letter: finalizeCoverLetter(documents.coverLetter, profile.fullName),
      cv: documents.cv,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) back("The documents were written but could not be saved.");

  revalidatePath(`/fit/${id}`);
  redirect(`/fit/${id}?status=documents-ready`);
}

/** Save edits to the cover letter. */
export async function saveCoverLetter(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!idSchema.safeParse(id).success) redirect("/fit");
  const letter = String(formData.get("coverLetter") ?? "").slice(0, 8_000);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("fit_analyses")
    .update({ cover_letter: letter, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) redirect(`/fit/${id}?error=${encodeURIComponent("Unable to save the cover letter.")}`);
  revalidatePath(`/fit/${id}`);
  redirect(`/fit/${id}?status=letter-saved`);
}

/** Switch one renamed keyword between the posting's wording and the profile's own. */
export async function toggleKeywordRename(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const index = Number(formData.get("index"));
  if (!idSchema.safeParse(id).success) redirect("/fit");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: analysis } = await supabase
    .from("fit_analyses")
    .select("keywords")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis) redirect("/fit");

  const keywords = parseStoredKeywords(analysis.keywords);
  const keyword = Number.isInteger(index) ? keywords[index] : undefined;
  if (!keyword || keyword.status !== "renamed") redirect(`/fit/${id}`);
  keywords[index] = { ...keyword, applied: !keyword.applied };

  const { error } = await supabase
    .from("fit_analyses")
    .update({ keywords, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) redirect(`/fit/${id}?error=${encodeURIComponent("Unable to update the keyword.")}`);
  revalidatePath(`/fit/${id}`);
  redirect(`/fit/${id}?status=keyword-updated#keywords`);
}

/**
 * Confirm that a related or missing keyword is something the profile has
 * under another name. It becomes a rename in this analysis and is saved as a
 * personal alias for future ones. The profile must really mention the term.
 */
export async function confirmKeywordAlias(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const index = Number(formData.get("index"));
  if (!idSchema.safeParse(id).success) redirect("/fit");
  const back = (message: string): never =>
    redirect(`/fit/${id}?error=${encodeURIComponent(message)}#keywords`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: analysis }, { data: profileRow }] = await Promise.all([
    supabase.from("fit_analyses").select("keywords").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!analysis) redirect("/fit");

  const keywords = parseStoredKeywords(analysis.keywords);
  const keyword = Number.isInteger(index) ? keywords[index] : undefined;
  if (!keyword || (keyword.status !== "related" && keyword.status !== "missing")) redirect(`/fit/${id}`);

  const requested = String(formData.get("profileTerm") ?? keyword.profileTerm ?? "").trim().slice(0, 160);
  if (!requested) back("Enter the name your profile uses for it.");
  const evidence = findEvidence(profileEvidence(profileFromRow(profileRow)), requested);
  if (!evidence) back(`“${requested}” is not in your profile. Add it there first.`);
  const profileTerm = evidence as string;

  const { error: aliasError } = await supabase
    .from("skill_aliases")
    .insert({ user_id: user.id, posting_term: keyword.term.slice(0, 80), profile_term: profileTerm });
  // 23505: the pair is already saved (in any casing); nothing to add.
  if (aliasError && aliasError.code !== "23505") back("Unable to save the alias.");

  keywords[index] = { ...keyword, status: "renamed", profileTerm, applied: true };
  const { error } = await supabase
    .from("fit_analyses")
    .update({ keywords, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) back("Unable to update the keyword.");

  revalidatePath(`/fit/${id}`);
  revalidatePath("/profile");
  redirect(`/fit/${id}?status=alias-saved#keywords`);
}

export async function deleteAnalysis(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!idSchema.safeParse(id).success) redirect("/fit");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("fit_analyses").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/fit");
  redirect("/fit?status=analysis-deleted");
}
