import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { fitResultSchema, tailoredCvSchema, type TailoredCv } from "@/lib/ai/fit";
import { applyKeywords, parseStoredKeywords, rewriteText, type StoredKeyword } from "@/lib/ats/cv";
import { findTerm, profileEvidence } from "@/lib/ats/keywords";
import { profileSchema } from "@/lib/validation/profile";

const keyword = (term: string, profileTerm: string | null, extra: Partial<StoredKeyword> = {}): StoredKeyword => ({
  term,
  kind: "skill",
  required: true,
  status: "renamed",
  profileTerm,
  applied: true,
  ...extra,
});

const cvWith = (overrides: z.input<typeof tailoredCvSchema>): TailoredCv => tailoredCvSchema.parse(overrides);

describe("rewriteText", () => {
  it("replaces every spelling with the posting's wording", () => {
    const k = keyword("Next.js", "NextJS");
    expect(rewriteText("Built apps with NextJS and next.", k, "Next.js")).toBe("Built apps with Next.js and next.");
    expect(rewriteText("Moved from Next to Next.js.", k, "Next.js")).toBe("Moved from Next.js to Next.js.");
  });

  it("does not touch other products that contain the term", () => {
    const aws = keyword("Amazon Web Services", "AWS");
    expect(rewriteText("Deployed on AWS using AWS Lambda.", aws, "Amazon Web Services")).toBe(
      "Deployed on Amazon Web Services using AWS Lambda.",
    );
    const react = keyword("React.js", "React");
    expect(rewriteText("React and React Native apps.", react, "React.js")).toBe("React.js and React Native apps.");
  });

  it("does not rename inside another term after a dot", () => {
    const js = keyword("JavaScript", "JS");
    expect(rewriteText("JS and Next.js", js, "JavaScript")).toBe("JavaScript and Next.js");
  });

  it("keeps short spellings case-sensitive", () => {
    const go = keyword("Golang", "Go");
    expect(rewriteText("Wrote Go services; happy to go further.", go, "Golang")).toBe(
      "Wrote Golang services; happy to go further.",
    );
  });
});

describe("applyKeywords", () => {
  const cv = cvWith({
    summary: "Frontend engineer focused on NextJS and Postgres.",
    skills: ["NextJS", "Postgres", "Docker"],
    experiences: [
      { company: "Acme", title: "NextJS Developer", startDate: "2021-01", bullets: ["Migrated the site to NextJS."] },
    ],
  });

  it("uses the posting's wording everywhere except titles", () => {
    const result = applyKeywords(cv, [keyword("Next.js", "NextJS"), keyword("PostgreSQL", "Postgres")]);
    expect(result.summary).toBe("Frontend engineer focused on Next.js and PostgreSQL.");
    expect(result.skills).toEqual(["Next.js", "PostgreSQL", "Docker"]);
    expect(result.experiences[0].bullets).toEqual(["Migrated the site to Next.js."]);
    // Job titles are facts from the profile; they stay as written.
    expect(result.experiences[0].title).toBe("NextJS Developer");
  });

  it("puts back the profile's wording when a rename is turned off", () => {
    const aiAlreadyRenamed = cvWith({ summary: "Next.js expert.", skills: ["Next.js"] });
    const result = applyKeywords(aiAlreadyRenamed, [keyword("Next.js", "NextJS", { applied: false })]);
    expect(result.summary).toBe("NextJS expert.");
    expect(result.skills).toEqual(["NextJS"]);
  });

  it("writes acronym and long form together in the skills list", () => {
    const result = applyKeywords(cvWith({ skills: ["AWS"] }), [keyword("Amazon Web Services", "AWS")]);
    expect(result.skills).toEqual(["Amazon Web Services (AWS)"]);
    const again = applyKeywords(cvWith({ skills: ["Amazon Web Services (AWS)"] }), [
      keyword("Amazon Web Services", "AWS"),
    ]);
    expect(again.skills).toEqual(["Amazon Web Services (AWS)"]);
  });

  it("adds covered skills the CV left out, but never missing or related ones", () => {
    const result = applyKeywords(cvWith({ skills: ["React"] }), [
      keyword("Docker", "Docker", { status: "exact" }),
      keyword("Kubernetes", "K8s"),
      keyword("GraphQL", null, { status: "missing" }),
      keyword("AWS Lambda", "AWS", { status: "related" }),
      keyword("Scrum", "Scrum", { status: "exact", kind: "other" }),
    ]);
    expect(result.skills).toEqual(["React", "Docker", "Kubernetes"]);
  });

  it("renames certifications that name the keyword", () => {
    const result = applyKeywords(cvWith({ certifications: [{ name: "AWS SAA" }] }), [
      keyword("AWS Certified Solutions Architect – Associate", "AWS SAA", { kind: "certification" }),
    ]);
    expect(result.certifications[0].name).toBe("AWS Certified Solutions Architect – Associate");
  });

  it("does not change the stored CV", () => {
    applyKeywords(cv, [keyword("Next.js", "NextJS")]);
    expect(cv.skills).toEqual(["NextJS", "Postgres", "Docker"]);
  });
});

describe("parseStoredKeywords", () => {
  it("reads stored rows leniently and drops broken ones", () => {
    expect(
      parseStoredKeywords([
        { term: "Next.js", status: "renamed", profileTerm: "NextJS", kind: "weird" },
        { term: "", status: "exact" },
        { status: "missing" },
      ]),
    ).toEqual([
      { term: "Next.js", kind: "other", required: false, status: "renamed", profileTerm: "NextJS", applied: true },
    ]);
    expect(parseStoredKeywords(null)).toEqual([]);
  });
});

describe("profileEvidence", () => {
  it("collects names and free text from the profile", () => {
    const evidence = profileEvidence(
      profileSchema.parse({
        skills: ["React"],
        certifications: [{ name: "CKA", issuer: "CNCF" }],
        languages: [{ language: "English" }],
        experiences: [{ title: "Engineer", description: "Built Go services." }],
      }),
    );
    expect(evidence.terms).toEqual(["React", "CKA", "English"]);
    expect(findTerm(evidence.text, "Go")).toBe("Go");
  });
});

describe("fitResultSchema keywords", () => {
  const base = { language: "en", score: 7, summary: "Good.", coverLetter: "Hi,", cv: {} };

  it("defaults to an empty list for older responses", () => {
    expect(fitResultSchema.parse(base).keywords).toEqual([]);
  });

  it("keeps valid items, fixes bad enums and drops broken items", () => {
    const parsed = fitResultSchema.parse({
      ...base,
      keywords: [
        { term: " Next.js ", kind: "framework", required: true, profileTerm: "", relation: "same" },
        { term: "", kind: "skill" },
        "Docker",
      ],
    });
    expect(parsed.keywords).toEqual([
      { term: "Next.js", kind: "other", required: true, profileTerm: null, relation: "same" },
    ]);
  });

  it("does not fail the analysis when keywords are malformed", () => {
    expect(fitResultSchema.parse({ ...base, keywords: "oops" }).keywords).toEqual([]);
  });
});
