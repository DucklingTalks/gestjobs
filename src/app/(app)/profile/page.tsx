import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert, PageHeader, PageShell } from "@/components/ui";
import { resolveAi } from "@/lib/ai/access";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, profileFromRow } from "@/lib/validation/profile";

import { SkillAliases } from "./aliases";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data, error }, { data: aliases }] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("skill_aliases")
      .select("id, posting_term, profile_term")
      .eq("user_id", user.id)
      .order("posting_term"),
  ]);

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
      <ProfileForm initial={profile} aiEnabled={(await resolveAi(supabase, user)).ok} />
      <SkillAliases aliases={aliases ?? []} />
    </PageShell>
  );
}
