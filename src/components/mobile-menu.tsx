"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { NavLinks, type NavLink } from "./nav-links";

export function MobileMenu({
  links,
  signOutAction,
}: {
  links: NavLink[];
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape and on outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
          />
        </svg>
      </button>

      {open ? (
        <div
          id="mobile-nav"
          className="absolute right-0 top-11 z-50 w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <nav aria-label="Main">
            <NavLinks links={links} onNavigate={() => setOpen(false)} />
          </nav>
          <form action={signOutAction} className="mt-2 border-t border-slate-100 pt-2">
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
