"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Pulsing dot while the link's page loads. It replaces the app-wide
 * loading.tsx skeleton, which made repeat navigations to the same dynamic
 * route (e.g. a second /fit/[id]) hang in production.
 */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={
        "h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600 transition-opacity " +
        (pending ? "animate-pulse opacity-100" : "opacity-0")
      }
    />
  );
}

export function NavLinks({
  links,
  onNavigate,
}: {
  links: NavLink[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={
                "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition " +
                (active
                  ? "bg-accent-50 text-accent-700"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900")
              }
            >
              {link.label}
              <PendingDot />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
