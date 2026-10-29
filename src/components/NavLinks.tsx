"use client";
// Main navigation with active-state highlighting. Secondary (role) links collapse into a "Manage" menu.
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLinks({ primary, manage }: { primary: NavItem[]; manage: NavItem[] }) {
  const pathname = usePathname() ?? "";
  const manageActive = manage.some((m) => isActive(pathname, m.href));
  return (
    <nav aria-label="Main" className="flex flex-1 items-center gap-1">
      {primary.map((l) => (
        <Link key={l.href} href={l.href} className={`nav-link ${isActive(pathname, l.href) ? "active" : ""}`} aria-current={isActive(pathname, l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      {manage.length > 0 && (
        <details className="group relative">
          <summary className={`nav-link flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${manageActive ? "active" : ""}`}>
            Manage
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition group-open:rotate-180">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
            {manage.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-lg px-3 py-2 text-sm ${isActive(pathname, l.href) ? "bg-brand-soft font-semibold text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </details>
      )}
    </nav>
  );
}
