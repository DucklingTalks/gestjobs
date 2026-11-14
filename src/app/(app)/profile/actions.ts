"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { compactProfile, profileSchema, profileToRow } from "@/lib/validation/profile";

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
