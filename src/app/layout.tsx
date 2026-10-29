// Owned by Part A.
import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/shared/auth";
import { db } from "@/lib/shared/db";
import { now } from "@/lib/shared/clock";
import { NotificationBell } from "@/features/a/components/NotificationBell";
import { RoleSwitcher } from "@/features/a/components/RoleSwitcher";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { DemoClock } from "@/components/DemoClock";
import { Icon } from "@/components/ui";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-bricolage" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "TrustShare",
  description: "Share underused lab equipment and spaces, safely and fairly.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, users, at] = await Promise.all([getCurrentUser(), db.user.findMany({ orderBy: { name: "asc" } }), now()]);
  const isOwner = user?.role === "OWNER" || user?.role === "ADMIN";
  const isStaff = user?.role === "MANAGER" || user?.role === "ADMIN";

  // Same links and role rules as before; secondary ones live in the "Manage" menu.
  const primary: NavItem[] = [{ href: "/resources", label: "Resources" }];
  if (user) {
    primary.push({ href: "/bookings", label: "My bookings" }, { href: "/credentials", label: "Credentials" }, { href: "/history", label: "History" });
  }
  if (isOwner) primary.push({ href: "/owner/dashboard", label: "Dashboard" });
  if (isStaff) primary.push({ href: "/manager/queue", label: "Review queue" });

  const manage: NavItem[] = [];
  if (user) manage.push({ href: "/penalties", label: "My penalties" });
  if (isOwner) manage.push({ href: "/owner/resources", label: "My listings" });
  if (isStaff) {
    manage.push(
      { href: "/manager/credentials", label: "Verify credentials" },
      { href: "/manager/incidents", label: "Incidents" },
      { href: "/manager/penalties", label: "Penalties" },
      { href: "/admin/clock", label: "Demo clock" },
    );
  }
  if (user?.role === "ADMIN") manage.push({ href: "/admin", label: "Admin" });

  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const clockLabel = `${p.weekday} ${p.day} ${p.month} · ${p.hour}:${p.minute}`.toUpperCase();

  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen min-w-[1100px] flex-col bg-paper text-ink">
        <a href="#main-content" className="sr-only z-50 bg-brand p-2 text-white focus:not-sr-only focus:absolute focus:left-2 focus:top-2">
          Skip to content
        </a>

        <header className="sticky top-0 z-40 border-b border-line bg-surface">
          <div className="flex h-16 items-center gap-7 px-8">
            <Link href="/start" className="flex items-center gap-2.5">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-brand text-white">
                <Icon name="shieldCheck" size={17} strokeWidth={2} />
              </span>
              <span className="font-display text-[19px] font-bold tracking-tight text-brand-deep">TrustShare</span>
            </Link>
            <NavLinks primary={primary} manage={manage} />
            <div className="flex items-center gap-3.5">
              {user && <NotificationBell userId={user.id} />}
              <RoleSwitcher users={users} currentUserId={user?.id} />
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1200px] flex-1 px-8 pb-24 pt-8">
          {children}
        </main>

        <footer className="border-t border-line bg-surface py-4 text-center text-[13px] text-ink-3">
          <Link href="/privacy" className="font-medium text-ink-2 underline">Privacy</Link> &middot; Demo environment, all data is fictional
        </footer>

        <DemoClock label={clockLabel} canAdvance={isStaff} />
      </body>
    </html>
  );
}