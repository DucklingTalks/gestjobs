import { describe, expect, it } from "vitest";

import {
  buildFollowUpMessage,
  daysSince,
  detectLanguage,
  followUpGmailUrl,
  followUpMailto,
  followUpStage,
  formatFollowUpDate,
  isFollowUpDue,
  pickRecipient,
  type FollowUpRecipient,
} from "@/lib/reminders/follow-up";

const now = new Date("2026-11-20T12:00:00Z");

const contact = (name: string, role: string, email: string | null = null): FollowUpRecipient => ({
  name,
  role,
  email,
  linkedinUrl: null,
});

const input = {
  company: "Acme",
  position: "Frontend Engineer",
  appliedOn: "2026-11-03",
  senderName: "Ana Pérez",
};

describe("isFollowUpDue", () => {
  it("follows the dashboard rule: the reminder date has passed", () => {
    expect(isFollowUpDue("2026-11-18T03:00:00Z", now)).toBe(true);
    expect(isFollowUpDue("2026-11-20T12:00:00Z", now)).toBe(true);
    expect(isFollowUpDue("2026-11-21T00:00:00Z", now)).toBe(false);
    expect(isFollowUpDue(null, now)).toBe(false);
  });
});

describe("daysSince", () => {
  it("counts whole days from a date or a timestamp", () => {
    expect(daysSince("2026-11-03", now)).toBe(17);
    expect(daysSince("2026-11-20T11:00:00Z", now)).toBe(0);
    expect(daysSince("2026-12-01", now)).toBe(0);
  });
});

describe("pickRecipient", () => {
  it("prefers a recruiter or HR contact", () => {
    const picked = pickRecipient([
      contact("Bob Lee", "Hiring manager", "bob@acme.com"),
      contact("María Gómez", "Reclutadora"),
    ]);
    expect(picked?.name).toBe("Bob Lee");
    expect(pickRecipient([contact("Eve", "Engineer", "e@acme.com"), contact("Sam", "RRHH")])?.name).toBe("Sam");
  });

  it("falls back to anyone with an email, then anyone", () => {
    expect(pickRecipient([contact("Eve", "Engineer"), contact("Tom", "CTO", "t@acme.com")])?.name).toBe("Tom");
    expect(pickRecipient([contact("Eve", "Engineer")])?.name).toBe("Eve");
    expect(pickRecipient([])).toBeNull();
  });
});

describe("followUpStage", () => {
  it("is 'applied' while waiting for a first answer", () => {
    expect(followUpStage("Applied", 3)).toBe("applied");
    expect(followUpStage("Postulado", 2)).toBe("applied");
    expect(followUpStage("Custom", 1)).toBe("applied");
  });

  it("is 'in-process' once the application moved on", () => {
    expect(followUpStage("Interview", 3)).toBe("in-process");
    expect(followUpStage("Screening", 2)).toBe("in-process");
  });
});

describe("detectLanguage", () => {
  it("guesses Spanish or English from the job description", () => {
    expect(detectLanguage("Buscamos un desarrollador con experiencia en React para la empresa.")).toBe("es");
    expect(detectLanguage("We are looking for an engineer with experience in React.")).toBe("en");
    expect(detectLanguage(null)).toBe("en");
  });
});

describe("formatFollowUpDate", () => {
  it("writes the day and month in the message's language", () => {
    expect(formatFollowUpDate("2026-11-03", "es")).toBe("3 de noviembre");
    expect(formatFollowUpDate("2026-11-03", "en")).toBe("November 3");
  });
});

describe("buildFollowUpMessage", () => {
  it("writes a formal Spanish follow-up addressed to the recruiter's first name", () => {
    const message = buildFollowUpMessage({ ...input, language: "es", stage: "applied", recipientName: "María Gómez" });
    expect(message.subject).toBe("Seguimiento de mi postulación: Frontend Engineer");
    expect(message.body).toBe(
      [
        "Hola María:",
        "Espero que se encuentre muy bien. Le escribo para hacer seguimiento de mi postulación al puesto de Frontend Engineer en Acme, que envié el 3 de noviembre.",
        "Mantengo un gran interés en la posición y en la posibilidad de aportar al equipo. Quedo a disposición por si necesitan información adicional o desean coordinar una conversación.",
        "Muchas gracias por su tiempo y consideración.",
        "Saludos cordiales,\nAna Pérez",
      ].join("\n\n"),
    );
  });

  it("addresses the team when there is no contact", () => {
    const es = buildFollowUpMessage({ ...input, language: "es", stage: "applied", recipientName: null });
    const en = buildFollowUpMessage({ ...input, language: "en", stage: "applied", recipientName: null });
    expect(es.body.startsWith("Estimado equipo de Acme:")).toBe(true);
    expect(en.body.startsWith("Dear Acme Hiring Team,")).toBe(true);
  });

  it("asks about next steps once the process started", () => {
    const message = buildFollowUpMessage({ ...input, language: "en", stage: "in-process", recipientName: "Bob Lee" });
    expect(message.subject).toBe("Next steps: Frontend Engineer");
    expect(message.body).toContain("Dear Bob,");
    expect(message.body).toContain("any updates on the next steps");
    expect(message.body).not.toContain("submitted on");
    expect(message.body.endsWith("Kind regards,\nAna Pérez")).toBe(true);
  });

  it("ends cleanly without a sender name", () => {
    const message = buildFollowUpMessage({ ...input, senderName: "", language: "en", stage: "applied", recipientName: null });
    expect(message.body.endsWith("Kind regards,")).toBe(true);
  });
});

describe("followUpMailto", () => {
  it("encodes subject and body, or returns null without an email", () => {
    const message = { subject: "Seguimiento: QA & Dev", body: "Hola,\n\nGracias." };
    expect(followUpMailto("rec@acme.com", message)).toBe(
      "mailto:rec@acme.com?subject=Seguimiento%3A%20QA%20%26%20Dev&body=Hola%2C%0A%0AGracias.",
    );
    expect(followUpMailto(null, message)).toBeNull();
  });

  it("keeps normal addresses and rejects malformed ones", () => {
    const message = { subject: "Hi", body: "Thanks" };
    expect(followUpMailto(" sofia.s@sales.co ", message)).toBe("mailto:sofia.s@sales.co?subject=Hi&body=Thanks");
    expect(followUpMailto("a b@acme.com", message)).toBeNull();
    expect(followUpMailto("x@acme.com?cc=evil@x.com", message)).toBeNull();
  });
});

describe("followUpGmailUrl", () => {
  const message = { subject: "Seguimiento: QA & Dev", body: "Hola,\n\nGracias." };

  it("opens Gmail compose with recipient, subject and body", () => {
    const url = new URL(followUpGmailUrl("rec@acme.com", message));
    expect(url.origin + url.pathname).toBe("https://mail.google.com/mail/");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe("rec@acme.com");
    expect(url.searchParams.get("su")).toBe("Seguimiento: QA & Dev");
    expect(url.searchParams.get("body")).toBe("Hola,\n\nGracias.");
  });

  it("leaves the recipient empty without a valid address", () => {
    expect(new URL(followUpGmailUrl(null, message)).searchParams.has("to")).toBe(false);
    expect(new URL(followUpGmailUrl("x@acme.com?cc=evil@x.com", message)).searchParams.has("to")).toBe(false);
  });
});
