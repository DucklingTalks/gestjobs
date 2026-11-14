import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/form-buttons";
import { Alert, fieldClass, labelClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signInWithOtp } from "./actions";

type SearchParams = {
  error?: string;
  status?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  "missing-email": "Enter your email address to receive a sign-in link.",
  "auth-callback": "That sign-in link is missing information. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const { error, status } = await searchParams;
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const requestOrigin = host ? `${protocol}://${host}` : "";
  const configuredOrigin = appUrl?.replace(/\/$/, "") ?? "";
  const origin = requestOrigin || configuredOrigin;

  const otpSent = status === "otp-sent";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
          >
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-md bg-accent-600 text-sm font-bold text-white"
            >
              g
            </span>
            gestjobs
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {otpSent ? "Check your inbox" : "Sign in"}
          </h1>
          <p className="text-sm text-slate-600">
            {otpSent
              ? "We sent you a one-time sign-in link. Open it on this device to continue."
              : "We will email you a one-time link. No password required."}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {status === "signed-out" ? (
            <div className="mb-4">
              <Alert tone="success">You have been signed out.</Alert>
            </div>
          ) : null}
          {error ? (
            <div className="mb-4">
              <Alert tone="error">{ERROR_MESSAGES[error] ?? error}</Alert>
            </div>
          ) : null}

          <form action={signInWithOtp} className="space-y-4">
            <input type="hidden" name="origin" value={origin} />
            <label className={labelClass}>
              Email
              <input
                type="email"
                name="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                className={fieldClass}
              />
            </label>
            <SubmitButton pendingLabel="Sending link…" className="w-full">
              {otpSent ? "Resend magic link" : "Send magic link"}
            </SubmitButton>
          </form>
        </div>
      </div>
    </main>
  );
}
