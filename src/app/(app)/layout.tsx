import { Suspense, type ReactNode } from "react";
import Link from "next/link";

import { FlashToaster } from "@/components/flash-toaster";
import { MobileMenu } from "@/components/mobile-menu";
import { NavLinks } from "@/components/nav-links";
import { signOut } from "./actions";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/contacts", label: "Contacts" },
  { href: "/profile", label: "Profile" },
  { href: "/resumes", label: "Resumes" },
];

function Logo() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900"
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 place-items-center rounded-md bg-accent-600 text-sm font-bold text-white"
      >
        g
      </span>
      gestjobs
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex-1 px-3">
          <NavLinks links={navLinks} />
        </nav>
        <div className="border-t border-slate-100 px-3 py-3">
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
          <Logo />
          <MobileMenu links={navLinks} signOutAction={signOut} />
        </header>
        {children}
      </div>

      <Suspense fallback={null}>
        <FlashToaster />
      </Suspense>
    </div>
  );
}
