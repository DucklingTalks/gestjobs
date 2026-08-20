import type { ReactNode } from "react";
import Link from "next/link";

import { MobileMenu } from "@/components/mobile-menu";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/contacts", label: "Contacts" },
  { href: "/resumes", label: "Resumes" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-6 py-5">
          <Link
            href="/dashboard"
            className="text-sm font-semibold uppercase tracking-wide text-accent-600"
          >
            gestjobs
          </Link>
        </div>
        <nav className="flex-1 px-4">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="relative flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Link
            href="/dashboard"
            className="text-sm font-semibold uppercase tracking-wide text-accent-600"
          >
            gestjobs
          </Link>
          <MobileMenu links={navLinks} />
        </header>
        {children}
      </div>
    </div>
  );
}
