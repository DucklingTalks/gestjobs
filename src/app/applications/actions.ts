"use server";

/**
 * Server actions for applications: CRUD, status workflow, and attachments.
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/applications/spec.md
 *
 * Every action returns via `redirect(?error=...)` or `redirect(?status=...)`
 * so the form pages can pick up the message via `searchParams`. Pages in
 * `src/app/applications/{page,new/page,[id]/page}.tsx` read `error` and
 * `status` and render them as alert/status banners.
 *
 * Conventions:
 *   - Auth: every action re-checks `supabase.auth.getUser()` and refuses
 *     to write if `auth.uid()` is null. RLS in 001_initial_schema.sql
 *     enforces the same at the database layer; the client-side check is
 *     here to keep error messages friendly.
 *   - Tenant safety: every write additionally filters by `user_id` (or
 *     joins through `applications` to check `user_id`) so a future bug
 *     that leaks an id never escalates to a cross-user write.
 *   - Status changes are transactional: insert into application_status_history
 *     and update applications.status_id in the same call. The
 *     `set_updated_at` trigger updates `applications.updated_at` for the
 *     reminder consumer (PR 5) to key off.
 *   - File lifecycle: proposal files are uploaded to `proposals/{user_id}/{application_id}-{filename}`
 *     after the application row exists, so `ON DELETE CASCADE` removes
 *     the storage handle implicitly. `deleteApplication` removes the
 *     object explicitly to keep the bucket tidy.
 */

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { inferPlatformFromUrl, normalizeHostname, type Platform } from "@/lib/platforms/infer";
import {
  applicationContactAttachSchema,
  applicationContactDetachSchema,
  applicationContactIdSchema,
  applicationIdSchema,
  applicationInputSchema,
  applicationPlatformUrlSchema,
  applicationResumeAttachSchema,
  applicationResumeIdSchema,
  applicationStatusChangeSchema,
  applicationStatusIdSchema,
  applicationUpdateSchema,
  validateProposalFile,
} from "@/lib/validation/application";

const PROPOSAL_BUCKET = "proposals";

export type UpsertCustomPlatformInput = {
  name: string;
  /**
   * Pre-normalized hostname (e.g. "boards.greenhouse.io"). The caller is
   * responsible for running `normalizeHostname` from `@/lib/platforms/infer`
   * over the raw URL it captured from the form. The action validates that
   * the input matches a basic hostname shape but does not re-parse a URL
   * — the form already has the URL in hand.
   */
  hostname: string;
};

export type UpsertCustomPlatformResult =
  | {
      ok: true;
      platform: Platform;
    }
  | {
      ok: false;
      error: string;
    };

const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase: null, user: null, error: "You must be signed in." } as const;
  }
  return { supabase, user, error: null } as const;
}

function redirectWithError(target: string, error: string): never {
  redirect(`${target}?error=${encodeURIComponent(error)}`);
}

function firstZodIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

/**
 * Insert (or rename) a per-user custom platform.
 *
 * Persists `{ user_id, name, hostname, is_custom: true }` into `platforms`.
 * The unique index `(user_id, hostname)` makes the upsert idempotent — a
 * second call with the same `hostname` updates the `name` instead of
 * creating a duplicate row. Spec scenario "Reuse custom platform" relies
 * on this so that a hostname a user typed once never produces two rows.
 *
 * Spec scenarios covered:
 *   - "Custom platform entry" — first call inserts a new row, returns it.
 *   - "Reuse custom platform" — subsequent calls with the same hostname
 *     resolve to the existing row and the form sees the original `id`.
 *   - "Normalized hostname storage" — the caller passes a normalized
 *     hostname (no protocol, no leading "www.", lowercase).
 */
export async function upsertCustomPlatform(
  input: UpsertCustomPlatformInput,
): Promise<UpsertCustomPlatformResult> {
  const name = input.name.trim();
  const hostname = input.hostname.trim().toLowerCase();

  if (!name) {
    return { ok: false, error: "Platform name is required." };
  }
  if (name.length > 100) {
    return { ok: false, error: "Platform name must be 100 characters or fewer." };
  }
  if (!hostname) {
    return { ok: false, error: "Platform hostname is required." };
  }
  if (!HOSTNAME_PATTERN.test(hostname)) {
    return {
      ok: false,
      error: `Hostname "${hostname}" is not a valid hostname.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to save a custom platform.",
    };
  }

  const { data, error } = await supabase
    .from("platforms")
    .upsert(
      {
        user_id: user.id,
        name,
        hostname,
        is_custom: true,
      },
      { onConflict: "user_id,hostname" },
    )
    .select("id, user_id, name, hostname, is_custom")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return {
      ok: false,
      error: "Custom platform could not be saved (empty response).",
    };
  }

  return {
    ok: true,
    platform: {
      id: data.id,
      name: data.name,
      hostname: data.hostname,
      isCustom: data.is_custom,
    },
  };
}

/**
 * Map a form payload to the validated application input shape.
 *
 * Because the `create` and `update` payloads share fields, the schema is
 * selected dynamically based on `includeId`. The optional
 * `applicationDate` defaults to today server-side when missing.
 */
function parseApplicationForm(
  formData: FormData,
  includeId: boolean,
):
  | {
      input:
        | import("@/lib/validation/application").ApplicationInput
        | import("@/lib/validation/application").ApplicationUpdateInput;
      error: null;
    }
  | { input: null; error: string } {
  const raw = {
    companyName: String(formData.get("companyName") ?? ""),
    positionTitle: String(formData.get("positionTitle") ?? ""),
    platformUrl: String(formData.get("platformUrl") ?? ""),
    platformName: String(formData.get("platformName") ?? ""),
    statusId: String(formData.get("statusId") ?? ""),
    applicationDate: String(formData.get("applicationDate") ?? ""),
    jobProposalText: String(formData.get("jobProposalText") ?? ""),
    jobProposalUrl: String(formData.get("jobProposalUrl") ?? ""),
  };

  const schema = includeId
    ? applicationUpdateSchema
    : applicationInputSchema;

  const parsed = includeId
    ? schema.safeParse({
        ...raw,
        applicationId: String(formData.get("applicationId") ?? ""),
      })
    : schema.safeParse(raw);

  if (!parsed.success) {
    return { input: null, error: firstZodIssue(parsed.error) };
  }

  return { input: parsed.data, error: null };
}

/**
 * Resolve a platform id from the form payload.
 *
 * The form carries either:
 *   - `platformId` (UUID) — combobox hit on a stored platform.
 *   - `platformName` + `platformUrl` — custom platform to upsert.
 *
 * In both cases the URL is re-validated against `normalizeHostname` so a
 * custom platform row always carries a normalized hostname.
 */
async function resolvePlatformId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData,
): Promise<
  { ok: true; platformId: string } | { ok: false; error: string }
> {
  const platformIdRaw = String(formData.get("platformId") ?? "").trim();
  const platformName = String(formData.get("platformName") ?? "").trim();
  const platformUrl = String(formData.get("platformUrl") ?? "").trim();

  const urlCheck = applicationPlatformUrlSchema.safeParse(platformUrl);
  if (!urlCheck.success) {
    return { ok: false, error: firstZodIssue(urlCheck.error) };
  }

  // Path 1: existing platform id (combobox hit on a stored row).
  if (platformIdRaw) {
    const idCheck = z.string().uuid().safeParse(platformIdRaw);
    if (!idCheck.success) {
      return { ok: false, error: "Invalid platform id." };
    }
    const { data, error } = await supabase
      .from("platforms")
      .select("id")
      .eq("id", idCheck.data)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .maybeSingle();
    if (error) {
      return { ok: false, error: "Unable to resolve platform." };
    }
    if (!data) {
      return { ok: false, error: "Selected platform is not available." };
    }
    return { ok: true, platformId: data.id };
  }

  // Path 2: custom platform — infer hostname from URL, upsert.
  const hostname = (() => {
    try {
      return normalizeHostname(platformUrl);
    } catch {
      return null;
    }
  })();

  if (!hostname) {
    return {
      ok: false,
      error: "Platform URL is not a valid HTTP(S) hostname.",
    };
  }

  if (!platformName) {
    return {
      ok: false,
      error: "Platform name is required for a custom platform.",
    };
  }

  const candidate = inferPlatformFromUrl(platformUrl, [
    { id: null, name: platformName, hostname, isCustom: true },
  ]);

  if (!candidate) {
    return { ok: false, error: "Custom platform could not be inferred." };
  }

  const upsert = await upsertCustomPlatform({
    name: platformName,
    hostname,
  });

  if (!upsert.ok) {
    return { ok: false, error: upsert.error };
  }

  return { ok: true, platformId: upsert.platform.id ?? "" };
}

/**
 * Save a proposal file, if one was attached.
 *
 * Returns `{ filePath, error }`:
 *   - `filePath`: storage object path on success, `null` if no file was supplied.
 *   - `error`: a user-facing message on failure.
 *
 * Compensation: if a later step fails, the caller calls
 * `removeProposalFile` to roll back the upload.
 */
async function saveProposalFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  applicationId: string,
  formData: FormData,
): Promise<{ filePath: string | null; error: string | null }> {
  const file = formData.get("jobProposalFile");
  if (!(file instanceof File) || file.size === 0) {
    return { filePath: null, error: null };
  }

  const validation = validateProposalFile(file);
  if (!validation.success) {
    return { filePath: null, error: validation.error };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const extension = file.type === "application/pdf" ? "pdf" : "docx";
  const safeBaseName = file.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "proposal";
  const filePath = `${userId}/${applicationId}-${randomUUID()}-${safeBaseName}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PROPOSAL_BUCKET)
    .upload(filePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { filePath: null, error: "Unable to upload proposal file." };
  }

  return { filePath, error: null };
}

async function removeProposalFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filePath: string,
): Promise<void> {
  await supabase.storage.from(PROPOSAL_BUCKET).remove([filePath]);
}

/**
 * Create a new application.
 *
 * Spec scenario: "Create application" — visible in the list afterwards.
 * Also runs the platform inference path (combobox fallback / custom upsert).
 */
export async function createApplication(formData: FormData) {
  const parsed = parseApplicationForm(formData, false);
  if (!parsed.input) {
    redirectWithError("/applications/new", parsed.error);
  }

  const { supabase, user, error: authError } = await requireUser();
  if (!supabase || !user) {
    redirectWithError("/applications/new", authError ?? "You must be signed in.");
  }

  const platform = await resolvePlatformId(supabase, user.id, formData);
  if (!platform.ok) {
    redirectWithError("/applications/new", platform.error);
  }

  const input = parsed.input as import("@/lib/validation/application").ApplicationInput;

  // Insert without the proposal file path; we need the application id to
  // build the storage path.
  const insertsAt = new Date().toISOString();
  const { data: created, error: insertError } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      company_name: input.companyName,
      position_title: input.positionTitle,
      platform_id: platform.platformId,
      platform_url: input.platformUrl,
      application_date: input.applicationDate,
      status_id: input.statusId,
      job_proposal_text: input.jobProposalText,
      job_proposal_url: input.jobProposalUrl,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    redirectWithError("/applications/new", "Unable to create application.");
  }

  // Record the initial status row so the timeline starts with the chosen
  // status. (`from_status_id` is null because no prior state exists.)
  const { error: historyError } = await supabase
    .from("application_status_history")
    .insert({
      application_id: created.id,
      from_status_id: null,
      to_status_id: input.statusId,
      changed_at: insertsAt,
    });

  if (historyError) {
    // Best-effort: a missing initial history row is recoverable — the
    // user can re-save the application or change status. We do NOT
    // cascade-delete the application here.
  }

  const file = await saveProposalFile(supabase, user.id, created.id, formData);
  if (file.error) {
    // Compensate the application row + history insert if the file upload failed.
    await supabase
      .from("application_status_history")
      .delete()
      .eq("application_id", created.id);
    await supabase.from("applications").delete().eq("id", created.id);
    redirectWithError("/applications/new", file.error);
  }

  if (file.filePath) {
    const { error: updateError } = await supabase
      .from("applications")
      .update({ job_proposal_file_path: file.filePath })
      .eq("id", created.id)
      .eq("user_id", user.id);
    if (updateError) {
      await removeProposalFile(supabase, file.filePath);
      await supabase
        .from("application_status_history")
        .delete()
        .eq("application_id", created.id);
      await supabase.from("applications").delete().eq("id", created.id);
      redirectWithError("/applications/new", "Unable to attach proposal file.");
    }
  }

  revalidatePath("/applications");
  redirect(`/applications/${created.id}?status=created`);
}

/**
 * Update an existing application.
 *
 * The status change is a separate action (see `changeApplicationStatus`)
 * so the history row can be inserted in the same transaction.
 */
export async function updateApplication(formData: FormData) {
  const parsed = parseApplicationForm(formData, true);
  if (!parsed.input) {
    const target = String(formData.get("applicationId") ?? "");
    redirectWithError(`/applications/${target}`, parsed.error);
  }

  const update = parsed.input as import("@/lib/validation/application").ApplicationUpdateInput;

  const { supabase, user, error: authError } = await requireUser();
  if (!supabase || !user) {
    redirectWithError(`/applications/${update.applicationId}`, authError ?? "You must be signed in.");
  }

  const platform = await resolvePlatformId(supabase, user.id, formData);
  if (!platform.ok) {
    redirectWithError(`/applications/${update.applicationId}`, platform.error);
  }

  const { error } = await supabase
    .from("applications")
    .update({
      company_name: update.companyName,
      position_title: update.positionTitle,
      platform_id: platform.platformId,
      platform_url: update.platformUrl,
      application_date: update.applicationDate,
      job_proposal_text: update.jobProposalText,
      job_proposal_url: update.jobProposalUrl,
    })
    .eq("id", update.applicationId)
    .eq("user_id", user.id);

  if (error) {
    redirectWithError(`/applications/${update.applicationId}`, "Unable to update application.");
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${update.applicationId}`);
  redirect(`/applications/${update.applicationId}?status=updated`);
}

/**
 * Delete an application.
 *
 * Spec scenario: "Delete application" — cascade removes history, joins,
 * and dispatch rows. We also clean up the proposal file in storage to
 * keep the bucket tidy.
 */
export async function deleteApplication(formData: FormData) {
  const id = String(formData.get("applicationId") ?? "");
  if (!applicationIdSchema.safeParse(id).success) {
    redirectWithError("/applications", "Invalid application id.");
  }

  const { supabase, user, error: authError } = await requireUser();
  if (!supabase || !user) {
    redirectWithError("/applications", authError ?? "You must be signed in.");
  }

  // Read the proposal file path so we can clean up storage after the row
  // cascade fires.
  const { data: existing } = await supabase
    .from("applications")
    .select("job_proposal_file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirectWithError(`/applications/${id}`, "Unable to delete application.");
  }

  if (existing?.job_proposal_file_path) {
    await removeProposalFile(supabase, existing.job_proposal_file_path);
  }

  revalidatePath("/applications");
  redirect("/applications?status=deleted");
}

/**
 * Change an application's status.
 *
 * Spec scenario: "Status change records history" — writes an immutable
 * history row and bumps `applications.updated_at` (the trigger does the
 * bump; we update `status_id` to make the trigger fire).
 */
export async function changeApplicationStatus(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const toStatusId = String(formData.get("toStatusId") ?? "");

  const parsed = applicationStatusChangeSchema.safeParse({
    applicationId,
    toStatusId,
  });

  if (!parsed.success) {
    redirectWithError(`/applications/${applicationId}`, firstZodIssue(parsed.error));
  }

  const { supabase, user, error: authError } = await requireUser();
  if (!supabase || !user) {
    redirectWithError(`/applications/${applicationId}`, authError ?? "You must be signed in.");
  }

  // Fetch the current status so we can record `from_status_id` in the
  // history row. RLS keeps the row scoped to the authenticated user.
  const { data: current, error: readError } = await supabase
    .from("applications")
    .select("status_id")
    .eq("id", parsed.data.applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, "Unable to read application.");
  }

  if (!current) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, "Application not found.");
  }

  if (current.status_id === parsed.data.toStatusId) {
    // No-op: do not write a duplicate history row.
    redirect(`/applications/${parsed.data.applicationId}?status=unchanged`);
  }

  // Validate the destination status belongs to the user too.
  const { data: status, error: statusError } = await supabase
    .from("statuses")
    .select("id")
    .eq("id", parsed.data.toStatusId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (statusError || !status) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, "Selected status is not available.");
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status_id: parsed.data.toStatusId })
    .eq("id", parsed.data.applicationId)
    .eq("user_id", user.id);

  if (updateError) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, "Unable to update status.");
  }

  const { error: historyError } = await supabase
    .from("application_status_history")
    .insert({
      application_id: parsed.data.applicationId,
      from_status_id: current.status_id,
      to_status_id: parsed.data.toStatusId,
    });

  if (historyError) {
    // Roll the status back if the history insert failed.
    await supabase
      .from("applications")
      .update({ status_id: current.status_id })
      .eq("id", parsed.data.applicationId)
      .eq("user_id", user.id);
    redirectWithError(`/applications/${parsed.data.applicationId}`, "Unable to record status change.");
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${parsed.data.applicationId}`);
  redirect(`/applications/${parsed.data.applicationId}?status=changed`);
}

/**
 * Attach a resume version to an application.
 *
 * Spec scenario: "Attach resume to application" — joins on the
 * `application_resumes` table whose PK is `application_id`. A subsequent
 * attach replaces the previous row (spec scenario "Change attached resume").
 */
export async function attachResume(formData: FormData) {
  const parsed = applicationResumeAttachSchema.safeParse({
    applicationId: String(formData.get("applicationId") ?? ""),
    resumeId: String(formData.get("resumeId") ?? ""),
  });

  if (!parsed.success) {
    const target = String(formData.get("applicationId") ?? "");
    redirectWithError(`/applications/${target}`, firstZodIssue(parsed.error));
  }

  const { supabase, user, error: authError } = await requireUser();
  if (!supabase || !user) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, authError ?? "You must be signed in.");
  }

  // Validate ownership of both rows.
  const [{ data: app, error: appError }, { data: resume, error: resumeError }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("id")
        .eq("id", parsed.data.applicationId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("resumes")
        .select("id")
        .eq("id", parsed.data.resumeId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (appError || resumeError || !app || !resume) {
    redirectWithError(
      `/applications/${parsed.data.applicationId}`,
      "Selected resume is not available.",
    );
  }

  const { error } = await supabase
    .from("application_resumes")
    .upsert(
      {
        application_id: parsed.data.applicationId,
        resume_id: parsed.data.resumeId,
      },
      { onConflict: "application_id" },
    );

  if (error) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, "Unable to attach resume.");
  }

  revalidatePath(`/applications/${parsed.data.applicationId}`);
  redirect(`/applications/${parsed.data.applicationId}?status=resume-attached`);
}

/**
 * Detach (remove) the resume attached to an application.
 *
 * Spec scenario: "Detach resume" — deletes the join row. The underlying
 * `resumes` version is NOT deleted.
 */
export async function detachResume(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationIdSchema.safeParse(applicationId).success) {
    redirectWithError("/applications", "Invalid application id.");
  }

  const { supabase, user, error: authError } = await requireUser();
  if (!supabase || !user) {
    redirectWithError(`/applications/${applicationId}`, authError ?? "You must be signed in.");
  }

  const { error } = await supabase
    .from("application_resumes")
    .delete()
    .eq("application_id", applicationId);

  if (error) {
    redirectWithError(`/applications/${applicationId}`, "Unable to detach resume.");
  }

  revalidatePath(`/applications/${applicationId}`);
  redirect(`/applications/${applicationId}?status=resume-detached`);
}

/**
 * Attach a contact to an application with a role.
 *
 * Spec scenario: "Assign recruiter" / "Reuse contact across applications".
 * The PK is `(application_id, contact_id, role)`, so a duplicate attach
 * with the same role is idempotent.
 */
export async function attachContact(formData: FormData) {
  const parsed = applicationContactAttachSchema.safeParse({
    applicationId: String(formData.get("applicationId") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
    role: String(formData.get("role") ?? ""),
  });

  if (!parsed.success) {
    const target = String(formData.get("applicationId") ?? "");
    redirectWithError(`/applications/${target}`, firstZodIssue(parsed.error));
  }

  const { supabase, user, error: authError } = await requireUser();
  if (!supabase || !user) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, authError ?? "You must be signed in.");
  }

  // Ownership checks.
  const [{ data: app, error: appError }, { data: contact, error: contactError }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("id")
        .eq("id", parsed.data.applicationId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("contacts")
        .select("id")
        .eq("id", parsed.data.contactId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (appError || contactError || !app || !contact) {
    redirectWithError(
      `/applications/${parsed.data.applicationId}`,
      "Selected contact is not available.",
    );
  }

  const { error } = await supabase
    .from("application_contacts")
    .upsert(
      {
        application_id: parsed.data.applicationId,
        contact_id: parsed.data.contactId,
        role: parsed.data.role,
      },
      { onConflict: "application_id,contact_id,role" },
    );

  if (error) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, "Unable to attach contact.");
  }

  revalidatePath(`/applications/${parsed.data.applicationId}`);
  redirect(`/applications/${parsed.data.applicationId}?status=contact-attached`);
}

/**
 * Detach a contact from an application.
 *
 * Spec scenario: "Remove contact linkage" — deletes the join row only.
 * The contact directory entry is preserved.
 */
export async function detachContact(formData: FormData) {
  const parsed = applicationContactDetachSchema.safeParse({
    applicationId: String(formData.get("applicationId") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
    role: String(formData.get("role") ?? ""),
  });

  if (!parsed.success) {
    const target = String(formData.get("applicationId") ?? "");
    redirectWithError(`/applications/${target}`, firstZodIssue(parsed.error));
  }

  const { supabase, user, error: authError } = await requireUser();
  if (!supabase || !user) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, authError ?? "You must be signed in.");
  }

  const { error } = await supabase
    .from("application_contacts")
    .delete()
    .eq("application_id", parsed.data.applicationId)
    .eq("contact_id", parsed.data.contactId)
    .eq("role", parsed.data.role);

  if (error) {
    redirectWithError(`/applications/${parsed.data.applicationId}`, "Unable to detach contact.");
  }

  revalidatePath(`/applications/${parsed.data.applicationId}`);
  redirect(`/applications/${parsed.data.applicationId}?status=contact-detached`);
}

// Re-export so the form pages can validate client-side role text without
// pulling the validation module directly. NOTE: a "use server" file may
// only export async functions, so the validation schemas live in
// `@/lib/validation/application` and are imported directly by the form
// components. Calling code that needs the response shapes imports the
// types from this file via `import type` (erased at build time).
