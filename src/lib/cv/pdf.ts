import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import type { TailoredCv } from "@/lib/ai/fit";

import { cvLabels, formatCvRange, joinParts } from "./format";

/**
 * ATS-friendly CV PDF.
 *
 * Choices that keep applicant tracking systems able to parse it:
 * - one column, left-aligned, read top to bottom; no tables, columns,
 *   images, icons, headers/footers or text boxes;
 * - real text in a standard font (Helvetica), so it can be selected and
 *   extracted; standard section headings;
 * - each fact on its own line (dates below the title instead of
 *   right-aligned on the same line, which some parsers interleave);
 * - document title, author and language set in the metadata.
 */

export type CvPdfContact = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
};

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = { x: 54, top: 54, bottom: 54 };
const COLORS = { text: rgb(0.1, 0.1, 0.12), muted: rgb(0.32, 0.34, 0.38), rule: rgb(0.75, 0.77, 0.8) };

const REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "•": "-",
  "…": "...",
  " ": " ",
  "→": "->",
};

class Writer {
  private page: PDFPage;
  private y: number;
  private readonly width = PAGE.width - MARGIN.x * 2;
  private readonly encodable = new Map<string, boolean>();

  constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN.top;
  }

  /** Replace characters the standard (WinAnsi) font cannot encode. */
  clean(text: string): string {
    let out = "";
    for (const char of text.replace(/\s+/g, " ")) {
      let ok = this.encodable.get(char);
      if (ok === undefined) {
        try {
          this.regular.encodeText(char);
          ok = true;
        } catch {
          ok = false;
        }
        this.encodable.set(char, ok);
      }
      out += ok ? char : (REPLACEMENTS[char] ?? "");
    }
    return out.replace(/\s+([.,;:!?)])/g, "$1").replace(/\s{2,}/g, " ").trim();
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN.bottom) {
      this.page = this.doc.addPage([PAGE.width, PAGE.height]);
      this.y = PAGE.height - MARGIN.top;
    }
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Break words longer than the line (e.g. long URLs).
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
    return lines;
  }

  text(
    raw: string,
    { size = 10, bold = false, color = COLORS.text, indent = 0, hangingIndent = 0, after = 2, lineGap = 3.2 } = {},
  ) {
    const value = this.clean(raw);
    if (!value) return;
    const font = bold ? this.bold : this.regular;
    const lines = this.wrap(value, font, size, this.width - indent - hangingIndent);
    lines.forEach((line, index) => {
      this.ensure(size + lineGap);
      this.y -= size;
      this.page.drawText(line, {
        x: MARGIN.x + indent + (index === 0 ? 0 : hangingIndent),
        y: this.y,
        size,
        font,
        color,
      });
      this.y -= lineGap;
    });
    this.y -= after;
  }

  bullet(raw: string) {
    const value = this.clean(raw);
    if (!value) return;
    const size = 10;
    const marker = "•";
    const gap = this.regular.widthOfTextAtSize(`${marker} `, size);
    const lines = this.wrap(value, this.regular, size, this.width - 10 - gap);
    lines.forEach((line, index) => {
      this.ensure(size + 3.2);
      this.y -= size;
      if (index === 0) {
        this.page.drawText(marker, { x: MARGIN.x + 10, y: this.y, size, font: this.regular, color: COLORS.text });
      }
      this.page.drawText(line, { x: MARGIN.x + 10 + gap, y: this.y, size, font: this.regular, color: COLORS.text });
      this.y -= 3.2;
    });
    this.y -= 1;
  }

  heading(raw: string) {
    this.ensure(40);
    this.y -= 10;
    this.text(raw.toUpperCase(), { size: 10.5, bold: true, after: 0 });
    this.y -= 1;
    this.page.drawLine({
      start: { x: MARGIN.x, y: this.y },
      end: { x: PAGE.width - MARGIN.x, y: this.y },
      thickness: 0.6,
      color: COLORS.rule,
    });
    this.y -= 6;
  }

  space(points: number) {
    this.y -= points;
  }
}

export async function renderCvPdf({
  cv,
  contact,
  language,
  jobTitle,
}: {
  cv: TailoredCv;
  contact: CvPdfContact;
  language: string;
  jobTitle: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const labels = cvLabels(language);
  const w = new Writer(doc, regular, bold);

  const name = contact.fullName || "Curriculum Vitae";
  doc.setTitle(joinParts([name, cv.headline || jobTitle], " - "));
  doc.setAuthor(contact.fullName);
  doc.setSubject(jobTitle ? `CV - ${jobTitle}` : "CV");
  doc.setKeywords(cv.skills.slice(0, 20));
  doc.setLanguage(language);
  doc.setCreator("gestjobs");
  doc.setProducer("gestjobs");

  // Header: name, headline, contact details (one per line group, plain text).
  w.text(name, { size: 18, bold: true, after: 2 });
  if (cv.headline) w.text(cv.headline, { size: 11.5, color: COLORS.muted, after: 3 });
  const contactLine = [contact.location, contact.email, contact.phone].filter(Boolean).join(" | ");
  if (contactLine) w.text(contactLine, { size: 9.5, color: COLORS.muted, after: 1 });
  const links = contact.links.map((link) => link.url).filter(Boolean).join(" | ");
  if (links) w.text(links, { size: 9.5, color: COLORS.muted, after: 1 });

  if (cv.summary) {
    w.heading(labels.summary);
    w.text(cv.summary, { after: 2 });
  }

  if (cv.experiences.length) {
    w.heading(labels.experience);
    cv.experiences.forEach((job, index) => {
      if (index > 0) w.space(5);
      w.text(joinParts([job.title, job.company], " - "), { bold: true, size: 10.5, after: 0 });
      const meta = joinParts([formatCvRange(job.startDate, job.endDate, job.current, language), job.location], " | ");
      if (meta) w.text(meta, { size: 9.5, color: COLORS.muted, after: 2 });
      job.bullets.forEach((bullet) => w.bullet(bullet));
    });
  }

  if (cv.education.length) {
    w.heading(labels.education);
    cv.education.forEach((item, index) => {
      if (index > 0) w.space(4);
      w.text(joinParts([joinParts([item.degree, item.field]), item.institution], " - "), {
        bold: true,
        size: 10.5,
        after: 0,
      });
      const range = formatCvRange(item.startDate, item.endDate, false, language);
      if (range) w.text(range, { size: 9.5, color: COLORS.muted, after: 1 });
    });
  }

  if (cv.skills.length) {
    w.heading(labels.skills);
    w.text(cv.skills.join(", "));
  }

  if (cv.languages.length) {
    w.heading(labels.languages);
    w.text(cv.languages.map((l) => joinParts([l.language, l.level], " - ")).join(", "));
  }

  if (cv.certifications.length) {
    w.heading(labels.certifications);
    cv.certifications.forEach((c) => w.text(joinParts([c.name, c.issuer, c.year], " - "), { after: 1 }));
  }

  return doc.save();
}

/** Safe download name, e.g. "Ana Perez - Frontend Engineer - CV.pdf". */
export function cvFileName(fullName: string, jobTitle: string): string {
  const base = joinParts([fullName, jobTitle, "CV"], " - ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w .-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || "CV"}.pdf`;
}
