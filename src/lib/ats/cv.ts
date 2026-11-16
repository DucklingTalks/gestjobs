/**
 * Apply keyword matches to the tailored CV, when rendering the preview and
 * the PDF. The AI's CV stays as it was stored. This only rewrites wording,
 * so turning a rename off needs no new AI call.
 *
 * - renamed + applied: every spelling becomes the posting's wording.
 * - renamed + not applied: every spelling becomes the profile's own wording.
 * - exact / renamed: a skill or tool missing from the CV's skills list is
 *   appended, since the profile supports it.
 * - related / missing: never touch the CV.
 */
import { z } from "zod";

import type { TailoredCv } from "@/lib/ai/fit";

import {
  acceptsMatch,
  containingNames,
  sameConcept,
  spellingsOf,
  wordPattern,
  type KeywordMatch,
} from "./keywords";

export const storedKeywordSchema = z.object({
  term: z.string().trim().min(1),
  kind: z.enum(["skill", "tool", "certification", "language", "other"]).catch("other"),
  required: z.boolean().catch(false),
  status: z.enum(["exact", "renamed", "related", "missing"]),
  profileTerm: z.string().nullable().catch(null),
  /** Only meaningful for renamed keywords: use the posting's wording. */
  applied: z.boolean().catch(true),
});

export type StoredKeyword = z.infer<typeof storedKeywordSchema>;

/** Read the stored jsonb leniently; malformed items are dropped. */
export function parseStoredKeywords(value: unknown): StoredKeyword[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = storedKeywordSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function toStoredKeywords(matches: KeywordMatch[]): StoredKeyword[] {
  return matches.map((match) => ({ ...match, applied: true }));
}

const MAX_SKILLS = 30;

const isAcronym = (term: string) => /^[A-Z0-9][A-Z0-9+#&./-]{1,7}$/.test(term.trim());

/** How a renamed keyword is written in the CV. */
function wordingFor(keyword: StoredKeyword): string {
  const posting = keyword.term;
  const own = keyword.profileTerm ?? posting;
  return keyword.status === "renamed" && !keyword.applied ? own : posting;
}

/** In the skills list, an acronym and its long form go together: "Amazon Web Services (AWS)". */
function skillLabel(keyword: StoredKeyword): string {
  const wording = wordingFor(keyword);
  const other = wording === keyword.term ? keyword.profileTerm : keyword.term;
  if (!other || keyword.status !== "renamed") return wording;
  if (isAcronym(wording) && other.includes(" ")) return `${other} (${wording})`;
  if (isAcronym(other) && wording.includes(" ")) return `${wording} (${other})`;
  return wording;
}

/**
 * Replace every spelling of the keyword in free text with `target`. The
 * target itself and other products' names that contain a spelling ("React
 * Native" or "AWS Lambda") are left untouched. Ordinary words ("next",
 * "go") are not renamed; see `acceptsMatch`.
 */
export function rewriteText(text: string, keyword: StoredKeyword, target: string): string {
  const sources = [...spellingsOf(keyword.term), ...(keyword.profileTerm ? [keyword.profileTerm] : [])];
  const keep = [...containingNames(keyword.term), target];
  const pattern = wordPattern([...keep, ...sources], "giu");

  return text.replace(pattern, (found) => {
    if (keep.some((name) => name.toLowerCase() === found.toLowerCase())) return found;
    const source = sources.find((name) => name.toLowerCase() === found.toLowerCase());
    if (!source || !acceptsMatch(source, found)) return found;
    return target;
  });
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function applyKeywords(cv: TailoredCv, keywords: StoredKeyword[]): TailoredCv {
  let result: TailoredCv = structuredClone(cv);

  for (const keyword of keywords) {
    if (keyword.status === "renamed") {
      const target = wordingFor(keyword);
      const label = skillLabel(keyword);
      const rewrite = (value: string) => rewriteText(value, keyword, target);

      result = {
        ...result,
        headline: rewrite(result.headline),
        summary: rewrite(result.summary),
        skills: result.skills.map((skill) => (matchesKeyword(skill, keyword) ? label : rewrite(skill))),
        experiences: result.experiences.map((job) => ({ ...job, bullets: job.bullets.map(rewrite) })),
        certifications: result.certifications.map((cert) =>
          matchesKeyword(cert.name, keyword) ? { ...cert, name: target } : cert,
        ),
      };
    }

    const covered = keyword.status === "exact" || keyword.status === "renamed";
    const listable = keyword.kind === "skill" || keyword.kind === "tool";
    if (covered && listable && result.skills.length < MAX_SKILLS) {
      const label = skillLabel(keyword);
      if (!result.skills.some((skill) => skill === label || matchesKeyword(skill, keyword))) {
        result = { ...result, skills: [...result.skills, label] };
      }
    }
  }

  return { ...result, skills: dedupe(result.skills) };
}

/** A whole list item (skill, certification) that names the keyword, with or without "(ACRONYM)". */
function matchesKeyword(value: string, keyword: StoredKeyword): boolean {
  const names = [value, value.replace(/\s*\([^)]*\)\s*$/, "")];
  return names.some(
    (name) =>
      sameConcept(name, keyword.term) || (keyword.profileTerm !== null && sameConcept(name, keyword.profileTerm)),
  );
}
