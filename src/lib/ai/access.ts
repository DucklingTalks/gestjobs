import type { User } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase/server";

import { deploymentAiConfig, providerAiConfig, type AiConfig } from "./client";
import { isAiProvider, PROVIDER_INFO, type AiProvider } from "./providers";
import { decryptSecret } from "./secret-box";

/**
 * Which AI key a user's requests use (server-only).
 *
 * 1. Their own key, saved in Settings (encrypted in `ai_credentials`).
 * 2. Otherwise the deployment key, but only for the emails listed in
 *    AI_SHARED_KEY_EMAILS (comma-separated). Everyone else has no AI until
 *    they add a key.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiAccess =
  | { ok: true; config: AiConfig; source: "own" | "shared" }
  | { ok: false; reason: "missing" | "unreadable"; error: string };

export const NO_KEY_MESSAGE = "Add your AI API key in Settings to use the AI features.";

/** Emails allowed to use the deployment key, lowercased. */
export function sharedKeyEmails(raw = process.env.AI_SHARED_KEY_EMAILS ?? ""): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function canUseSharedKey(email: string | null | undefined, raw?: string): boolean {
  return Boolean(email) && sharedKeyEmails(raw).includes(email!.trim().toLowerCase());
}

export type StoredCredential = { provider: AiProvider; keyHint: string; updatedAt: string };

/** What Settings shows: the saved provider and hint, never the key. */
export async function loadStoredCredential(supabase: Supabase, userId: string): Promise<StoredCredential | null> {
  const { data } = await supabase
    .from("ai_credentials")
    .select("provider, key_hint, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !isAiProvider(data.provider)) return null;
  return { provider: data.provider, keyHint: data.key_hint, updatedAt: data.updated_at };
}

export async function resolveAi(supabase: Supabase, user: Pick<User, "id" | "email">): Promise<AiAccess> {
  const { data } = await supabase
    .from("ai_credentials")
    .select("provider, encrypted_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data && isAiProvider(data.provider)) {
    const apiKey = decryptSecret(data.encrypted_key, user.id);
    if (apiKey) return { ok: true, config: providerAiConfig(data.provider, apiKey), source: "own" };
    return {
      ok: false,
      reason: "unreadable",
      error: `Your saved ${PROVIDER_INFO[data.provider].label} key can't be read anymore. Add it again in Settings.`,
    };
  }

  const shared = deploymentAiConfig();
  if (shared && canUseSharedKey(user.email)) return { ok: true, config: shared, source: "shared" };

  return { ok: false, reason: "missing", error: NO_KEY_MESSAGE };
}
