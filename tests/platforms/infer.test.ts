/**
 * Unit tests for the platform hostname inference helpers.
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/platforms/spec.md
 *   § Requirement: Hostname Inference, Seeded Platform Directory,
 *                 Searchable Combobox and Manual Fallback
 *
 * What we test (one assertion per spec scenario):
 *   1. "Known hostname"             → infer resolves to the right seeded entry.
 *   2. "Unknown hostname"           → infer returns null; combobox shows manual fallback.
 *   3. "Invalid URL rejected"       → normalize throws InvalidUrlError; infer catches and returns null.
 *   4. "Search seeded platforms"    → search returns the matching seeded entry.
 *   5. "Search broad board"         → search returns Latin-American board on substring match.
 *   6. "Normalized hostname storage" → normalize strips "www.", lowercases, drops trailing path.
 *
 * The seed list comes from `src/lib/platforms/seed.ts`, which is the
 * client-side mirror of `supabase/seed.sql`. PR 6 keeps the two files
 * mirrored (see I5-PR2).
 */
import { describe, expect, it } from "vitest";

import {
  InvalidUrlError,
  inferPlatformFromUrl,
  normalizeHostname,
  searchPlatforms,
  type Platform,
} from "@/lib/platforms/infer";
import { seedPlatforms } from "@/lib/platforms/seed";

const platformByHostname = (
  hostname: string,
  platforms: ReadonlyArray<Platform> = seedPlatforms,
): Platform | undefined => platforms.find((p) => p.hostname === hostname);

describe("normalizeHostname", () => {
  it("lowercases the hostname and preserves the public suffix", () => {
    expect(
      normalizeHostname("https://Boards.Greenhouse.IO/vacancy/123"),
    ).toBe("boards.greenhouse.io");
  });

  it("strips a leading www. label", () => {
    expect(normalizeHostname("https://www.linkedin.com/jobs/view/123")).toBe(
      "linkedin.com",
    );
  });

  it("throws InvalidUrlError on empty input", () => {
    expect(() => normalizeHostname("")).toThrowError(InvalidUrlError);
    expect(() => normalizeHostname("   ")).toThrowError(InvalidUrlError);
  });

  it("throws InvalidUrlError on non-HTTP(S) protocols", () => {
    expect(() => normalizeHostname("ftp://example.com")).toThrowError(
      InvalidUrlError,
    );
    expect(() => normalizeHostname("javascript:alert(1)")).toThrowError(
      InvalidUrlError,
    );
  });

  it("throws InvalidUrlError on malformed input", () => {
    expect(() => normalizeHostname("not a url")).toThrowError(
      InvalidUrlError,
    );
  });
});

describe("inferPlatformFromUrl", () => {
  it("resolves a known hostname to its seeded platform", () => {
    const match = inferPlatformFromUrl("https://www.linkedin.com/jobs/123", seedPlatforms);
    expect(match?.name).toBe("LinkedIn");
    expect(match?.hostname).toBe("linkedin.com");
  });

  it("resolves a known subdomain (boards.greenhouse.io) exactly", () => {
    const match = inferPlatformFromUrl(
      "https://boards.greenhouse.io/jobs/abc",
      seedPlatforms,
    );
    expect(match?.name).toBe("Greenhouse");
  });

  it("resolves a known subdomain (jobs.lever.co) exactly", () => {
    const match = inferPlatformFromUrl(
      "https://jobs.lever.co/example",
      seedPlatforms,
    );
    expect(match?.name).toBe("Lever");
  });

  it("returns null for an unknown hostname (manual fallback)", () => {
    const match = inferPlatformFromUrl(
      "https://example-ats.com/job/123",
      seedPlatforms,
    );
    expect(match).toBeNull();
  });

  it("returns null for invalid URLs (graceful fallback for live typing)", () => {
    expect(inferPlatformFromUrl("not a url", seedPlatforms)).toBeNull();
    expect(inferPlatformFromUrl("ftp://example.com", seedPlatforms)).toBeNull();
    expect(inferPlatformFromUrl("", seedPlatforms)).toBeNull();
  });

  it("uses the suffix-match branch for deeper hostnames", () => {
    // `uy.computrabajo.com.uy` → drop "uy." → "computrabajo.com.uy" matches the seed.
    const match = inferPlatformFromUrl(
      "https://uy.computrabajo.com.uy/job/456",
      seedPlatforms,
    );
    expect(match?.name).toBe("Computrabajo");
  });

  it("never throws on bad URL input", () => {
    expect(() =>
      inferPlatformFromUrl("::not::parseable::", seedPlatforms),
    ).not.toThrow();
  });
});

describe("searchPlatforms", () => {
  it("returns seeded platforms by case-insensitive substring match (gallito)", () => {
    const results = searchPlatforms("gallito", seedPlatforms);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.name === "Gallito Uruguay")).toBe(true);
  });

  it("returns Latin-American boards on broad substring (computrabajo)", () => {
    const results = searchPlatforms("computrabajo", seedPlatforms);
    expect(results.some((p) => p.name === "Computrabajo")).toBe(true);
  });

  it("returns an empty list for empty queries", () => {
    expect(searchPlatforms("", seedPlatforms)).toEqual([]);
    expect(searchPlatforms("   ", seedPlatforms)).toEqual([]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchPlatforms("zzz-nonexistent-zzz", seedPlatforms)).toEqual([]);
  });

  it("matches case-insensitively", () => {
    const lower = searchPlatforms("linkedin", seedPlatforms);
    const upper = searchPlatforms("LINKEDIN", seedPlatforms);
    expect(lower.map((p) => p.name)).toEqual(upper.map((p) => p.name));
  });
});

describe("seed ↔ SQL drift coverage", () => {
  it("covers every docstring-listed seeded platform", () => {
    const expectedNames = [
      "LinkedIn",
      "Indeed",
      "Glassdoor",
      "Greenhouse",
      "Lever",
      "Computrabajo",
      "Gallito Uruguay",
      "BuscoJobs",
      "Workable",
      "SmartRecruiters",
    ];
    for (const name of expectedNames) {
      const platform = seedPlatforms.find((p) => p.name === name);
      expect(platform, `seeded platform "${name}" must exist`).toBeDefined();
      expect(platform?.isCustom).toBe(false);
      expect((platform?.hostname ?? "").length).toBeGreaterThan(0);
    }
  });

  it("uses normalized hostnames (lowercase, no protocol, no trailing slash)", () => {
    for (const platform of seedPlatforms) {
      expect(platform.hostname).toBe(platform.hostname.toLowerCase());
      expect(platform.hostname).not.toContain("://");
      expect(platform.hostname).not.toContain("/");
      expect(platform.hostname.startsWith("www.")).toBe(false);
    }
  });

  it("preserves a working platform lookup helper for tests/callers", () => {
    expect(platformByHostname("linkedin.com")).toBeDefined();
  });
});
