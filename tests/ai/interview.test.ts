import { describe, expect, it } from "vitest";

import { interviewPrompt, mergeStrengths } from "@/lib/ai/interview";
import { profileForAi } from "@/lib/ai/fit";
import { candidateAnswers, MAX_CANDIDATE_ANSWERS, transcriptSchema, type InterviewMessage } from "@/lib/validation/interview";
import { compactProfile, profileFromRow, profileSchema, strengthSchema } from "@/lib/validation/profile";

const strength = (name: string, evidence = "", context = "") =>
  strengthSchema.parse({ name, evidence, context });

describe("strengths in the profile", () => {
  it("defaults kind to technical and tolerates an unknown kind", () => {
    expect(strengthSchema.parse({ name: "Mentoring" }).kind).toBe("technical");
    expect(strengthSchema.parse({ name: "Mentoring", kind: "people" }).kind).toBe("technical");
    expect(strengthSchema.parse({ name: "Mentoring", kind: "soft" }).kind).toBe("soft");
  });

  it("drops strengths without a name", () => {
    const profile = compactProfile(
      profileSchema.parse({ strengths: [{ name: "", evidence: "orphan" }, { name: "Debugging" }] }),
    );
    expect(profile.strengths.map((s) => s.name)).toEqual(["Debugging"]);
  });

  it("reads rows that predate the strengths column", () => {
    const profile = profileFromRow({
      full_name: "Ana",
      headline: "",
      email: "",
      phone: "",
      location: "",
      bio: "",
      skills: ["React"],
      links: [],
      languages: [],
      experiences: [],
      education: [],
      certifications: [],
    });
    expect(profile.fullName).toBe("Ana");
    expect(profile.strengths).toEqual([]);
  });

  it("are sent to the AI with the rest of the profile", () => {
    const profile = profileSchema.parse({ strengths: [{ name: "Algorithmic thinking", evidence: "O(n log n)" }] });
    expect(JSON.stringify(profileForAi(profile))).toContain("Algorithmic thinking");
  });
});

describe("transcriptSchema", () => {
  const turn = (role: InterviewMessage["role"], content = "x"): InterviewMessage => ({ role, content });

  it("counts candidate answers", () => {
    expect(candidateAnswers([turn("interviewer"), turn("candidate"), turn("interviewer"), turn("candidate")])).toBe(2);
  });

  it("rejects transcripts over the answer limit", () => {
    const atLimit = Array.from({ length: MAX_CANDIDATE_ANSWERS }, () => [turn("interviewer"), turn("candidate")]).flat();
    expect(transcriptSchema.safeParse(atLimit).success).toBe(true);
    expect(transcriptSchema.safeParse([...atLimit, turn("candidate")]).success).toBe(false);
  });

  it("rejects empty messages and unknown roles", () => {
    expect(transcriptSchema.safeParse([turn("candidate", "  ")]).success).toBe(false);
    expect(transcriptSchema.safeParse([{ role: "system", content: "hi" }]).success).toBe(false);
  });
});

describe("interviewPrompt", () => {
  it("redacts the candidate's contact details but keeps the interviewer's text", () => {
    const profile = profileSchema.parse({ email: "ana@example.com", skills: ["React"] });
    const prompt = interviewPrompt(profile, [
      { role: "interviewer", content: "Tell me about a hard bug." },
      { role: "candidate", content: "Write me at ana@example.com or see github.com/ana/tool, it was a race condition." },
    ]);
    expect(prompt).toContain("Interviewer: Tell me about a hard bug.");
    expect(prompt).toContain("it was a race condition");
    expect(prompt).not.toContain("ana@example.com");
    expect(prompt).not.toContain("github.com/ana");
    expect(prompt).toContain("[email]");
  });

  it("adds the job gaps only when the interview is about a job with gaps", () => {
    const profile = profileSchema.parse({});
    const focused = interviewPrompt(profile, [], { jobTitle: "Backend Engineer", company: "Acme", gaps: ["No Go experience"] });
    expect(focused).toContain("<job_gaps>");
    expect(focused).toContain("Backend Engineer at Acme");
    expect(focused).toContain("No Go experience");
    expect(interviewPrompt(profile, [], { jobTitle: "X", company: "", gaps: [] })).not.toContain("<job_gaps>");
    expect(interviewPrompt(profile, [])).not.toContain("<job_gaps>");
  });

  it("marks an interview that has not started", () => {
    expect(interviewPrompt(profileSchema.parse({}), [])).toContain("(The interview has not started.)");
  });
});

describe("mergeStrengths", () => {
  it("appends new strengths and merges same-name ones case-insensitively", () => {
    const merged = mergeStrengths(
      [strength("Mentoring", "Onboarded 3 juniors.")],
      [strength("mentoring", "Ran weekly code reviews.", "Acme"), strength("Debugging", "Fixed a race condition.")],
      30,
    );
    expect(merged).toEqual([
      { name: "Mentoring", kind: "technical", context: "Acme", evidence: "Onboarded 3 juniors. Ran weekly code reviews." },
      { name: "Debugging", kind: "technical", context: "", evidence: "Fixed a race condition." },
    ]);
  });

  it("does not repeat evidence that is already there", () => {
    const merged = mergeStrengths([strength("Mentoring", "Onboarded 3 juniors.")], [strength("Mentoring", "Onboarded 3 juniors.")], 30);
    expect(merged[0].evidence).toBe("Onboarded 3 juniors.");
  });

  it("never exceeds the maximum", () => {
    const merged = mergeStrengths([strength("A"), strength("B")], [strength("C"), strength("D")], 3);
    expect(merged.map((s) => s.name)).toEqual(["A", "B", "C"]);
  });
});
