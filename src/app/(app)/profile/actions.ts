"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isAiConfigured } from "@/lib/ai/client";
import { extractDocumentText } from "@/lib/ai/documents";
import {
  interviewTurn,
  mergeStrengths,
  summarizeInterview,
  type InterviewFocus,
  type InterviewTurn,
} from "@/lib/ai/interview";
import { importResumeText } from "@/lib/ai/resume-import";
import { createClient } from "@/lib/supabase/server";
import { candidateAnswers, MIN_ANSWERS_TO_SUMMARIZE, transcriptSchema } from "@/lib/validation/interview";
import {
  compactProfile,
  MAX_STRENGTHS,
  PROFILE_COLUMNS,
  profileFromRow,
  profileSchema,
  profileToRow,
  strengthSchema,
  type Profile,
  type Strength,
} from "@/lib/validation/profile";

export type ProfileFormState = { error: string | null };

/**
 * Save the whole profile. The client form serialises its state to JSON in a
 * single `payload` field so nested lists (experience, education, …) round-trip
 * without index-based field names.
 */
export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "The form data could not be read. Refresh and try again." };
  }

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(" › ")})` : "";
    return { error: `${issue?.message ?? "Invalid profile."}${where}` };
  }

  const profile = compactProfile(parsed.data);
  const { error } = await supabase.from("profiles").upsert(
    { user_id: user.id, ...profileToRow(profile), updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: "Unable to save your profile. Try again in a moment." };
  }

  revalidatePath("/profile");
  redirect("/profile?status=profile-saved");
}

export type ImportResumeState = {
  error: string | null;
  profile: Profile | null;
  /** Changes on every successful import so the client can apply it once. */
  importedAt: number | null;
};

/**
 * Read an uploaded CV (PDF/DOCX), redact contact details, and have the AI
 * map it to a Profile. Nothing is saved: the client loads the result into
 * the form for review.
 */
export async function importResume(
  _prev: ImportResumeState,
  formData: FormData,
): Promise<ImportResumeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("resume");
  if (!(file instanceof File) || !file.size) {
    return { error: "Choose a PDF or DOCX file first.", profile: null, importedAt: null };
  }

  const extracted = await extractDocumentText(file);
  if (!extracted.ok) return { error: extracted.error, profile: null, importedAt: null };

  const result = await importResumeText(extracted.text);
  if (!result.ok) return { error: result.error, profile: null, importedAt: null };

  return { error: null, profile: result.data, importedAt: Date.now() };
}

/** Remove one personal ATS alias. Existing analyses keep their keywords as they are. */
export async function deleteSkillAlias(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) redirect("/profile");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("skill_aliases").delete().eq("id", id).eq("user_id", user.id);
  if (error) redirect(`/profile?error=${encodeURIComponent("Unable to remove the alias.")}#aliases`);

  revalidatePath("/profile");
  redirect("/profile?status=alias-deleted#aliases");
}

// --- AI interview -------------------------------------------------------------

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireUser(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

async function loadProfile(supabase: Supabase, userId: string) {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  return { profile: profileFromRow(data), exists: Boolean(data), error };
}

/**
 * The gaps of one of the user's analyses, when the interview is about that
 * job. Loaded on the server so the client cannot inject its own "gaps".
 */
async function loadFocus(supabase: Supabase, userId: string, analysisId: unknown): Promise<InterviewFocus | null> {
  const id = z.string().uuid().safeParse(analysisId);
  if (!id.success) return null;
  const { data } = await supabase
    .from("fit_analyses")
    .select("job_title, company, gaps")
    .eq("id", id.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.gaps.length) return null;
  return { jobTitle: data.job_title, company: data.company, gaps: data.gaps };
}

export type InterviewTurnResult = { ok: true; turn: InterviewTurn } | { ok: false; error: string };

/** Next interviewer message. The client owns the transcript and sends it whole. */
export async function nextInterviewTurn(transcript: unknown, analysisId?: string): Promise<InterviewTurnResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!isAiConfigured()) return { ok: false, error: "AI is not configured. Add OPENCODE_API_KEY to the environment." };

  const parsed = transcriptSchema.safeParse(transcript);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid conversation." };

  const { profile, error } = await loadProfile(supabase, user.id);
  if (error) return { ok: false, error: "Unable to load your profile." };

  const focus = await loadFocus(supabase, user.id, analysisId);
  const result = await interviewTurn(profile, parsed.data, focus);
  return result.ok ? { ok: true, turn: result.data } : result;
}

export type InterviewSummaryResult = { ok: true; strengths: Strength[] } | { ok: false; error: string };

/** Strengths proposed from the conversation. Nothing is saved here. */
export async function proposeStrengths(transcript: unknown, analysisId?: string): Promise<InterviewSummaryResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!isAiConfigured()) return { ok: false, error: "AI is not configured. Add OPENCODE_API_KEY to the environment." };

  const parsed = transcriptSchema.safeParse(transcript);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid conversation." };
  if (candidateAnswers(parsed.data) < MIN_ANSWERS_TO_SUMMARIZE) {
    return { ok: false, error: `Answer at least ${MIN_ANSWERS_TO_SUMMARIZE} questions first.` };
  }

  const { profile, error } = await loadProfile(supabase, user.id);
  if (error) return { ok: false, error: "Unable to load your profile." };

  const focus = await loadFocus(supabase, user.id, analysisId);
  const result = await summarizeInterview(profile, parsed.data, focus);
  return result.ok ? { ok: true, strengths: result.data } : result;
}

export type SaveStrengthsResult = { ok: true; added: number } | { ok: false; error: string };

/** Append the strengths the candidate kept to the profile, merging by name. */
export async function saveInterviewStrengths(strengths: unknown): Promise<SaveStrengthsResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const parsed = strengthSchema.array().max(MAX_STRENGTHS).safeParse(strengths);
  if (!parsed.success) return { ok: false, error: "Some strengths are invalid. Check names and evidence." };
  const incoming = parsed.data.filter((strength) => strength.name);
  if (!incoming.length) return { ok: false, error: "Keep at least one strength to save." };

  const { profile, exists, error } = await loadProfile(supabase, user.id);
  if (error) return { ok: false, error: "Unable to load your profile." };

  const merged = mergeStrengths(profile.strengths, incoming, MAX_STRENGTHS);
  const before = profile.strengths.length;
  if (merged.length === before && before >= MAX_STRENGTHS) {
    return { ok: false, error: `Your profile already has ${MAX_STRENGTHS} strengths. Remove some first.` };
  }

  const next: Profile = { ...profile, strengths: merged };
  if (!exists && user.email) next.email = user.email;
  const { error: saveError } = await supabase.from("profiles").upsert(
    { user_id: user.id, ...profileToRow(next), updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (saveError) return { ok: false, error: "Unable to save the strengths. Try again in a moment." };

  revalidatePath("/profile");
  return { ok: true, added: merged.length - before };
}
