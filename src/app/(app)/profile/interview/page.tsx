import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert, buttonStyles, PageHeader, PageShell } from "@/components/ui";
import { isAiConfigured } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";

import { InterviewChat } from "./interview-chat";

export const metadata: Metadata = { title: "Profile interview" };

export default async function ProfileInterviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <PageShell width="3xl">
      <PageHeader
        breadcrumb={{ href: "/profile", label: "Profile" }}
        title="Profile interview"
        description="An AI interviewer asks about your experience to find strengths your profile is missing. Answer with real examples. You review everything before it is added to your profile."
      />
      {isAiConfigured() ? (
        <InterviewChat />
      ) : (
        <Alert tone="error">
          AI is not configured. Add OPENCODE_API_KEY to the environment.{" "}
          <Link href="/profile" className={buttonStyles.link}>
            Back to your profile
          </Link>
        </Alert>
      )}
    </PageShell>
  );
}
