import { z } from "zod";

export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_RESUME_FILE_SIZE_MB = 10;

export const RESUME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const resumeLabelSchema = z
  .string()
  .trim()
  .min(1, "Label is required.")
  .max(120, "Label must be 120 characters or fewer.");

export type ResumeFileValidation =
  | { success: true; file: File }
  | { success: false; error: string };

export function validateResumeFile(
  value: FormDataEntryValue | null,
): ResumeFileValidation {
  if (!(value instanceof File) || value.size === 0) {
    return { success: false, error: "Choose a PDF or DOCX file." };
  }

  if (value.size > MAX_RESUME_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: `File must be ${MAX_RESUME_FILE_SIZE_MB} MB or smaller.`,
    };
  }

  if (!RESUME_MIME_TYPES.includes(value.type as (typeof RESUME_MIME_TYPES)[number])) {
    return { success: false, error: "Only PDF and DOCX files are allowed." };
  }

  return { success: true, file: value };
}
