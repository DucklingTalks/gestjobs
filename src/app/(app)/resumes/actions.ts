"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resumeLabelSchema, validateResumeFile } from "@/lib/validation/resume";

const RESUME_BUCKET = "resumes";

export async function uploadResume(formData: FormData) {
  const label = resumeLabelSchema.safeParse(formData.get("label"));
  if (!label.success) {
    redirect(`/resumes?error=${encodeURIComponent(label.error.issues[0]?.message ?? "Invalid label.")}`);
  }

  const fileResult = validateResumeFile(formData.get("file"));
  if (!fileResult.success) {
    redirect(`/resumes?error=${encodeURIComponent(fileResult.error)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = fileResult.file;
  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const extension = file.type === "application/pdf" ? "pdf" : "docx";
  const safeBaseName = file.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "resume";
  const filePath = `${user.id}/${randomUUID()}-${safeBaseName}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(filePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) redirect("/resumes?error=Unable%20to%20upload%20resume.");

  const { error: insertError } = await supabase.from("resumes").insert({
    user_id: user.id,
    label: label.data,
    file_path: filePath,
    file_hash: fileHash,
    file_size: file.size,
  });

  if (insertError) {
    await supabase.storage.from(RESUME_BUCKET).remove([filePath]);
    redirect("/resumes?error=Unable%20to%20save%20resume%20metadata.");
  }

  revalidatePath("/resumes");
  redirect("/resumes?status=uploaded");
}
