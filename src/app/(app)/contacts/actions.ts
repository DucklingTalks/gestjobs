"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  contactIdSchema,
  contactSchema,
  type ContactInput,
} from "@/lib/validation/contact";

function contactInput(formData: FormData): ContactInput {
  const result = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    linkedin_url: formData.get("linkedin_url"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    redirect(`/contacts?error=${encodeURIComponent(result.error.issues[0]?.message ?? "Invalid contact.")}`);
  }

  return result.data;
}

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createContact(formData: FormData) {
  const input = contactInput(formData);
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("contacts")
    .insert({ ...input, user_id: user.id });

  if (error) redirect("/contacts?error=Unable%20to%20create%20contact.");
  revalidatePath("/contacts");
  redirect("/contacts?status=created");
}

export async function updateContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!contactIdSchema.safeParse(id).success) {
    redirect("/contacts?error=Invalid%20contact.");
  }

  const input = contactInput(formData);
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("contacts")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) redirect("/contacts?error=Unable%20to%20update%20contact.");
  revalidatePath("/contacts");
  redirect("/contacts?status=updated");
}

export async function deleteContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!contactIdSchema.safeParse(id).success) {
    redirect("/contacts?error=Invalid%20contact.");
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) redirect("/contacts?error=Unable%20to%20delete%20contact.");
  revalidatePath("/contacts");
  redirect("/contacts?status=deleted");
}
