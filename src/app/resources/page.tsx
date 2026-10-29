// Owned by Part A: resource search with shareable URL filters.
import Link from "next/link";
import { ResourceType, RiskLevel } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/shared/db";
import { getCurrentUser } from "@/lib/shared/auth";
import { checkEligibility } from "@/lib/shared/eligibility";
import { LIVE_STATUSES } from "@/lib/shared/types";
import { Icon, PageHead, RiskBadge } from "@/components/ui";

type Params = { q?: string; type?: string; location?: string; risk?: string; date?: string; onlyMine?: string };

const pick = "w-full";

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { q, type, location, risk, date, onlyMine } = await searchParams;
  const user = await getCurrentUser();

  const typeFilter = (Object.values(ResourceType) as string[]).includes(type ?? "") ? (type as ResourceType) : undefined;
  const riskFilter = (Object.values(RiskLevel) as string[]).includes(risk ?? "") ? (risk as RiskLevel) : undefined;

  const where: Prisma.ResourceWhereInput = {
    status: { not: "ARCHIVED" },
    type: typeFilter,
    riskLevel: riskFilter,
    location: location ? { equals: location } : undefined,
    OR: q
      ? [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ]
      : undefined,
  };

  const [found, locations] = await Promise.all([
    db.resource.findMany({
      where,
      orderBy: { name: "asc" },
      include: { requirements: { include: { credential: true } } },
    }),
    db.resource.findMany({ where: { status: { not: "ARCHIVED" } }, select: { location: true }, distinct: ["location"], orderBy: { location: "asc" } }),
  ]);

  // "Free on date": open that day and no live booking overlapping the opening hours.
  let resources = found;
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : null;
  if (day && !Number.isNaN(day.getTime())) {
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const busy = await db.booking.findMany({
      where: { resourceId: { in: found.map((r) => r.id) }, status: { in: LIVE_STATUSES }, start: { lt: dayEnd }, end: { gt: dayStart } },
      select: { resourceId: true, start: true, end: true },
    });
    resources = found.filter((r) => {
      if (!r.openDays.includes(day.getDay())) return false;
      const open = new Date(day);
      open.setHours(r.openHour, 0, 0, 0);
      const close = new Date(day);
      close.setHours(r.closeHour, 0, 0, 0);
      return !busy.some((b) => b.resourceId === r.id && b.start < close && b.end > open);
    });
  }

  const cards = await Promise.all(
    resources.map(async (res) => ({
      res,
      eligibility: user ? await checkEligibility(user.id, res.id) : null,
    })),
  );
  const shown = onlyMine && user ? cards.filter((c) => c.eligibility?.eligible) : cards;

  return (
    <div>
      <PageHead
        title="Find a resource"
        sub={
          <>
            {resources.length} machines, tools and rooms across the department — each with clear rules and an honest answer about whether{" "}
            <b className="text-ink">you</b> can book it right now.
          </>
        }
        right={
          user && (
            <Link
              href={`/resources?${new URLSearchParams(
                Object.entries({ q, type, location, risk, date, onlyMine: onlyMine ? undefined : "1" }).filter((e): e is [string, string] => !!e[1]),
              ).toString()}`}
              className={`chip ${onlyMine ? "chip-active" : "hover:bg-surface-2"}`}
              aria-pressed={!!onlyMine}
            >
              <Icon name="filter" size={14} /> Only what I can book
            </Link>
          )
        }
      />

      <form method="get" className="card mb-6 grid grid-cols-[1.6fr_1fr_1fr_1fr_1.1fr_auto] items-end gap-3 px-[18px] py-4">
        <div>
          <label htmlFor="q" className="field-label">Search</label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input id="q" name="q" defaultValue={q} placeholder="Name or keyword" className={`${pick} !pl-9`} />
          </div>
        </div>
        <div>
          <label htmlFor="type" className="field-label">Type</label>
          <select id="type" name="type" defaultValue={typeFilter ?? ""} className={pick}>
            <option value="">All types</option>
            {Object.values(ResourceType).map((t) => (
              <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location" className="field-label">Location</label>
          <select id="location" name="location" defaultValue={location ?? ""} className={pick}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.location} value={l.location}>{l.location}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="risk" className="field-label">Risk level</label>
          <select id="risk" name="risk" defaultValue={riskFilter ?? ""} className={pick}>
            <option value="">Any</option>
            {Object.values(RiskLevel).map((r) => (
              <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date" className="field-label">Free on</label>
          <input id="date" type="date" name="date" defaultValue={date} className={pick} />
        </div>
        <div className="flex items-center gap-2">
          {user && onlyMine && <input type="hidden" name="onlyMine" value="1" />}
          <button className="btn btn-primary">Filter</button>
          <Link href="/resources" className="btn btn-secondary">Clear</Link>
        </div>
      </form>

      {shown.length === 0 && (
        <div className="card card-pad text-center text-ink-2">
          <Icon name="search" size={22} className="mx-auto mb-2 text-ink-3" />
          No resources match these filters.
        </div>
      )}

      <ul className="grid grid-cols-3 gap-5">
        {shown.map(({ res, eligibility }) => {
          const missing = eligibility?.checks.filter((c) => !c.passed).map((c) => c.label) ?? [];
          return (
            <li key={res.id}>
              <Link href={`/resources/${res.id}`} className="card card-hover flex h-full flex-col overflow-hidden">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                  {res.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={res.photoUrl} alt={res.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-soft to-surface-2 text-brand-line">
                      <Icon name="shieldCheck" size={56} strokeWidth={1.2} />
                    </div>
                  )}
                  <RiskBadge level={res.riskLevel} className="absolute left-3 top-3 shadow-sm" />
                  {res.status === "OUT_OF_SERVICE" && (
                    <span className="risk risk-high absolute right-3 top-3 shadow-sm">Out of service</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <div>
                    <h2 className="font-sans text-[16px] font-semibold tracking-[-0.01em]">{res.name}</h2>
                    <p className="mt-0.5 font-mono text-[11.5px] uppercase tracking-[.02em] text-ink-3">
                      {res.location} &middot; {res.type}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {res.requiresSupervisor && <span className="chip">Requires supervisor</span>}
                    {res.requirements.map((r) => (
                      <span key={r.credentialId} className="chip">Needs: {r.credential.name}</span>
                    ))}
                  </div>
                  {eligibility && (
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-line pt-2.5">
                      {eligibility.eligible ? (
                        <span className="elig elig-ok">
                          <Icon name="check" size={13} strokeWidth={2.4} /> You can book this
                        </span>
                      ) : (
                        <span className="elig elig-blocked">
                          <Icon name="alert" size={13} strokeWidth={2.2} /> Missing: {missing.join(", ")}
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-ink-2">{res.maxHoursPerBooking}h max</span>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {user && shown.length > 0 && (
        <p className="mt-6 text-center text-[12.5px] text-ink-2">
          Can&apos;t book something? Every blocked card tells you <b className="text-ink">exactly why</b> and what fixes it — no dead ends.
        </p>
      )}
    </div>
  );
}