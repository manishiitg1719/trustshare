// Presentational helpers for the Blueprint Trust design system. UI only, no business logic.
import type { ReactNode } from "react";

type RoleLike = "USER" | "OWNER" | "MANAGER" | "ADMIN" | string;

export const ROLE_COLOR: Record<string, string> = {
  USER: "#0369A1",
  OWNER: "#6D28D9",
  MANAGER: "#B45309",
  ADMIN: "#57534E",
};
const USER_SHADES = ["#0369A1", "#0E7490", "#0F766E", "#1D4ED8"];

export function initials(name: string): string {
  const parts = name.replace(/^(Dr\.|Prof\.)\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function avatarColor(name: string, role: RoleLike): string {
  if (role !== "USER") return ROLE_COLOR[role] ?? "#57534E";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return USER_SHADES[h % USER_SHADES.length];
}

export function Avatar({ name, role, size = 28 }: { name: string; role: RoleLike; size?: number }) {
  return (
    <span
      aria-hidden
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.39), background: avatarColor(name, role) }}
    >
      {initials(name)}
    </span>
  );
}

export function roleLabel(role: RoleLike): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function RolePill({ role }: { role: RoleLike }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
      <span className="dot" style={{ background: ROLE_COLOR[role] ?? "#8A837C" }} />
      {roleLabel(role)}
    </span>
  );
}

export function RiskBadge({ level, className = "" }: { level: "LOW" | "MEDIUM" | "HIGH" | string; className?: string }) {
  const cls = level === "HIGH" ? "risk-high" : level === "MEDIUM" ? "risk-medium" : "risk-low";
  return (
    <span className={`risk ${cls} ${className}`}>
      <span className="dot" />
      {level.charAt(0) + level.slice(1).toLowerCase()} risk
    </span>
  );
}

const PATHS: Record<string, ReactNode> = {
  shield: <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />,
  shieldCheck: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  scale: (
    <>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, strokeWidth = 1.8, className = "" }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        <h1 className="text-[30px] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-[15px] text-ink-2">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
