import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert, PageHeader, PageShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow } from "@/lib/validation/profile";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "full_name, headline, email, phone, location, bio, skills, links, languages, experiences, education, certifications, updated_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = profileFromRow(data);
  // Prefill the contact email from the account on first visit.
  if (!data && user.email) profile.email = user.email;

  return (
    <PageShell width="4xl">
      <PageHeader
        title="Profile"
        description="Your experience, education and skills. gestjobs uses this to score how well you fit a job and to draft a cover letter and a tailored CV."
      />
      {error ? (
        <div className="mb-6">
          <Alert tone="error">Unable to load your profile. Refresh to try again.</Alert>
        </div>
      ) : null}
      <ProfileForm initial={profile} />
    </PageShell>
  );
}
