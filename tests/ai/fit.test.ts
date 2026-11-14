import { describe, expect, it } from "vitest";

import { finalizeCoverLetter, fitResultSchema, profileForAi } from "@/lib/ai/fit";
import { formatCvDate, formatCvRange } from "@/lib/cv/format";
import { extractJobPosting, htmlToText } from "@/lib/jobs/fetch-posting";
import { profileSchema } from "@/lib/validation/profile";

describe("fitResultSchema", () => {
  const base = {
    language: "ES",
    score: "7",
    summary: "Buen encaje.",
    coverLetter: "Hola,\n\nSaludos,",
    cv: { experiences: [{ company: "Acme", startDate: "2020-01", bullets: ["Lideré X"] }] },
  };

  it("coerces score and normalizes language", () => {
    const parsed = fitResultSchema.parse(base);
    expect(parsed.score).toBe(7);
    expect(parsed.language).toBe("es");
    expect(parsed.cv.experiences[0].current).toBe(false);
  });

  it("rejects scores outside 1-10", () => {
    expect(fitResultSchema.safeParse({ ...base, score: 11 }).success).toBe(false);
    expect(fitResultSchema.safeParse({ ...base, score: 0 }).success).toBe(false);
  });
});

describe("profileForAi", () => {
  it("never includes contact details", () => {
    const profile = profileSchema.parse({
      fullName: "Ana Pérez",
      email: "ana@example.com",
      phone: "+598 99 123 456",
      links: [{ label: "LinkedIn", url: "https://linkedin.com/in/ana" }],
      skills: ["React"],
    });
    const serialized = JSON.stringify(profileForAi(profile));
    expect(serialized).not.toContain("ana@example.com");
    expect(serialized).not.toContain("99 123 456");
    expect(serialized).not.toContain("linkedin.com");
    expect(serialized).not.toContain("Ana Pérez");
    expect(serialized).toContain("React");
  });
});

describe("finalizeCoverLetter", () => {
  it("appends the name once", () => {
    expect(finalizeCoverLetter("Hi\n\nBest regards,", "Ana")).toBe("Hi\n\nBest regards,\nAna");
    expect(finalizeCoverLetter("Hi\n\nBest regards,\nAna", "Ana")).toBe("Hi\n\nBest regards,\nAna");
  });
});

describe("job posting parsing", () => {
  it("reads schema.org JobPosting JSON-LD", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Frontend Engineer",
      hiringOrganization: { "@type": "Organization", name: "Acme" },
      description:
        "<p>We are looking for a <b>Frontend Engineer</b> with React &amp; TypeScript experience.</p><ul><li>5+ years</li><li>Remote</li></ul>",
    })}</script></head><body>ignored</body></html>`;
    const posting = extractJobPosting(html);
    expect(posting?.title).toBe("Frontend Engineer");
    expect(posting?.company).toBe("Acme");
    expect(posting?.text).toContain("React & TypeScript");
    expect(posting?.text).toContain("- 5+ years");
  });

  it("strips scripts and tags from HTML", () => {
    const text = htmlToText("<script>alert(1)</script><h1>Title</h1><p>Body&nbsp;text</p>");
    expect(text).toBe("Title\nBody text");
  });
});

describe("cv date formatting", () => {
  it("formats by language", () => {
    expect(formatCvDate("2021-03", "en")).toBe("Mar 2021");
    expect(formatCvDate("2021-03", "es")).toBe("Mar 2021");
    expect(formatCvDate("2021", "en")).toBe("2021");
    expect(formatCvRange("2020-01", "", true, "es")).toBe("Ene 2020 – Actualidad");
    expect(formatCvRange("2020-01", "2022-06", false, "en")).toBe("Jan 2020 – Jun 2022");
  });
});
