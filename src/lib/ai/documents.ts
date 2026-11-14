/**
 * Plain-text extraction from uploaded CV files (server-only).
 */

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ExtractResult = { ok: true; text: string } | { ok: false; error: string };

function kindOf(file: File): "pdf" | "docx" | null {
  const name = file.name.toLowerCase();
  if (file.type === PDF || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX || name.endsWith(".docx")) return "docx";
  return null;
}

export async function extractDocumentText(file: File): Promise<ExtractResult> {
  if (!file.size) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_IMPORT_FILE_BYTES) return { ok: false, error: "The file must be 5 MB or smaller." };

  const kind = kindOf(file);
  if (!kind) return { ok: false, error: "Upload a PDF or a Word (.docx) file." };

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    let text: string;
    if (kind === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      text = (await extractText(pdf, { mergePages: true })).text;
    } else {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer })).value;
    }
    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 40) {
      return {
        ok: false,
        error: "No readable text was found. If the CV is a scanned image, fill the profile manually.",
      };
    }
    return { ok: true, text: text.slice(0, 60_000) };
  } catch (error) {
    console.error("[documents] extraction failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "The file could not be read. Try exporting it again as PDF or DOCX." };
  }
}
