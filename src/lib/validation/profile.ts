import { z } from "zod";

/**
 * Candidate profile shapes.
 *
 * The same schema validates the profile form, the AI resume import, and the
 * jsonb columns read back from `public.profiles`. Dates are free-form
 * "YYYY-MM" (or "YYYY") strings because CVs rarely carry exact days.
 */

const text = (max: number) => z.string().trim().max(max).default("");

export const yearMonthSchema = z
  .string()
  .trim()
  .max(7)
  .regex(/^(\d{4}(-(0[1-9]|1[0-2]))?)?$/, "Use YYYY or YYYY-MM.")
  .default("");

export const experienceSchema = z.object({
  company: text(120),
  title: text(120),
  location: text(120),
  startDate: yearMonthSchema,
  endDate: yearMonthSchema,
  current: z.boolean().default(false),
  description: text(4000),
});

export const educationSchema = z.object({
  institution: text(160),
  degree: text(160),
  field: text(160),
  startDate: yearMonthSchema,
  endDate: yearMonthSchema,
  description: text(2000),
});

export const linkSchema = z.object({
  label: text(60),
  url: text(300),
});

export const languageSchema = z.object({
  language: text(60),
  level: text(60),
});

export const certificationSchema = z.object({
  name: text(160),
  issuer: text(160),
  year: text(10),
});

export const STRENGTH_KINDS = ["technical", "soft"] as const;

/**
 * A quality the candidate confirmed, with the concrete example that shows it
 * (e.g. "Algorithmic thinking" + the story). `context` names the job or
 * project it comes from, so the CV can place it under that experience.
 */
export const strengthSchema = z.object({
  name: text(80),
  kind: z.enum(STRENGTH_KINDS).catch("technical").default("technical"),
  context: text(160),
  evidence: text(1000),
});

export type Strength = z.infer<typeof strengthSchema>;

export const MAX_STRENGTHS = 30;

export const profileSchema = z.object({
  fullName: text(120),
  headline: text(160),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.").max(200)]).default(""),
  phone: text(60),
  location: text(120),
  bio: text(3000),
  skills: z.array(z.string().trim().min(1).max(60)).max(80).default([]),
  links: z.array(linkSchema).max(10).default([]),
  languages: z.array(languageSchema).max(15).default([]),
  experiences: z.array(experienceSchema).max(30).default([]),
  education: z.array(educationSchema).max(15).default([]),
  certifications: z.array(certificationSchema).max(30).default([]),
  strengths: z.array(strengthSchema).max(MAX_STRENGTHS).default([]),
});

export type Profile = z.infer<typeof profileSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;

export const emptyProfile: Profile = profileSchema.parse({});

/** Drop list entries the user left completely blank. */
export function compactProfile(profile: Profile): Profile {
  const filled = (row: Record<string, unknown>) =>
    Object.entries(row).some(([key, value]) => key !== "current" && typeof value === "string" && value !== "");
  return {
    ...profile,
    skills: Array.from(new Set(profile.skills.filter(Boolean))),
    links: profile.links.filter(filled),
    languages: profile.languages.filter(filled),
    experiences: profile.experiences.filter(filled),
    education: profile.education.filter(filled),
    certifications: profile.certifications.filter(filled),
    strengths: profile.strengths.filter((strength) => strength.name !== ""),
  };
}

/** True when the profile has enough content to be worth analysing. */
export function isProfileUsable(profile: Profile): boolean {
  return Boolean(
    profile.experiences.length || profile.education.length || profile.skills.length || profile.bio,
  );
}

type ProfileRow = {
  full_name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  skills: string[];
  links: unknown;
  languages: unknown;
  experiences: unknown;
  education: unknown;
  certifications: unknown;
  strengths?: unknown;
};

/** Columns that `profileFromRow` reads. */
export const PROFILE_COLUMNS =
  "full_name, headline, email, phone, location, bio, skills, links, languages, experiences, education, certifications, strengths";

/** Map a `profiles` row to the app shape, tolerating malformed jsonb. */
export function profileFromRow(row: ProfileRow | null): Profile {
  if (!row) return emptyProfile;
  const parsed = profileSchema.safeParse({
    fullName: row.full_name,
    headline: row.headline,
    email: row.email,
    phone: row.phone,
    location: row.location,
    bio: row.bio,
    skills: row.skills ?? [],
    links: row.links ?? [],
    languages: row.languages ?? [],
    experiences: row.experiences ?? [],
    education: row.education ?? [],
    certifications: row.certifications ?? [],
    strengths: row.strengths ?? [],
  });
  return parsed.success ? parsed.data : emptyProfile;
}

export function profileToRow(profile: Profile) {
  return {
    full_name: profile.fullName,
    headline: profile.headline,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    bio: profile.bio,
    skills: profile.skills,
    links: profile.links,
    languages: profile.languages,
    experiences: profile.experiences,
    education: profile.education,
    certifications: profile.certifications,
    strengths: profile.strengths,
  };
}
