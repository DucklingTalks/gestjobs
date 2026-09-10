"use client";

import { useState } from "react";
import Link from "next/link";

type NavLink = {
  href: string;
  label: string;
};

export function MobileMenu({
  links,
  signOutAction,
}: {
  links: NavLink[];
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-500"
        aria-label="Toggle navigation menu"
        aria-expanded={open}
      >
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          {open ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-md border border-slate-200 bg-white py-2 shadow-lg">
          <nav>
            <ul className="space-y-1 px-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    Log out
                  </button>
                </form>
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
