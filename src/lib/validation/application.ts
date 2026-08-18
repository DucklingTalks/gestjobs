import { z } from "zod";

import { MAX_RESUME_FILE_SIZE_BYTES } from "@/lib/validation/resume";

/**
 * Zod schemas for the application form and server actions.
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/applications/spec.md
 *   § Requirement: Application CRUD, Mandatory Platform URL, Job Proposal Capture
 *
 * Every rule here is enforced at the action boundary (PR 4 files under
 * `src/app/applications/actions.ts`). The RLS policies in
 * `supabase/migrations/001_initial_schema.sql` cover the tenant boundary.
 *
 * The schema is intentionally split into small pieces so the form fields
 * can validate independently:
 *   - `applicationIdSchema` / `applicationPlatformIdSchema` — UUID guards.
 *   - `applicationPlatformUrlSchema` — URL hostname inference fuel.
 *   - `applicationJobProposalUrlSchema` — distinct URL field, distinct
 *     validation message. Spec scenario "Invalid proposal URL rejected".
 *   - `applicationInputSchema` — the full payload accepted by create/update.
 *   - `applicationStatusChangeSchema` — the minimal payload for status flips.
 *   - `applicationContactAttachSchema` — the payload for linking contacts.
 *   - `applicationResumeAttachSchema` — the payload for resume attachment.
 *
 * File size budget (const, not a zod primitive): the proposal file limit
 * reuses the resume limit so we have one source of truth for "what can be
 * uploaded".
 */

export const MAX_PROPOSAL_FILE_SIZE_BYTES = MAX_RESUME_FILE_SIZE_BYTES;
export const MAX_PROPOSAL_FILE_SIZE_MB = 10;

export const PROPOSAL_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const trimmedText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `Must be ${max} characters or fewer.`)
    .transform((value) => value);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const applicationDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Application date must be in YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "Application date is not a valid calendar date.",
  });

/**
 * Validate the platform URL. Reject empty, non-HTTP(S), or malformed URLs.
 * Empty string is rejected because the platform URL is mandatory per spec
 * scenario "Invalid URL rejected".
 */
export const applicationPlatformUrlSchema = z
  .string()
  .trim()
  .min(1, "Platform URL is required.")
  .max(2_048, "Platform URL must be 2048 characters or fewer.")
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    "Enter a valid HTTP(S) URL (e.g. https://boards.greenhouse.io/jobs/123).",
  );

/**
 * Validate the optional job-proposal URL. Same URL rules as the platform
 * URL but allowed to be empty.
 */
export const applicationJobProposalUrlSchema = z
  .string()
  .trim()
  .max(2_048, "Job proposal URL must be 2048 characters or fewer.")
  .refine(
    (value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    "Enter a valid HTTP(S) URL.",
  )
  .transform((value) => value || null);

export const applicationIdSchema = z.string().uuid("Invalid application id.");

export const applicationStatusIdSchema = z
  .string()
  .uuid("Invalid status id.");

export const applicationContactIdSchema = z
  .string()
  .uuid("Invalid contact id.");

export const applicationResumeIdSchema = z
  .string()
  .uuid("Invalid resume id.");

export const applicationRoleSchema = z
  .string()
  .trim()
  .min(1, "Role is required.")
  .max(80, "Role must be 80 characters or fewer.");

export const applicationCompanyNameSchema = trimmedText(
  120,
  "Company name must be 120 characters or fewer.",
)
  .pipe(z.string().min(1, "Company name is required."));

export const applicationPositionTitleSchema = trimmedText(
  160,
  "Position title must be 160 characters or fewer.",
)
  .pipe(z.string().min(1, "Position title is required."));

const applicationJobProposalTextSchema = optionalText(20_000);

export { applicationJobProposalTextSchema };

export const applicationInputSchema = z.object({
  companyName: applicationCompanyNameSchema,
  positionTitle: applicationPositionTitleSchema,
  platformUrl: applicationPlatformUrlSchema,
  platformName: z
    .string()
    .trim()
    .min(1, "Platform name is required.")
    .max(120, "Platform name must be 120 characters or fewer."),
  statusId: applicationStatusIdSchema,
  applicationDate: applicationDateSchema,
  jobProposalText: applicationJobProposalTextSchema,
  jobProposalUrl: applicationJobProposalUrlSchema,
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export const applicationUpdateSchema = applicationInputSchema.extend({
  applicationId: applicationIdSchema,
});

export type ApplicationUpdateInput = z.infer<typeof applicationUpdateSchema>;

export const applicationStatusChangeSchema = z.object({
  applicationId: applicationIdSchema,
  toStatusId: applicationStatusIdSchema,
});

export type ApplicationStatusChangeInput = z.infer<
  typeof applicationStatusChangeSchema
>;

export const applicationContactAttachSchema = z.object({
  applicationId: applicationIdSchema,
  contactId: applicationContactIdSchema,
  role: applicationRoleSchema,
});

export type ApplicationContactAttachInput = z.infer<
  typeof applicationContactAttachSchema
>;

export const applicationContactDetachSchema = z.object({
  applicationId: applicationIdSchema,
  contactId: applicationContactIdSchema,
  role: applicationRoleSchema,
});

export type ApplicationContactDetachInput = z.infer<
  typeof applicationContactDetachSchema
>;

export const applicationResumeAttachSchema = z.object({
  applicationId: applicationIdSchema,
  resumeId: applicationResumeIdSchema,
});

export type ApplicationResumeAttachInput = z.infer<
  typeof applicationResumeAttachSchema
>;

export type ProposalFileValidation =
  | { success: true; file: File }
  | { success: false; error: string };

export function validateProposalFile(
  value: FormDataEntryValue | null,
): ProposalFileValidation {
  if (!(value instanceof File) || value.size === 0) {
    return { success: false, error: "Choose a PDF or DOCX file." };
  }

  if (value.size > MAX_PROPOSAL_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: `File must be ${MAX_PROPOSAL_FILE_SIZE_MB} MB or smaller.`,
    };
  }

  if (
    !PROPOSAL_MIME_TYPES.includes(
      value.type as (typeof PROPOSAL_MIME_TYPES)[number],
    )
  ) {
    return { success: false, error: "Only PDF and DOCX files are allowed." };
  }

  return { success: true, file: value };
}
