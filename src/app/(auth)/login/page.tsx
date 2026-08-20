import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signInWithOtp } from "./actions";

type SearchParams = {
  error?: string;
  status?: string;
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
  const origin = appUrl
    ? appUrl.replace(/\/$/, "")
    : host
      ? `${protocol}://${host}`
      : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-accent-600">
          gestjobs
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Sign in with a magic link
        </h1>
        <p className="text-sm text-slate-600">
          We will email you a one-time link. No password required.
        </p>
      </div>

      <form action={signInWithOtp} className="mt-8 space-y-4">
        <input type="hidden" name="origin" value={origin} />

        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-700"
        >
          Send magic link
        </button>
      </form>

      {status === "otp-sent" ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-accent-100 bg-accent-50 px-3 py-2 text-sm text-accent-700"
        >
          Check your inbox for the sign-in link.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
    </main>
  );
}