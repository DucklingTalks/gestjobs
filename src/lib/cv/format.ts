/**
 * Language-aware labels and date formatting for the tailored CV. Shared by
 * the on-screen preview and the PDF so both read the same.
 */

export type CvLabels = {
  summary: string;
  experience: string;
  education: string;
  skills: string;
  languages: string;
  certifications: string;
  present: string;
};

const LABELS: Record<string, CvLabels> = {
  en: {
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    languages: "Languages",
    certifications: "Certifications",
    present: "Present",
  },
  es: {
    summary: "Perfil profesional",
    experience: "Experiencia",
    education: "Educación",
    skills: "Habilidades",
    languages: "Idiomas",
    certifications: "Certificaciones",
    present: "Actualidad",
  },
  pt: {
    summary: "Resumo",
    experience: "Experiência",
    education: "Formação",
    skills: "Competências",
    languages: "Idiomas",
    certifications: "Certificações",
    present: "Atual",
  },
};

export function cvLabels(language: string): CvLabels {
  return LABELS[language] ?? LABELS.en;
}

function locale(language: string): string {
  return LABELS[language] ? language : "en";
}

/** "2021-03" → "Mar 2021" / "mar 2021"; "2021" → "2021". */
export function formatCvDate(value: string, language: string): string {
  const match = value.match(/^(\d{4})(?:-(\d{2}))?$/);
  if (!match) return value;
  const [, year, month] = match;
  if (!month) return year;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const name = new Intl.DateTimeFormat(locale(language), { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

export function formatCvRange(
  start: string,
  end: string,
  current: boolean,
  language: string,
): string {
  const from = start ? formatCvDate(start, language) : "";
  const to = current ? cvLabels(language).present : end ? formatCvDate(end, language) : "";
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/** "Title, Field" style degree line without dangling separators. */
export function joinParts(parts: Array<string | undefined>, separator = ", "): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(separator);
}
