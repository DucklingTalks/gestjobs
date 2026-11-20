import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/form-buttons";
import { Alert, Card, formatDateTime, PageHeader, PageShell } from "@/components/ui";
import { loadStoredCredential, resolveAi } from "@/lib/ai/access";
import { PROVIDER_INFO } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/server";

import { deleteAiKey } from "./actions";
import { AiKeyForm } from "./ai-key-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [stored, access] = await Promise.all([loadStoredCredential(supabase, user.id), resolveAi(supabase, user)]);

  return (
    <PageShell width="3xl">
      <PageHeader title="Settings" />

      <Card
        title="AI API key"
        description="The fit analysis, cover letters, tailored CVs, CV import and the profile interview run on your own AI key, billed to your account with the provider."
      >
        <div className="mb-5 space-y-3">
          {stored ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm">
                <p className="font-medium text-slate-900">
                  {PROVIDER_INFO[stored.provider].label} key{" "}
                  <span className="font-mono text-slate-600">••••{stored.keyHint}</span>
                </p>
                <p className="text-xs text-slate-500">Saved {formatDateTime(stored.updatedAt)}</p>
              </div>
              <form action={deleteAiKey}>
                <SubmitButton
                  variant="dangerLink"
                  pendingLabel="Removing…"
                  confirmMessage="Remove your AI key? The AI features stop working until you add one again."
                >
                  Remove key
                </SubmitButton>
              </form>
            </div>
          ) : access.ok && access.source === "shared" ? (
            <Alert tone="success">
              Your account uses the app&apos;s shared key. You can still add your own below; it takes priority.
            </Alert>
          ) : (
            <p className="text-sm text-slate-600">No key yet, so the AI features are off.</p>
          )}
          {!access.ok && access.reason === "unreadable" ? <Alert tone="error">{access.error}</Alert> : null}
        </div>

        <AiKeyForm initialProvider={stored?.provider ?? "anthropic"} replacing={Boolean(stored)} />

        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          The key is checked with the provider, then stored encrypted. It is never shown again or sent to your
          browser; only its last 4 characters are kept for display.
        </p>
      </Card>
    </PageShell>
  );
}
