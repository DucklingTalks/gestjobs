import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", () => ({ generateJson: vi.fn() }));

import { generateJson } from "@/lib/ai/client";
import {
  analyzeFit,
  DOCUMENTS_MIN_SCORE,
  finalizeCoverLetter,
  fitResultSchema,
  writeFitDocuments,
  writesDocumentsFor,
} from "@/lib/ai/fit";
import { profileSchema } from "@/lib/validation/profile";

const mocked = vi.mocked(generateJson);
const profile = profileSchema.parse({ skills: ["React"] });
const base = { language: "en", summary: "Verdict.", strengths: [], gaps: [] };

beforeEach(() => mocked.mockReset());

describe("documents threshold", () => {
  it("writes documents automatically from a fit of 5", () => {
    expect(DOCUMENTS_MIN_SCORE).toBe(5);
    expect(writesDocumentsFor(4)).toBe(false);
    expect(writesDocumentsFor(5)).toBe(true);
  });
});

describe("fitResultSchema", () => {
  it("accepts a low fit without cover letter or CV", () => {
    const parsed = fitResultSchema.parse({ ...base, score: 3 });
    expect(parsed.coverLetter).toBe("");
    expect(parsed.cv.experiences).toEqual([]);
  });

  it("still requires the cover letter for a good fit", () => {
    expect(fitResultSchema.safeParse({ ...base, score: 6, cv: {} }).success).toBe(false);
    expect(fitResultSchema.safeParse({ ...base, score: 6, coverLetter: "Hi,", cv: {} }).success).toBe(true);
  });
});

const ai = { provider: "anthropic" as const, apiKey: "test", baseURL: "https://api.anthropic.com", model: "claude-haiku-5-5" };

describe("analyzeFit", () => {
  it("drops documents the model wrote for a low fit anyway", async () => {
    mocked.mockResolvedValue({
      ok: true,
      data: fitResultSchema.parse({ ...base, score: 4, coverLetter: "Dear team,", cv: { summary: "Engineer." } }),
    });
    const result = await analyzeFit(ai, profile, "posting");
    expect(result.ok && result.data.coverLetter).toBe("");
    expect(result.ok && result.data.cv.summary).toBe("");
  });

  it("keeps the documents for a good fit", async () => {
    mocked.mockResolvedValue({
      ok: true,
      data: fitResultSchema.parse({ ...base, score: 7, coverLetter: "Dear team,", cv: { summary: "Engineer." } }),
    });
    const result = await analyzeFit(ai, profile, "posting");
    expect(result.ok && result.data.coverLetter).toBe("Dear team,");
  });

  it("asks the model to skip the documents below the threshold", async () => {
    mocked.mockResolvedValue({ ok: false, error: "x" });
    await analyzeFit(ai, profile, "posting");
    expect(mocked.mock.calls[0][0].system).toContain('If the score is 4 or lower, return "coverLetter": ""');
  });
});

describe("writeFitDocuments", () => {
  it("sends the assessment and the language to the model", async () => {
    mocked.mockResolvedValue({ ok: false, error: "x" });
    await writeFitDocuments(ai, profile, "The posting", {
      language: "es",
      score: 3,
      summary: "Poco encaje.",
      strengths: ["React"],
      gaps: ["Sin Go"],
    });
    const { prompt, system } = mocked.mock.calls[0][0];
    expect(prompt).toContain("The posting");
    expect(prompt).toContain('"gaps": [\n    "Sin Go"\n  ]');
    expect(prompt).toContain("<language>es</language>");
    expect(system).toContain("never claim or imply the gaps are covered");
  });
});

describe("finalizeCoverLetter", () => {
  it("leaves an empty letter empty instead of adding the name", () => {
    expect(finalizeCoverLetter("", "Ana Pérez")).toBe("");
    expect(finalizeCoverLetter("   ", "Ana Pérez")).toBe("");
  });
});
