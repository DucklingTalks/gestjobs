/**
 * Client-side mirror of `supabase/seed.sql` global platform directory.
 *
 * The platform combobox (PR 2) and the new-application form (PR 4) need to
 * render the seeded list before any Supabase round-trip resolves. This file
 * provides that initial list as a typed, frozen array.
 *
 * IMPORTANT: this is a SOURCE OF TRUTH DUPLICATE. If you add or rename a
 * platform, you MUST update both files. A drift check is a reasonable PR 6
 * candidate (Vitest unit test that diffs the SQL INSERT rows against the
 * exported constant).
 *
 * Hostnames match `supabase/seed.sql` 1-for-1 and use the same normalized
 * form (`infer.normalizeHostname` would produce the same output).
 */

import type { Platform } from "./infer";

/**
 * Frozen constant so callers cannot mutate the seed list by accident.
 * Combobox code should treat `seedPlatforms` as read-only and concatenate
 * the user's custom rows at render time.
 */
export const seedPlatforms: ReadonlyArray<Platform> = Object.freeze([
  { id: null, name: "LinkedIn",        hostname: "linkedin.com",            isCustom: false },
  { id: null, name: "Indeed",          hostname: "indeed.com",              isCustom: false },
  { id: null, name: "Glassdoor",       hostname: "glassdoor.com",           isCustom: false },
  { id: null, name: "Greenhouse",      hostname: "boards.greenhouse.io",    isCustom: false },
  { id: null, name: "Lever",           hostname: "jobs.lever.co",           isCustom: false },
  { id: null, name: "Computrabajo",    hostname: "computrabajo.com.uy",     isCustom: false },
  { id: null, name: "Gallito Uruguay", hostname: "gallito.com.uy",          isCustom: false },
  { id: null, name: "BuscoJobs",       hostname: "buscojobs.com.uy",        isCustom: false },
  { id: null, name: "Workable",        hostname: "apply.workable.com",      isCustom: false },
  { id: null, name: "SmartRecruiters", hostname: "jobs.smartrecruiters.com", isCustom: false },
]);
