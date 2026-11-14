"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
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
                "block rounded-md px-3 py-2 text-sm font-medium transition " +
                (active
                  ? "bg-accent-50 text-accent-700"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900")
              }
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
