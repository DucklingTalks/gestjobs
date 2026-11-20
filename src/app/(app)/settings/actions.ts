"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { providerAiConfig, verifyAiKey } from "@/lib/ai/client";
import { isAiProvider, keyHint } from "@/lib/ai/providers";
import { encryptSecret, isKeyEncryptionConfigured } from "@/lib/ai/secret-box";
import { createClient } from "@/lib/supabase/server";

export type AiKeyFormState = { error: string | null };

/** Check the key with the provider, encrypt it and store it for this user. */
export async function saveAiKey(_prev: AiKeyFormState, formData: FormData): Promise<AiKeyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const provider = formData.get("provider");
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!isAiProvider(provider)) return { error: "Choose a provider." };
  if (apiKey.length < 10 || apiKey.length > 500 || /\s/.test(apiKey)) {
    return { error: "That doesn't look like an API key. Paste the whole key, without spaces." };
  }
  if (!isKeyEncryptionConfigured()) {
    return { error: "Keys can't be stored yet: the server is missing AI_KEY_ENCRYPTION_SECRET." };
  }

  const check = await verifyAiKey(providerAiConfig(provider, apiKey));
  if (!check.ok) return { error: check.error };

  const { error } = await supabase.from("ai_credentials").upsert(
    {
      user_id: user.id,
      provider,
      encrypted_key: encryptSecret(apiKey, user.id),
      key_hint: keyHint(apiKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "The key works, but it could not be saved. Try again in a moment." };

  revalidatePath("/", "layout");
  redirect("/settings?status=key-saved");
}

export async function deleteAiKey() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("ai_credentials").delete().eq("user_id", user.id);
  if (error) redirect(`/settings?error=${encodeURIComponent("Unable to remove the key. Try again.")}`);

  revalidatePath("/", "layout");
  redirect("/settings?status=key-removed");
}
