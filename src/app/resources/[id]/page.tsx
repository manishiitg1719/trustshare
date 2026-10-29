// Owned by Part A: resource detail with eligibility panel and 7-day availability.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/shared/db";
import { getCurrentUser, canManageResource } from "@/lib/shared/auth";
import { checkEligibility } from "@/lib/shared/eligibility";
import { now } from "@/lib/shared/clock";
import { LIVE_STATUSES } from "@/lib/shared/types";
import { BookButton } from "@/features/b/components/BookButton";
import { HistoryTimeline } from "@/features/c/components/HistoryTimeline";
import { Icon, RiskBadge } from "@/components/ui";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ResourceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const resource = await db.resource.findUnique({
    where: { id },
    include: { requirements: { include: { credential: true } } },
  });
  if (!resource) notFound();

  const at = await now();
  const [eligibility, waitlisted] = await Promise.all([
    user ? checkEligibility(user.id, resource.id) : Promise.resolve(null),
    db.booking.count({ where: { resourceId: resource.id, status: "WAITLISTED", end: { gt: at } } }),
  ]);
  const canManage = !!user && canManageResource(user, resource);

  // Availability for the next 7 days (hour cells, booked ones greyed out).
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(at);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const windowEnd = new Date(days[6]);
  windowEnd.setDate(windowEnd.getDate() + 1);
  const booked = await db.booking.findMany({
    where: { resourceId: resource.id, status: { in: LIVE_STATUSES }, start: { lt: windowEnd }, end: { gt: days[0] } },
    select: { start: true, end: true },
  });
  const hours = Array.from({ length: resource.closeHour - resource.openHour }, (_, i) => resource.openHour + i);
  const isBooked = (d: Date, h: number) => {
    const s = new Date(d);
    s.setHours(h, 0, 0, 0);
    const e = new Date(d);
    e.setHours(h + 1, 0, 0, 0);
    return booked.some((b) => b.start < e && b.end > s);
  };

  const credentialIdByName = new Map(resource.requirements.map((r) => [r.credential.name, r.credentialId]));

  const failed = eligibility?.checks.filter((c) => !c.passed) ?? [];
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 font-mono text-[11.5px] uppercase tracking-[.04em] text-ink-3">
        <Link href="/resources" className="hover:text-ink">Resources</Link> / {resource.location} / <span className="text-ink">{resource.name}</span>
      </nav>

      <div className="grid grid-cols-[1fr_370px] gap-6">
        <div className="min-w-0 space-y-5">
          <div className="overflow-hidden rounded-[20px] border border-line bg-surface-2 shadow-sm">
            {resource.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resource.photoUrl} alt={resource.name} className="h-[340px] w-full object-cover" />
            ) : (
              <div className="flex h-[220px] w-full items-center justify-center bg-gradient-to-br from-brand-soft to-surface-2 text-brand-line">
                <Icon name="shieldCheck" size={72} strokeWidth={1.1} />
              </div>
            )}
          </div>

          <section>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[32px] font-bold leading-tight">{resource.name}</h1>
              <RiskBadge level={resource.riskLevel} />
              <span className="chip"><Icon name="pin" size={13} /> {resource.location}</span>
              {resource.status === "OUT_OF_SERVICE" && <span className="risk risk-high">Out of service</span>}
              {resource.status === "ARCHIVED" && <span className="chip">Archived, no longer bookable</span>}
              {user && (user.role === "ADMIN" || resource.ownerId === user.id) && (
                <Link href={`/owner/resources/${resource.id}/edit`} className="btn btn-secondary btn-sm ml-auto">
                  <Icon name="edit" size={14} /> Edit
                </Link>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[15px] text-ink-2">{resource.description}</p>
          </section>

          {eligibility && !eligibility.eligible && (
            <section className="fixit space-y-3" aria-labelledby="fixit-title">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border border-warn-line bg-[#FEF3C7] text-warn">
                  <Icon name="alert" size={15} strokeWidth={2} />
                </span>
                <div>
                  <h2 id="fixit-title" className="font-sans text-[14px] font-bold tracking-normal text-[#92400E]">
                    You can&apos;t book this yet — here&apos;s exactly how to fix it
                  </h2>
                  <div className="label !text-warn">Eligibility · {failed.length} of {eligibility.checks.length} checks missing</div>
                </div>
              </div>
              <ul className="space-y-2.5">
                {failed.map((check, i) => {
                  const credId = check.rule === "credential" ? credentialIdByName.get(check.label) : undefined;
                  return (
                    <li key={i} className="space-y-1.5 text-[13.5px]">
                      <div className="flex items-start gap-2.5">
                        <Icon name="x" size={13} strokeWidth={2.4} className="mt-1 text-bad" />
                        <span><b>Missing:</b> {check.label} — {check.detail}</span>
                      </div>
                      {check.fix && (
                        <div className="flex items-start gap-2.5">
                          <Icon name="arrow" size={13} strokeWidth={2.2} className="mt-1 text-brand" />
                          <span><b>How to fix:</b> {check.fix}</span>
                        </div>
                      )}
                      {credId && (
                        <Link href={`/credentials?request=${credId}`} className="btn btn-primary btn-sm ml-6">
                          Request this credential
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="card card-pad" aria-labelledby="rules-title">
            <h2 id="rules-title" className="label mb-3.5 !font-mono !tracking-[.14em]">House rules · set by the owner</h2>
            <dl className="grid grid-cols-4 gap-x-5 gap-y-4">
              {[
                ["shield", "Supervisor", resource.requiresSupervisor ? "Required" : "Not required"],
                ["user", "External users", resource.externalAllowed ? "Allowed" : "Department members only"],
                ["clock", "Opening hours", `${hh(resource.openHour)} to ${hh(resource.closeHour)}, ${resource.openDays.map((d) => DAY_NAMES[d]).join(", ")}`],
                ["calendar", "Max per booking", `${resource.maxHoursPerBooking} h`],
                ["scale", "Monthly quota", `${resource.monthlyHourQuota} h per person`],
                ["reset", "Cooldown", `${resource.cooldownDays} days between bookings`],
                ["pin", "Location", resource.location],
                ["alert", "Risk level", resource.riskLevel.charAt(0) + resource.riskLevel.slice(1).toLowerCase()],
              ].map(([icon, k, v]) => (
                <div key={k} className="flex gap-2.5">
                  <span className="check-ic !h-7 !w-7 !border-line !bg-surface-2 !text-ink-2"><Icon name={icon as "shield"} size={14} /></span>
                  <div className="min-w-0">
                    <dt className="text-[12px] font-semibold text-ink">{k}</dt>
                    <dd className="text-[13px] text-ink-2">{v}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {resource.usageRules && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-1 text-[13px] font-semibold">Usage rules</h3>
                <p className="whitespace-pre-wrap text-[13.5px] text-ink-2">{resource.usageRules}</p>
              </div>
            )}
            {resource.checklist.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Icon name="camera" size={14} /> Condition checklist (pickup &amp; return)</h3>
                <ul className="grid grid-cols-2 gap-2">
                  {resource.checklist.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-[13px] text-ink-2">
                      <span className="check-ic !h-[18px] !w-[18px]"><Icon name="check" size={11} strokeWidth={2.6} /></span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card card-pad" aria-labelledby="avail-title">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 id="avail-title" className="text-[18px] font-semibold">Availability, next 7 days</h2>
                <p className="text-[12.5px] text-ink-2">
                  {waitlisted} {waitlisted === 1 ? "person is" : "people are"} on the waitlist.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11.5px] text-ink-2">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] border border-ok-line bg-ok-bg" />Free</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-brand" />Booked</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-surface-2" />Closed</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-[3px] text-xs">
                <thead>
                  <tr>
                    <th className="p-1 text-left font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">Day</th>
                    {hours.map((h) => (
                      <th key={h} className="p-1 text-center font-mono text-[10.5px] font-normal text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const open = resource.openDays.includes(d.getDay());
                    return (
                      <tr key={d.toISOString()}>
                        <th className="whitespace-nowrap p-1 pr-3 text-left font-mono text-[11px] font-medium uppercase text-ink-2">
                          {DAY_NAMES[d.getDay()]} {d.getDate()}
                        </th>
                        {hours.map((h) => {
                          if (!open) return <td key={h} className="h-7 rounded-md bg-surface-2"><span className="sr-only">Closed</span></td>;
                          const b = isBooked(d, h);
                          return (
                            <td key={h} className={`h-7 rounded-md ${b ? "bg-brand" : "border border-ok-line bg-ok-bg"}`} title={b ? "Booked" : "Free"}>
                              <span className="sr-only">{b ? "Booked" : "Free"}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {canManage && (
            <section>
              <HistoryTimeline resourceId={resource.id} />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card card-pad shadow-md" aria-labelledby="can-book">
            <h2 id="can-book" className="mb-3.5 text-[18px] font-semibold">Can you book this?</h2>
            {!user && <p className="text-[13px] text-ink-2">Sign in as a persona to check your eligibility.</p>}
            {eligibility && (
              <ul className="space-y-2.5">
                {eligibility.checks.map((check, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px]">
                    <span className={`check-ic ${check.passed ? "" : "fail"}`} aria-hidden>
                      <Icon name={check.passed ? "check" : "x"} size={12} strokeWidth={2.6} />
                    </span>
                    <span className="sr-only">{check.passed ? "Passed:" : "Failed:"}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{check.label}</div>
                      <div className="text-ink-2">{check.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {eligibility &&
            (eligibility.eligible ? (
              <BookButton resourceId={resource.id} />
            ) : (
              <div className="card card-pad text-center">
                <p className="text-[13px] font-semibold text-ink-2">Fix the items above to book</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[.04em] text-ink-3">
                  {resource.riskLevel === "LOW" ? "Low-risk → approved instantly when all checks pass" : `${resource.riskLevel.toLowerCase()}-risk item → goes to a manager for approval`}
                </p>
              </div>
            ))}

          <section className="why">
            <h2 className="mb-2 flex items-center gap-2 font-sans text-[13.5px] font-bold tracking-normal text-brand-deep">
              <Icon name="scale" /> Why this decision?
            </h2>
            <p className="text-[13.5px] text-ink-2">
              When you request, you&apos;ll get a plain-words answer — approved, waitlisted or rejected, with the reason, the manager&apos;s name and
              your place in any queue.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}