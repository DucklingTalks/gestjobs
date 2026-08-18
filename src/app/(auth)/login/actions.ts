"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Send a Supabase magic-link email to the supplied address.
 *
 * On success, Supabase emails the user a one-time link that lands back on
 * `${origin}/auth/callback` (handled in PR 4 once the auth callback route
 * is needed for full session exchange; for now the redirect URL just needs
 * to be a valid absolute URL on the project's site allow-list).
 */
export async function signInWithOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const origin = String(formData.get("origin") ?? "");

  if (!email) {
    redirect("/login?error=missing-email");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?status=otp-sent");
}