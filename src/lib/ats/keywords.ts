/**
 * ATS keyword matching: decides, for each keyword copied from a job posting,
 * whether the candidate's profile supports it under the same name, under
 * another name for the same thing, under something related, or not at all.
 *
 * Pairs the user confirmed (personal aliases) decide first, then the shared
 * alias dictionary. The AI's opinion (one per keyword, returned by the
 * existing fit call) is used only for terms the dictionary does not know,
 * and never against FALSE_FRIENDS. Pure code: no I/O, no AI calls.
 */
import type { Profile } from "@/lib/validation/profile";

import { ALIASES, FALSE_FRIENDS } from "./aliases";

export type KeywordKind = "skill" | "tool" | "certification" | "language" | "other";
export type AiRelation = "same" | "related" | "none";
export type MatchStatus = "exact" | "renamed" | "related" | "missing";

/** A keyword as the AI extracted it from the posting. */
export type PostingKeyword = {
  /** Verbatim wording from the posting. */
  term: string;
  kind: KeywordKind;
  required: boolean;
  /** The profile entry the AI thinks it corresponds to, if any. */
  profileTerm: string | null;
  relation: AiRelation;
};

/** What the profile offers as evidence. */
export type ProfileEvidence = {
  /** Discrete names: skills, certification names, language names. */
  terms: string[];
  /** Free text: bio, experience titles and bullets, education fields. */
  text: string;
};

export type KeywordMatch = {
  term: string;
  kind: KeywordKind;
  required: boolean;
  status: MatchStatus;
  /** The profile wording that supports it, as written in the profile. */
  profileTerm: string | null;
};

/** Collect the profile's evidence: discrete names and free text. */
export function profileEvidence(profile: Profile): ProfileEvidence {
  return {
    terms: [
      ...profile.skills,
      ...profile.certifications.map((cert) => cert.name),
      ...profile.languages.map((language) => language.language),
    ].filter(Boolean),
    text: [
      profile.headline,
      profile.bio,
      ...profile.experiences.flatMap((job) => [job.title, job.description]),
      ...profile.education.flatMap((item) => [item.degree, item.field, item.description]),
      ...profile.certifications.map((cert) => cert.issuer),
      ...profile.strengths.flatMap((strength) => [strength.name, strength.evidence]),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// --- Normalization ---------------------------------------------------------

/** Lowercase, no accents, no spaces/dots/dashes/underscores/slashes. Keeps + and #. */
export function compact(term: string): string {
  return term
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s.\-_/–—]+/g, "");
}

const VERSION_SUFFIX = /\s+v?\d+(?:\.\d+)*(?:\.x)?\+?$/i;

const INDEX: Map<string, number> = (() => {
  const index = new Map<string, number>();
  ALIASES.forEach((names, id) => {
    for (const name of names) {
      const key = compact(name);
      const existing = index.get(key);
      if (existing !== undefined && existing !== id) {
        throw new Error(`ATS alias "${name}" is listed under two entries.`);
      }
      index.set(key, id);
    }
  });
  return index;
})();

/** Dictionary entry for a term, or null when the dictionary does not know it. */
export function entryOf(term: string): number | null {
  const tries = [term.trim()];
  const unversioned = term.trim().replace(VERSION_SUFFIX, "");
  if (unversioned && unversioned !== tries[0]) tries.push(unversioned);

  for (const candidate of tries) {
    const key = compact(candidate);
    if (!key) continue;
    const forms = [key];
    if (key.length > 4 && key.endsWith("js")) forms.push(key.slice(0, -2));
    else forms.push(`${key}js`);
    for (const form of forms) {
      const id = INDEX.get(form);
      if (id !== undefined) return id;
    }
  }
  return null;
}

/** Canonical name from the dictionary, or null. */
export function canonicalName(term: string): string | null {
  const id = entryOf(term);
  return id === null ? null : ALIASES[id][0];
}

/** Comparable key: the dictionary entry, or the compact form without a trailing "js". */
function keyOf(term: string): string {
  const id = entryOf(term);
  if (id !== null) return `#${id}`;
  const key = compact(term);
  return key.length > 4 && key.endsWith("js") ? key.slice(0, -2) : key;
}

const FALSE_FRIEND_KEYS = new Set(
  FALSE_FRIENDS.flatMap(([a, b]) => [`${keyOf(a)}|${keyOf(b)}`, `${keyOf(b)}|${keyOf(a)}`]),
);

export function areFalseFriends(a: string, b: string): boolean {
  return FALSE_FRIEND_KEYS.has(`${keyOf(a)}|${keyOf(b)}`);
}

/** Same concept under any spelling, according to the dictionary and normalization alone. */
export function sameConcept(a: string, b: string): boolean {
  if (areFalseFriends(a, b)) return false;
  return keyOf(a) === keyOf(b);
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// --- Free-text search ------------------------------------------------------

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Regex for any of `names` as whole words. A preceding dot also counts as part
 * of the word, so "JS" is not found inside "Next.js". Longer names are tried
 * first.
 */
export function wordPattern(names: string[], flags: string): RegExp {
  const alternatives = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  return new RegExp(`(?<![\\p{L}\\p{N}.])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}+#])`, flags);
}

/**
 * Whether `found` in free text really is `spelling`, given that many tech
 * names are also ordinary words:
 * - 1-2 letter terms (Go, R, C, AI) need the same casing.
 * - Capitalized plain words (Next, Express, Spring, Swift) do not count
 *   written all in lowercase ("next quarter", "express interest").
 * - Distinctive spellings (PostgreSQL, NextJS, K8s, pandas) match in any case.
 */
export function acceptsMatch(spelling: string, found: string): boolean {
  const name = spelling.trim();
  if (compact(name).length <= 2) return found === name;
  if (/^\p{Lu}\p{Ll}+$/u.test(name) && found === found.toLowerCase()) return false;
  return true;
}

/** Find `term` as a whole word in `text` and return it as written there. */
export function findTerm(text: string, term: string): string | null {
  if (!term.trim()) return null;
  for (const match of text.matchAll(wordPattern([term], "giu"))) {
    if (acceptsMatch(term, match[0])) return match[0];
  }
  return null;
}

/**
 * Spellings of the term's false friends that contain the term ("React Native"
 * for "React", "Spring Boot" for "Spring"). Matching and renaming must skip
 * them. Other longer names stay: "AWS Lambda" is still evidence of AWS.
 */
export function falseFriendSpellings(term: string): string[] {
  const names: string[] = [];
  for (const [a, b] of FALSE_FRIENDS) {
    const other = sameConcept(a, term) ? b : sameConcept(b, term) ? a : null;
    if (!other) continue;
    names.push(...spellingsOf(other).filter((name) => findTerm(name, term)));
  }
  return names;
}

/**
 * Names of other dictionary entries that contain one of the term's spellings
 * ("AWS Lambda" for AWS, "React Native" for React). Renaming must leave them
 * as they are.
 */
export function containingNames(term: string): string[] {
  const own = keyOf(term);
  const spellings = spellingsOf(term);
  return ALIASES.flat().filter(
    (name) => keyOf(name) !== own && spellings.some((spelling) => !sameText(spelling, name) && findTerm(name, spelling)),
  );
}

function withoutFalseFriends(text: string, term: string): string {
  const names = falseFriendSpellings(term);
  return names.length ? text.replace(wordPattern(names, "giu"), " ") : text;
}

/** Every spelling the dictionary knows for a term, the term itself first. */
export function spellingsOf(term: string): string[] {
  const id = entryOf(term);
  const names = id === null ? [] : ALIASES[id];
  return [term.trim(), ...names.filter((name) => !sameText(name, term))];
}

// --- Matching --------------------------------------------------------------

/**
 * The profile's own wording for `term`: a profile name with the same text,
 * or the term found as a whole word in the free text. Null when the profile
 * does not mention it.
 */
export function findEvidence(profile: ProfileEvidence, term: string): string | null {
  const name = term.trim();
  if (!name) return null;
  return (
    profile.terms.find((candidate) => sameText(candidate, name)) ??
    findTerm(withoutFalseFriends(profile.text, name), name)
  );
}

function matchOne(
  keyword: PostingKeyword,
  profile: ProfileEvidence,
  personal: PersonalAlias[],
): Omit<KeywordMatch, "term" | "kind" | "required"> {
  const { term } = keyword;
  const text = withoutFalseFriends(profile.text, term);

  // 1. Same wording (ignoring case) in a profile name or in the free text.
  const exactTerm = profile.terms.find((candidate) => sameText(candidate, term));
  if (exactTerm) return { status: "exact", profileTerm: exactTerm };
  if (findTerm(text, term)) return { status: "exact", profileTerm: term.trim() };

  // 2. A pair the user confirmed. It wins over the dictionary and the AI,
  //    but still needs the profile to mention it.
  for (const alias of personal) {
    if (!sameConcept(alias.postingTerm, term)) continue;
    const evidence = findEvidence(profile, alias.profileTerm);
    if (evidence) return { status: "renamed", profileTerm: evidence };
  }

  // 3. Same concept under another spelling.
  const renamedTerm = profile.terms.find((candidate) => sameConcept(candidate, term));
  if (renamedTerm) return { status: "renamed", profileTerm: renamedTerm };
  for (const spelling of spellingsOf(term).slice(1)) {
    const found = findTerm(text, spelling);
    if (found && !areFalseFriends(found, term)) return { status: "renamed", profileTerm: found };
  }

  // 4. The AI's opinion, only if what it points at really is in the profile.
  const pointed = keyword.profileTerm?.trim();
  if (!pointed || keyword.relation === "none" || areFalseFriends(pointed, term)) {
    return { status: "missing", profileTerm: null };
  }
  const evidence =
    profile.terms.find((candidate) => sameText(candidate, pointed)) ?? findTerm(text, pointed);
  if (!evidence) return { status: "missing", profileTerm: null };

  // The dictionary knows at least one side and did not call them the same:
  // trust it over the AI and only suggest.
  const dictionaryKnows = entryOf(term) !== null || entryOf(pointed) !== null;
  if (keyword.relation === "same" && !dictionaryKnows) {
    return { status: "renamed", profileTerm: evidence };
  }
  return { status: "related", profileTerm: evidence };
}

/** True when the term really appears in the posting (guards against AI paraphrases). */
export function appearsIn(postingText: string, term: string): boolean {
  if (findTerm(postingText, term)) return true;
  const key = compact(term);
  return key.length >= 4 && compact(postingText).includes(key);
}

/**
 * Match posting keywords against the profile. It drops keywords that do not
 * appear in the posting and merges duplicates (same concept). A merged
 * keyword is required if any of its copies is.
 */
/** A pair the user confirmed: the posting's name and their own. */
export type PersonalAlias = { postingTerm: string; profileTerm: string };

export function matchKeywords(
  keywords: PostingKeyword[],
  profile: ProfileEvidence,
  postingText: string,
  personal: PersonalAlias[] = [],
): KeywordMatch[] {
  const unique: PostingKeyword[] = [];
  for (const keyword of keywords) {
    const term = keyword.term.trim();
    if (!term || !appearsIn(postingText, term)) continue;
    const duplicate = unique.find((seen) => sameConcept(seen.term, term));
    if (duplicate) {
      duplicate.required ||= keyword.required;
      continue;
    }
    unique.push({ ...keyword, term });
  }

  return unique.map((keyword) => ({
    term: keyword.term,
    kind: keyword.kind,
    required: keyword.required,
    ...matchOne(keyword, profile, personal),
  }));
}

export type Coverage = {
  covered: number;
  total: number;
  requiredCovered: number;
  requiredTotal: number;
};

/** Covered means exact or renamed. Related keywords are suggestions, not coverage. */
export function coverage(matches: KeywordMatch[]): Coverage {
  const isCovered = (match: KeywordMatch) => match.status === "exact" || match.status === "renamed";
  const required = matches.filter((match) => match.required);
  return {
    covered: matches.filter(isCovered).length,
    total: matches.length,
    requiredCovered: required.filter(isCovered).length,
    requiredTotal: required.length,
  };
}
