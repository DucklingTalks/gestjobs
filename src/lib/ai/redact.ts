/**
 * Contact-detail redaction.
 *
 * The user asked that email, phone and personal links never reach the AI
 * provider. Before a CV's text is sent, these are pulled out locally and
 * replaced with placeholders; the extracted values are merged back into the
 * profile without the model ever seeing them.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL = /\b(?:https?:\/\/|www\.)[^\s<>()"']+|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)\/[^\s<>()"']+/gi;
// 7+ digits with optional +, spaces, dots, dashes or parentheses.
const PHONE = /(?<![\w/])\+?\d[\d\s().-]{6,}\d(?![\w/])/g;

export type ExtractedContacts = {
  emails: string[];
  phones: string[];
  urls: string[];
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function looksLikePhone(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  // Skip year ranges such as "2019 - 2023" and short numbers.
  if (/^\d{4}\s*[-–]\s*\d{4}$/.test(candidate.trim())) return false;
  return digits.length >= 8 && digits.length <= 15;
}

export function redactContacts(text: string): { text: string; contacts: ExtractedContacts } {
  const emails: string[] = [];
  const urls: string[] = [];
  const phones: string[] = [];

  let output = text.replace(EMAIL, (match) => {
    emails.push(match);
    return "[email]";
  });
  output = output.replace(URL, (match) => {
    urls.push(match.replace(/[.,;:]+$/, ""));
    return "[link]";
  });
  output = output.replace(PHONE, (match) => {
    if (!looksLikePhone(match)) return match;
    phones.push(match);
    return "[phone]";
  });

  return {
    text: output,
    contacts: { emails: unique(emails), phones: unique(phones), urls: unique(urls) },
  };
}

export function labelForUrl(url: string): string {
  const host = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  if (host.includes("linkedin")) return "LinkedIn";
  if (host.includes("github")) return "GitHub";
  if (host.includes("gitlab")) return "GitLab";
  if (host.includes("behance")) return "Behance";
  return "Website";
}

export function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
