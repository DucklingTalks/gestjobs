"use server";

/**
 * Server actions for the `applications` route segment.
 *
 * PR 2 owns `upsertCustomPlatform` only — the create / update / delete /
 * status-change / attach-resume / attach-contact actions land in PR 4.
 * Keeping this file scoped to platform persistence now lets PR 4 add the
 * rest of the actions without rewriting the imports that the combobox
 * already wires up.
 *
 * Conventions used by every action in this file:
 *   - All exports are async and return a discriminated union
 *     `{ ok: true, ... } | { ok: false, error }`. Forms check `result.ok`
 *     and surface `result.error` to the user.
 *   - Every action re-fetches the current user with `supabase.auth.getUser`
 *     and refuses to write if `auth.uid()` is null. RLS policies in
 *     `001_initial_schema.sql` enforce the same at the database layer; the
 *     client-side check exists to return a friendly error instead of a
 *     raw Postgres exception.
 */

import { createClient } from "@/lib/supabase/server";
import type { Platform } from "@/lib/platforms/infer";

export type UpsertCustomPlatformInput = {
  name: string;
  /**
   * Pre-normalized hostname (e.g. "boards.greenhouse.io"). The caller is
   * responsible for running `normalizeHostname` from `@/lib/platforms/infer`
   * over the raw URL it captured from the form. The action validates that
   * the input matches a basic hostname shape but does not re-parse a URL
   * — the form already has the URL in hand.
   */
  hostname: string;
};

export type UpsertCustomPlatformResult =
  | {
      ok: true;
      platform: Platform;
    }
  | {
      ok: false;
      error: string;
    };

const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Insert (or rename) a per-user custom platform.
 *
 * Persists `{ user_id, name, hostname, is_custom: true }` into `platforms`.
 * The unique index `(user_id, hostname)` makes the upsert idempotent — a
 * second call with the same `hostname` updates the `name` instead of
 * creating a duplicate row. Spec scenario "Reuse custom platform" relies
 * on this so that a hostname a user typed once never produces two rows.
 *
 * Spec scenarios covered:
 *   - "Custom platform entry" — first call inserts a new row, returns it.
 *   - "Reuse custom platform" — subsequent calls with the same hostname
 *     resolve to the existing row and the form sees the original `id`.
 *   - "Normalized hostname storage" — the caller passes a normalized
 *     hostname (no protocol, no leading "www.", lowercase).
 */
export async function upsertCustomPlatform(
  input: UpsertCustomPlatformInput,
): Promise<UpsertCustomPlatformResult> {
  const name = input.name.trim();
  const hostname = input.hostname.trim().toLowerCase();

  if (!name) {
    return { ok: false, error: "Platform name is required." };
  }
  if (name.length > 100) {
    return { ok: false, error: "Platform name must be 100 characters or fewer." };
  }
  if (!hostname) {
    return { ok: false, error: "Platform hostname is required." };
  }
  if (!HOSTNAME_PATTERN.test(hostname)) {
    return {
      ok: false,
      error: `Hostname "${hostname}" is not a valid hostname.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to save a custom platform.",
    };
  }

  const { data, error } = await supabase
    .from("platforms")
    .upsert(
      {
        user_id: user.id,
        name,
        hostname,
        is_custom: true,
      },
      { onConflict: "user_id,hostname" },
    )
    .select("id, user_id, name, hostname, is_custom")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return {
      ok: false,
      error: "Custom platform could not be saved (empty response).",
    };
  }

  return {
    ok: true,
    platform: {
      id: data.id,
      name: data.name,
      hostname: data.hostname,
      isCustom: data.is_custom,
    },
  };
}
