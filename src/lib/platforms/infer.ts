/**
 * Platform hostname inference.
 *
 * Pure, deterministic helpers used by the platform combobox (PR 2) and the
 * application form (PR 4). No network, no DOM, no React — just string work
 * over a `Platform` list so it can run identically on the server, in the
 * browser, and inside Server Actions.
 *
 * Design references:
 *   - specs/platforms/spec.md — Hostname Inference scenarios
 *   - design.md § "Architecture Decisions" — Platform inference = client-side
 *     hostname parse + server validation (we expose both shapes here)
 */

/**
 * Minimal shape required for inference. Mirrors the relevant columns of the
 * `platforms` table but does not import the generated Database type (PR 6
 * will swap that in once `supabase gen types` runs against a real project).
 *
 * `id` is `null` for unsaved / in-memory platforms (e.g. a free-text entry
 * the user has typed but not yet confirmed). `isCustom` mirrors the DB flag
 * so the combobox can style seeded vs user-added rows differently.
 */
export type Platform = {
  id: string | null;
  name: string;
  hostname: string;
  isCustom: boolean;
};

/**
 * Thrown when a URL cannot be parsed as a valid HTTP(S) URL. The combobox
 * catches it silently (unknown hostnames and malformed URLs both surface
 * as "no inference — please search or add manually"); the application form
 * surfaces it as an observable validation error per spec scenario
 * "Invalid URL rejected".
 */
export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUrlError";
  }
}

/**
 * Normalize any input string into a bare hostname suitable for matching
 * against the `platforms.hostname` column.
 *
 *   "https://Boards.Greenhouse.IO/vacancy/123"
 *     -> "boards.greenhouse.io"
 *   "www.linkedin.com/jobs/view/123"
 *     -> "linkedin.com"
 *   "ftp://example.com"
 *     -> throws InvalidUrlError (non-HTTP(S) protocol)
 *   "not a url"
 *     -> throws InvalidUrlError (URL constructor rejects)
 */
export function normalizeHostname(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new InvalidUrlError("URL is empty");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new InvalidUrlError(`Invalid URL: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidUrlError(
      `URL must use HTTP or HTTPS (got "${url.protocol.replace(":", "")}")`,
    );
  }

  const host = url.hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

/**
 * Match a URL against a platform list.
 *
 * Match strategy (most specific wins):
 *   1. Exact hostname match (`boards.greenhouse.io` -> "Greenhouse").
 *   2. Suffix match — strips the leftmost label(s) and retries. This lets a
 *      deeper hostname such as `uy.computrabajo.com.uy` resolve to a platform
 *      registered as `computrabajo.com.uy`, which is common for regional ATS
 *      subdomains.
 *
 * Returns `null` when:
 *   - The URL is invalid or non-HTTP(S) (graceful fallback for live typing).
 *   - The hostname matches no platform (spec scenario "Unknown hostname").
 *
 * Never throws — callers that need to distinguish "bad URL" from "unknown
 * host" should call `normalizeHostname` directly inside their try/catch.
 */
export function inferPlatformFromUrl(
  url: string,
  platforms: ReadonlyArray<Platform>,
): Platform | null {
  let hostname: string;
  try {
    hostname = normalizeHostname(url);
  } catch {
    return null;
  }

  const exact = platforms.find((p) => p.hostname === hostname);
  if (exact) return exact;

  const labels = hostname.split(".");
  // Try every suffix of length >= 2 labels (skip the TLD alone — too noisy).
  for (let drop = 1; drop < labels.length - 1; drop += 1) {
    const suffix = labels.slice(drop).join(".");
    const match = platforms.find((p) => p.hostname === suffix);
    if (match) return match;
  }

  return null;
}

/**
 * Case-insensitive substring search over platform names for the combobox
 * dropdown. The combobox also offers a "create new" affordance when the
 * query has no match — that lives in the component, not here.
 */
export function searchPlatforms(
  query: string,
  platforms: ReadonlyArray<Platform>,
): Platform[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return platforms.filter((p) => p.name.toLowerCase().includes(needle));
}
