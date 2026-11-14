import Link from "next/link";

import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold text-accent-600">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        We couldn&apos;t find that page
      </h1>
      <p className="max-w-sm text-sm text-slate-600">
        It may have been deleted, or the link is incorrect.
      </p>
      <Link href="/dashboard" className={buttonStyles.primary}>
        Back to dashboard
      </Link>
    </main>
  );
}
