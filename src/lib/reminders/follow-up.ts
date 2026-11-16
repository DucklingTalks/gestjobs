/**
 * Follow-up message for an application that is due for a reminder (the same
 * rule as the dashboard: `next_reminder_at` has passed). Template-based, so
 * it is instant and free. The tone is warm but formal.
 *
 * Pure: no I/O and no Date.now(). `now` is always passed in.
 */

export type FollowUpLanguage = "es" | "en";

/** "applied": no answer yet. "in-process": screening, interview or later. */
export type FollowUpStage = "applied" | "in-process";

export type FollowUpRecipient = {
  name: string;
  role: string;
  email: string | null;
  linkedinUrl: string | null;
};

export type FollowUpMessage = { subject: string; body: string };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Due when the scheduled reminder has passed (terminal statuses have none). */
export function isFollowUpDue(nextReminderAt: string | null, now: Date): boolean {
  return nextReminderAt !== null && new Date(nextReminderAt).getTime() <= now.getTime();
}

/** Whole days since `since` (a date or timestamp string). */
export function daysSince(since: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / MS_PER_DAY));
}

const RECRUITER_ROLE = /recruit|reclut|talent|hr\b|rrhh|recursos humanos|people|hiring|selec/i;

/** Prefer a recruiter or HR contact, then anyone with an email, then anyone. */
export function pickRecipient(contacts: FollowUpRecipient[]): FollowUpRecipient | null {
  return (
    contacts.find((contact) => RECRUITER_ROLE.test(contact.role)) ??
    contacts.find((contact) => contact.email) ??
    contacts[0] ??
    null
  );
}

const APPLIED_STATUS = /^(applied|postulad[oa]|aplicad[oa]|enviad[oa]|sent)$/i;

/**
 * The application is still waiting for a first answer when its status looks
 * like "Applied", or it has never moved past the initial status.
 */
export function followUpStage(statusName: string | null | undefined, historyCount: number): FollowUpStage {
  if (statusName && APPLIED_STATUS.test(statusName.trim())) return "applied";
  return historyCount <= 1 ? "applied" : "in-process";
}

const SPANISH_HINTS = /\b(el|la|los|las|de|del|para|con|una|experiencia|requisitos|empresa|buscamos|trabajo|años)\b/gi;
const ENGLISH_HINTS = /\b(the|and|for|with|you|our|experience|requirements|company|we|work|years)\b/gi;

/** Rough language guess from the job description; English when unsure. */
export function detectLanguage(text: string | null | undefined): FollowUpLanguage {
  if (!text) return "en";
  const spanish = text.match(SPANISH_HINTS)?.length ?? 0;
  const english = text.match(ENGLISH_HINTS)?.length ?? 0;
  return spanish > english ? "es" : "en";
}

/** "3 de noviembre" / "November 3", from a YYYY-MM-DD date or a timestamp. */
export function formatFollowUpDate(value: string, language: FollowUpLanguage): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(language === "es" ? "es" : "en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] ?? "";

export function buildFollowUpMessage(input: {
  language: FollowUpLanguage;
  stage: FollowUpStage;
  company: string;
  position: string;
  appliedOn: string;
  recipientName: string | null;
  senderName: string;
}): FollowUpMessage {
  const { language, stage, company, position, senderName } = input;
  const name = firstName(input.recipientName);
  const date = formatFollowUpDate(input.appliedOn, language);

  if (language === "es") {
    const greeting = name ? `Hola ${name}:` : `Estimado equipo de ${company}:`;
    const opening =
      stage === "applied"
        ? `Espero que se encuentre muy bien. Le escribo para hacer seguimiento de mi postulación al puesto de ${position} en ${company}, que envié el ${date}.`
        : `Espero que se encuentre muy bien. Le escribo para agradecerle el tiempo dedicado en el proceso para el puesto de ${position} en ${company} y consultarle si hay novedades sobre los próximos pasos.`;
    const interest =
      stage === "applied"
        ? "Mantengo un gran interés en la posición y en la posibilidad de aportar al equipo. Quedo a disposición por si necesitan información adicional o desean coordinar una conversación."
        : "Mantengo un gran interés en la posición y en seguir avanzando en el proceso. Quedo a disposición para cualquier información adicional que necesiten.";
    return {
      subject:
        stage === "applied"
          ? `Seguimiento de mi postulación: ${position}`
          : `Consulta sobre próximos pasos: ${position}`,
      body: [greeting, opening, interest, "Muchas gracias por su tiempo y consideración.", `Saludos cordiales,\n${senderName}`.trim()].join(
        "\n\n",
      ),
    };
  }

  const greeting = name ? `Dear ${name},` : `Dear ${company} Hiring Team,`;
  const opening =
    stage === "applied"
      ? `I hope you are doing well. I am writing to follow up on my application for the ${position} position at ${company}, which I submitted on ${date}.`
      : `I hope you are doing well. Thank you again for your time during the process for the ${position} position at ${company}. I wanted to kindly ask whether there are any updates on the next steps.`;
  const interest =
    stage === "applied"
      ? "I remain very interested in the role and in the opportunity to contribute to your team. Please let me know if you need any additional information or would like to arrange a conversation."
      : "I remain very interested in the role and look forward to continuing the process. Please let me know if there is anything else I can provide.";
  return {
    subject:
      stage === "applied" ? `Following up on my application: ${position}` : `Next steps: ${position}`,
    body: [greeting, opening, interest, "Thank you for your time and consideration.", `Kind regards,\n${senderName}`.trim()].join(
      "\n\n",
    ),
  };
}

/** mailto: link with subject and body, or null without an email address. */
export function followUpMailto(email: string | null, message: FollowUpMessage): string | null {
  const address = email?.trim();
  // A malformed address (spaces, or ? and & that would break the query) gets no link.
  if (!address || /[\s?&]/.test(address)) return null;
  const params = `subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
  return `mailto:${address}?${params}`;
}

/**
 * Gmail compose URL with recipient, subject and body filled in. Works
 * without an address too (the "To" field is left empty). Opened with a
 * fixed window name, the browser reuses the compose tab it opened before
 * when it can; it cannot reach a Gmail tab the user opened by hand.
 */
export function followUpGmailUrl(email: string | null, message: FollowUpMessage): string {
  const params = new URLSearchParams({ view: "cm", fs: "1" });
  const address = email?.trim();
  if (address && !/[\s?&]/.test(address)) params.set("to", address);
  params.set("su", message.subject);
  params.set("body", message.body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
