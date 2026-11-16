import { describe, expect, it } from "vitest";

import { ALIASES, FALSE_FRIENDS } from "@/lib/ats/aliases";
import {
  appearsIn,
  areFalseFriends,
  canonicalName,
  compact,
  coverage,
  findTerm,
  matchKeywords,
  sameConcept,
  type PostingKeyword,
  type ProfileEvidence,
} from "@/lib/ats/keywords";

const kw = (term: string, extra: Partial<PostingKeyword> = {}): PostingKeyword => ({
  term,
  kind: "skill",
  required: true,
  profileTerm: null,
  relation: "none",
  ...extra,
});

const profile = (terms: string[], text = ""): ProfileEvidence => ({ terms, text });

/** Match a single keyword against a profile; the posting is the term itself. */
const matchOne = (keyword: PostingKeyword, evidence: ProfileEvidence) =>
  matchKeywords([keyword], evidence, keyword.term)[0];

describe("alias dictionary", () => {
  it("loads without two entries sharing a spelling", () => {
    // The index is built on import and throws on a collision.
    expect(ALIASES.length).toBeGreaterThan(100);
  });

  it("lists every false friend as known, distinct entries", () => {
    for (const [a, b] of FALSE_FRIENDS) {
      expect(canonicalName(a), a).not.toBeNull();
      expect(canonicalName(b), b).not.toBeNull();
      expect(canonicalName(a)).not.toBe(canonicalName(b));
    }
  });
});

describe("normalization", () => {
  it("ignores case, accents, punctuation and spacing but keeps + and #", () => {
    expect(compact("Next.js")).toBe("nextjs");
    expect(compact("  Diseño UX ")).toBe("disenoux");
    expect(compact("C++")).toBe("c++");
    expect(compact("C#")).toBe("c#");
    expect(compact("CI/CD")).toBe("cicd");
  });

  it.each([
    ["Next", "Next.js"],
    ["NextJS", "Next.js"],
    ["next js", "Next.js"],
    ["Node", "Node.js"],
    ["Postgres", "PostgreSQL"],
    ["K8s", "Kubernetes"],
    ["JS", "JavaScript"],
    ["AWS", "Amazon Web Services"],
    ["Golang", "Go"],
    ["Angular 17", "Angular"],
    ["Python 3.11", "Python"],
    ["RESTful APIs", "REST"],
    ["CI CD", "Continuous Integration and Continuous Delivery"],
  ])("treats %s as %s", (a, b) => {
    expect(sameConcept(a, b)).toBe(true);
  });

  it.each([
    ["Java", "JavaScript"],
    ["Angular", "AngularJS"],
    ["Angular", "Angular.js"],
    ["React", "React Native"],
    [".NET Framework", ".NET Core"],
    ["C", "C++"],
    ["Git", "GitHub"],
  ])("keeps %s and %s apart", (a, b) => {
    expect(sameConcept(a, b)).toBe(false);
  });

  it("matches unknown terms by normalized spelling", () => {
    expect(canonicalName("Zustand")).toBeNull();
    expect(sameConcept("Zustand", "zustand")).toBe(true);
    expect(sameConcept("Three.js", "Three")).toBe(true);
  });

  it("knows the false friends in both directions", () => {
    expect(areFalseFriends("JavaScript", "Java")).toBe(true);
    expect(areFalseFriends("JS", "Java")).toBe(true);
    expect(areFalseFriends("React", "Vue")).toBe(false);
  });
});

describe("findTerm", () => {
  it("matches whole words only", () => {
    expect(findTerm("Built APIs in JavaScript", "Java")).toBeNull();
    expect(findTerm("Wrote C++ services", "C")).toBeNull();
    expect(findTerm("Migrated to Next.js.", "Next.js")).toBe("Next.js");
  });

  it("is case-insensitive except for very short terms", () => {
    expect(findTerm("used postgresql daily", "PostgreSQL")).toBe("postgresql");
    expect(findTerm("happy to go the extra mile", "Go")).toBeNull();
    expect(findTerm("Services written in Go", "Go")).toBe("Go");
  });
});

describe("matchKeywords", () => {
  it("reports exact wording, ignoring case", () => {
    expect(matchOne(kw("Next.js"), profile(["next.js"]))).toMatchObject({
      status: "exact",
      profileTerm: "next.js",
    });
  });

  it("finds exact evidence in free text", () => {
    expect(matchOne(kw("Docker"), profile([], "Containerized services with Docker."))).toMatchObject({
      status: "exact",
      profileTerm: "Docker",
    });
  });

  it("renames a different spelling of the same concept", () => {
    expect(matchOne(kw("Next.js"), profile(["NextJS"]))).toMatchObject({
      status: "renamed",
      profileTerm: "NextJS",
    });
    expect(matchOne(kw("PostgreSQL"), profile(["Postgres"]))).toMatchObject({
      status: "renamed",
      profileTerm: "Postgres",
    });
  });

  it("renames an alias found in free text, keeping how it was written", () => {
    expect(
      matchOne(kw("Amazon Web Services"), profile([], "Deployed on AWS with Terraform.")),
    ).toMatchObject({ status: "renamed", profileTerm: "AWS" });
  });

  it("does not count a false friend in free text", () => {
    expect(matchOne(kw("React"), profile([], "Shipped two React Native apps."))).toMatchObject({
      status: "missing",
    });
    expect(matchOne(kw("React"), profile([], "React Native and React for the web."))).toMatchObject({
      status: "exact",
    });
  });

  it("keeps longer names that are real evidence", () => {
    expect(matchOne(kw("AWS"), profile([], "Built AWS Lambda functions."))).toMatchObject({
      status: "exact",
    });
  });

  it("never renames false friends, even when the AI says they are the same", () => {
    expect(
      matchOne(kw("Java", { profileTerm: "JavaScript", relation: "same" }), profile(["JavaScript"])),
    ).toMatchObject({ status: "missing", profileTerm: null });
  });

  it("accepts the AI's 'same' only for terms the dictionary does not know", () => {
    expect(
      matchOne(
        kw("Hexagonal Architecture", { profileTerm: "Ports and Adapters", relation: "same" }),
        profile(["Ports and Adapters"]),
      ),
    ).toMatchObject({ status: "renamed", profileTerm: "Ports and Adapters" });
  });

  it("downgrades the AI's 'same' to related when the dictionary knows better", () => {
    expect(
      matchOne(kw("AWS Lambda", { profileTerm: "AWS", relation: "same" }), profile(["AWS"])),
    ).toMatchObject({ status: "related", profileTerm: "AWS" });
  });

  it("keeps the AI's 'related' as a suggestion", () => {
    expect(
      matchOne(kw("Kafka", { profileTerm: "RabbitMQ", relation: "related" }), profile(["RabbitMQ"])),
    ).toMatchObject({ status: "related", profileTerm: "RabbitMQ" });
  });

  it("ignores an AI pointer to something the profile does not have", () => {
    expect(
      matchOne(kw("Kafka", { profileTerm: "RabbitMQ", relation: "related" }), profile(["Redis"])),
    ).toMatchObject({ status: "missing", profileTerm: null });
  });

  it("reports missing keywords", () => {
    expect(matchOne(kw("GraphQL"), profile(["REST"], "Designed REST APIs."))).toMatchObject({
      status: "missing",
      profileTerm: null,
    });
  });

  it("drops keywords that are not in the posting and merges duplicates", () => {
    const posting = "We use Next.js and NextJS daily. Postgres is a plus.";
    const matches = matchKeywords(
      [
        kw("Next.js", { required: false }),
        kw("NextJS", { required: true }),
        kw("Kubernetes"),
        kw("Postgres", { required: false }),
      ],
      profile(["Next", "PostgreSQL"]),
      posting,
    );
    expect(matches.map((match) => [match.term, match.status, match.required])).toEqual([
      ["Next.js", "renamed", true],
      ["Postgres", "renamed", false],
    ]);
  });
});

describe("appearsIn", () => {
  it("accepts small formatting differences but not paraphrases", () => {
    expect(appearsIn("Experience with Node JS", "Node.js")).toBe(true);
    expect(appearsIn("Experience with NodeJS", "Node.js")).toBe(true);
    expect(appearsIn("Experience with Node.js", "Node.js")).toBe(true);
    expect(appearsIn("Experience with backend runtimes", "Node.js")).toBe(false);
  });
});

describe("coverage", () => {
  it("counts exact and renamed keywords, overall and for required ones", () => {
    const matches = matchKeywords(
      [kw("React"), kw("Next.js"), kw("GraphQL"), kw("Docker", { required: false })],
      profile(["React", "Next", "Docker"]),
      "React, Next.js, GraphQL, Docker",
    );
    expect(coverage(matches)).toEqual({ covered: 3, total: 4, requiredCovered: 2, requiredTotal: 3 });
  });
});
