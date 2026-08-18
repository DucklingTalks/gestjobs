/**
 * Unit tests for the Zod validation schemas.
 *
 * Spec references:
 *   openspec/changes/gestjobs-mvp/specs/applications/spec.md
 *   openspec/changes/gestjobs-mvp/specs/contacts/spec.md
 *   openspec/changes/gestjobs-mvp/specs/resumes/spec.md
 *
 * These tests lock the action-boundary validation that PR 3 + PR 4 +
 * PR 5 rely on. Every Server Action re-parses a form payload with one
 * of these schemas (or its derived helper) before it touches Supabase;
 * a regression here means the API will accept bad input.
 */
import { describe, expect, it } from "vitest";

import {
  applicationInputSchema,
  applicationPlatformUrlSchema,
  applicationJobProposalUrlSchema,
  applicationStatusChangeSchema,
  applicationContactAttachSchema,
  validateProposalFile,
} from "@/lib/validation/application";
import { contactSchema } from "@/lib/validation/contact";
import {
  resumeLabelSchema,
  validateResumeFile,
  MAX_RESUME_FILE_SIZE_BYTES,
} from "@/lib/validation/resume";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

/**
 * Helper: build a real `File` object so we exercise the same validation
 * branches the Server Action runs at the action boundary. Node 22 exposes
 * the WHATWG `File` global, so the Server Action's `instanceof File`
 * check fires identically here.
 *
 * The second tuple element is the declared file size (used by validation).
 * The byte buffer is much smaller because we only need `file.size` to
 * report the requested number; allocating the full size (10+ MB) on
 * every test would slow the run.
 */
const stubFile = (
  name: string,
  size: number,
  type: string,
): File => {
  const buffer = new Uint8Array(16);
  const file = new File([buffer], name, { type });
  // `File.size` is computed from the byte length; force a more honest
  // value via the non-standard `size` setter so the validators see the
  // requested size for the oversize branch.
  Object.defineProperty(file, "size", { value: size, configurable: true });
  return file;
};

describe("applicationPlatformUrlSchema (Spec: Applications — Mandatory Platform URL)", () => {
  it("accepts HTTPS URLs", () => {
    const result = applicationPlatformUrlSchema.safeParse(
      "https://boards.greenhouse.io/jobs/123",
    );
    expect(result.success).toBe(true);
  });

  it("accepts HTTP URLs", () => {
    const result = applicationPlatformUrlSchema.safeParse(
      "http://example.com/job",
    );
    expect(result.success).toBe(true);
  });

  it("rejects empty input", () => {
    const result = applicationPlatformUrlSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("required");
    }
  });

  it("rejects non-HTTP(S) protocols", () => {
    const ftp = applicationPlatformUrlSchema.safeParse("ftp://example.com");
    expect(ftp.success).toBe(false);
    const js = applicationPlatformUrlSchema.safeParse("javascript:alert(1)");
    expect(js.success).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const result = applicationPlatformUrlSchema.safeParse("not a url");
    expect(result.success).toBe(false);
  });
});

describe("applicationJobProposalUrlSchema (Spec: Applications — Invalid proposal URL rejected)", () => {
  it("allows empty input (proposal URL is optional)", () => {
    const result = applicationJobProposalUrlSchema.safeParse("");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("accepts HTTPS URLs and returns the value", () => {
    const result = applicationJobProposalUrlSchema.safeParse(
      "https://example.com/proposal",
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("https://example.com/proposal");
    }
  });

  it("rejects malformed URLs with the action-boundary message", () => {
    const result = applicationJobProposalUrlSchema.safeParse("not a url");
    expect(result.success).toBe(false);
  });
});

describe("applicationInputSchema (Spec: Applications — Validation on create)", () => {
  const validInput = {
    companyName: "Acme Co.",
    positionTitle: "Senior Engineer",
    platformUrl: "https://boards.greenhouse.io/jobs/123",
    platformName: "Greenhouse",
    statusId: VALID_UUID,
    applicationDate: "2026-08-01",
    jobProposalText: "",
    jobProposalUrl: "",
  } as const;

  it("accepts a valid application payload", () => {
    const result = applicationInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects empty company name", () => {
    const result = applicationInputSchema.safeParse({
      ...validInput,
      companyName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty position title", () => {
    const result = applicationInputSchema.safeParse({
      ...validInput,
      positionTitle: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status id", () => {
    const result = applicationInputSchema.safeParse({
      ...validInput,
      statusId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid application_date format", () => {
    const result = applicationInputSchema.safeParse({
      ...validInput,
      applicationDate: "08/01/2026",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an ISO date in YYYY-MM-DD form", () => {
    const result = applicationInputSchema.safeParse({
      ...validInput,
      applicationDate: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a calendar-impossible date", () => {
    const result = applicationInputSchema.safeParse({
      ...validInput,
      applicationDate: "2026-13-40",
    });
    expect(result.success).toBe(false);
  });
});

describe("applicationStatusChangeSchema (Spec: Applications — Status workflow)", () => {
  it("accepts a valid status change payload", () => {
    const result = applicationStatusChangeSchema.safeParse({
      applicationId: VALID_UUID,
      toStatusId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID ids", () => {
    const result = applicationStatusChangeSchema.safeParse({
      applicationId: "not-a-uuid",
      toStatusId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });
});

describe("applicationContactAttachSchema (Spec: Applications — Attach contact with role)", () => {
  it("accepts a payload with role text", () => {
    const result = applicationContactAttachSchema.safeParse({
      applicationId: VALID_UUID,
      contactId: VALID_UUID,
      role: "Recruiter",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty role", () => {
    const result = applicationContactAttachSchema.safeParse({
      applicationId: VALID_UUID,
      contactId: VALID_UUID,
      role: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateProposalFile (Spec: Applications — Oversized / invalid file rejected)", () => {
  it("rejects a missing file", () => {
    const result = validateProposalFile(null);
    expect(result.success).toBe(false);
  });

  it("accepts a valid PDF under the size limit", () => {
    const file = stubFile(
      "proposal.pdf",
      1_000_000,
      "application/pdf",
    );
    const result = validateProposalFile(file);
    expect(result.success).toBe(true);
  });

  it("rejects an oversized file", () => {
    const file = stubFile(
      "proposal.pdf",
      MAX_RESUME_FILE_SIZE_BYTES + 1,
      "application/pdf",
    );
    const result = validateProposalFile(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/10\s*MB/);
    }
  });

  it("rejects an unsupported MIME type", () => {
    const file = stubFile(
      "proposal.exe",
      1_000,
      "application/x-msdownload",
    );
    const result = validateProposalFile(file);
    expect(result.success).toBe(false);
  });
});

describe("contactSchema (Spec: Contacts — Validation on create)", () => {
  const emptyContact = (overrides: Partial<{ name: string; email: string; phone: string; linkedin_url: string; notes: string }> = {}) => ({
    name: "Jane Doe",
    email: "",
    phone: "",
    linkedin_url: "",
    notes: "",
    ...overrides,
  });

  it("accepts a contact with only the required name", () => {
    const result = contactSchema.safeParse(emptyContact());
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = contactSchema.safeParse(emptyContact({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("accepts a contact with a valid email", () => {
    const result = contactSchema.safeParse(
      emptyContact({ email: "jane@example.com" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    const result = contactSchema.safeParse(
      emptyContact({ email: "not an email" }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a valid LinkedIn URL", () => {
    const result = contactSchema.safeParse(
      emptyContact({ linkedin_url: "https://www.linkedin.com/in/jane-doe" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("resumeLabelSchema (Spec: Resumes — Upload new resume)", () => {
  it("accepts a non-empty label", () => {
    const result = resumeLabelSchema.safeParse("Frontend-Senior");
    expect(result.success).toBe(true);
  });

  it("rejects an empty label", () => {
    const result = resumeLabelSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("validateResumeFile (Spec: Resumes — Invalid file type / Oversized file rejected)", () => {
  it("rejects a missing file", () => {
    const result = validateResumeFile(null);
    expect(result.success).toBe(false);
  });

  it("accepts a DOCX resume under the size limit", () => {
    const file = stubFile(
      "resume.docx",
      1_000_000,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const result = validateResumeFile(file);
    expect(result.success).toBe(true);
  });

  it("rejects an oversized resume", () => {
    const file = stubFile(
      "resume.pdf",
      MAX_RESUME_FILE_SIZE_BYTES + 1,
      "application/pdf",
    );
    const result = validateResumeFile(file);
    expect(result.success).toBe(false);
  });

  it("rejects an executable masquerading as a PDF", () => {
    const file = stubFile(
      "resume.exe",
      1_000,
      "application/x-msdownload",
    );
    const result = validateResumeFile(file);
    expect(result.success).toBe(false);
  });
});
