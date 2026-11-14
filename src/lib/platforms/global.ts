import type { createClient } from "@/lib/supabase/server";

import type { Platform } from "./infer";
import { seedPlatforms } from "./seed";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Load the global platform directory (`user_id is null`) with real row ids.
 *
 * The combobox needs ids so that picking "LinkedIn" submits the seeded row's
 * UUID instead of falling through to the custom-platform upsert, which would
 * create a per-user duplicate. If the query fails or the table has not been
 * seeded yet, fall back to the static `seedPlatforms` mirror (id: null); the
 * server action then resolves those by hostname.
 */
export async function loadGlobalPlatforms(
  supabase: ServerClient,
): Promise<ReadonlyArray<Platform>> {
  const { data, error } = await supabase
    .from("platforms")
    .select("id, name, hostname")
    .is("user_id", null)
    .order("name");

  if (error || !data?.length) return seedPlatforms;

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    isCustom: false,
  }));
}
