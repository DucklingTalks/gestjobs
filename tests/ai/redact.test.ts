import { describe, expect, it } from "vitest";

import { extractJson } from "@/lib/ai/client";
import { labelForUrl, normalizeUrl, redactContacts } from "@/lib/ai/redact";
import { compactProfile, profileSchema } from "@/lib/validation/profile";

describe("redactContacts", () => {
  const cv = [
    "Ana Pérez — ana.perez@example.com — +598 99 123 456",
    "linkedin.com/in/anaperez · https://github.com/anap",
    "Experience",
    "Acme Corp, 2019 - 2023",
    "Grew revenue 25% across 3 markets.",
  ].join("\n");

  it("removes emails, phones and links and returns them", () => {
    const { text, contacts } = redactContacts(cv);
    expect(text).not.toContain("ana.perez@example.com");
    expect(text).not.toContain("99 123 456");
    expect(text).not.toContain("github.com");
    expect(text).not.toContain("linkedin.com");
    expect(contacts.emails).toEqual(["ana.perez@example.com"]);
    expect(contacts.phones).toEqual(["+598 99 123 456"]);
    expect(contacts.urls).toEqual(["linkedin.com/in/anaperez", "https://github.com/anap"]);
  });

  it("keeps year ranges and short numbers", () => {
    const { text } = redactContacts(cv);
    expect(text).toContain("2019 - 2023");
    expect(text).toContain("25%");
  });

  it("labels and normalizes links", () => {
    expect(labelForUrl("linkedin.com/in/x")).toBe("LinkedIn");
    expect(labelForUrl("https://example.dev")).toBe("Website");
    expect(normalizeUrl("linkedin.com/in/x")).toBe("https://linkedin.com/in/x");
  });
});

describe("extractJson", () => {
  it("parses fenced and prose-wrapped JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":{"b":2}} thanks')).toEqual({ a: { b: 2 } });
  });

  it("throws when there is no object", () => {
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("profile schema", () => {
  it("fills defaults and drops blank rows", () => {
    const profile = compactProfile(
      profileSchema.parse({
        fullName: "Ana",
        skills: ["React", "React", "SQL"],
        experiences: [{ company: "Acme", startDate: "2020-01" }, { company: "" }],
      }),
    );
    expect(profile.skills).toEqual(["React", "SQL"]);
    expect(profile.experiences).toHaveLength(1);
    expect(profile.experiences[0].current).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(profileSchema.safeParse({ experiences: [{ startDate: "01/2020" }] }).success).toBe(false);
  });
});
