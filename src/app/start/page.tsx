// Owned by Part A: Judge Start Here.
import Link from "next/link";
import { db } from "@/lib/shared/db";
import { IDS } from "@/lib/shared/seed";
import { getCurrentUser } from "@/lib/shared/auth";
import { LIVE_STATUSES } from "@/lib/shared/types";
import { resetDemoAction, switchUser } from "@/lib/shared/session-actions";
import { Avatar, Icon, RolePill, roleLabel } from "@/components/ui";

type Step = { title: string; text: string; userId: string; who: string; next: string; cta: string };

const U = IDS.users;
const R = IDS.resources;
const B = IDS.bookings;

const STEPS: Step[] = [
  { title: "List a resource with its rules", text: "Owner lists a resource: create a new one and set its rules.", userId: U.joan, who: "Prof. Joan Reyes", next: "/owner/resources/new", cta: "Act as Prof." },
  { title: "See exactly what you're allowed to use", text: "User checks eligibility: open the laser cutter and see the missing induction and how to fix it.", userId: U.aisha, who: "Aisha", next: `/resources/${R.laser}`, cta: "See fix-it hint" },
  { title: "Request a booking", text: "User requests a booking: request the oscilloscope (or your new resource).", userId: U.ravi, who: "Ravi", next: `/resources/${R.scope}`, cta: "Act as Ravi" },
  { title: "A human decides, with a reason", text: "Manager reviews: open the queue and approve Ravi's laser request with a reason.", userId: U.sam, who: "Dr. Patel", next: "/manager/queue", cta: "Open the queue" },
  { title: "Check in, prove condition, return", text: "User checks in and returns: open the printer booking and return it with photos.", userId: U.ravi, who: "Ravi", next: `/bookings/${B.active}`, cta: "Follow booking" },
  { title: "Delay or damage, handled by a human", text: "Delay or damage handled by a human: handle the soldering station damage.", userId: U.sam, who: "Dr. Patel", next: "/manager/incidents", cta: "Handle incident" },
  { title: "Both sides see the full history", text: "Both sides see the full history: open a closed booking's timeline.", userId: U.sam, who: "Dr. Patel", next: `/bookings/${B.closed}`, cta: "Open timeline" },
];

export default async function StartPage({ searchParams }: { searchParams: Promise<{ reset?: string; denied?: string }> }) {
  const { reset, denied } = await searchParams;
  const [users, me, resourceCount, liveCount, pendingCount] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    getCurrentUser(),
    db.resource.count({ where: { status: { not: "ARCHIVED" } } }),
    db.booking.count({ where: { status: { in: LIVE_STATUSES } } }),
    db.booking.count({ where: { status: "REQUESTED" } }),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-9">
      {reset && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-ok-line bg-ok-bg px-4 py-3 text-sm font-semibold text-ok">
          <Icon name="check" size={15} strokeWidth={2.4} /> Demo data reset
        </p>
      )}
      {denied && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-bad-line bg-bad-bg px-4 py-3 text-sm font-semibold text-bad">
          <Icon name="alert" size={15} strokeWidth={2.2} /> That page needs a different role
        </p>
      )}

      {/* hero + demo controls */}
      <div className="grid grid-cols-[1fr_390px] gap-8">
        <section className="pt-5">
          <span className="label !text-brand">One department · shared gear · zero guesswork</span>
          <h1 className="mb-4 mt-3 text-[44px] font-bold leading-[1.1] tracking-[-0.025em]">
            Borrow the lab&apos;s gear —<br />
            without the guesswork.
          </h1>
          <p className="max-w-[580px] text-[15.5px] text-ink-2">
            TrustShare lets a college engineering department share its fab lab, camera kits, test equipment and rooms with its own students and
            nearby startups, without losing control of its property. It adds what owners worry about: who is allowed to use something, fair
            limits, a condition record before and after use, and a permanent history of every decision.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/resources" className="btn btn-primary">
              <Icon name="search" /> Browse resources
            </Link>
            <a href="#journey" className="btn btn-secondary">
              <Icon name="shield" /> How trust works
            </a>
          </div>
        </section>

        <section aria-labelledby="personas" className="card card-pad shadow-md">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 id="personas" className="label !font-mono !tracking-[.14em]">Demo controls</h2>
            <form action={resetDemoAction}>
              <button className="chip hover:border-bad-line hover:bg-bad-bg hover:text-bad">
                <Icon name="reset" size={13} /> Reset data
              </button>
            </form>
          </div>
          <p className="mb-3 text-[12.5px] text-ink-2">One click to see the product through anyone&apos;s eyes.</p>
          <ul className="space-y-0.5">
            {users.map((u) => {
              const on = me?.id === u.id;
              return (
                <li key={u.id}>
                  <form action={switchUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="next" value="/resources" />
                    <div className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${on ? "border-brand-line bg-brand-soft" : "border-transparent hover:bg-surface-2"}`}>
                      <Avatar name={u.name} role={u.role} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                          {u.name} <RolePill role={u.role} />
                        </span>
                        <span className="block truncate text-[11.5px] text-ink-2">{u.persona}</span>
                      </span>
                      <button className="btn btn-ghost btn-sm" aria-label={`Act as ${u.name} (${roleLabel(u.role)})`}>
                        Act as
                      </button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
          <div className="my-3 h-px bg-line" />
          <div className="flex items-center gap-2.5 rounded-[11px] bg-ink px-3 py-2.5">
            <Icon name="clock" size={15} className="text-[#A8A29E]" />
            <span className="font-mono text-[12px] text-[#E7E5E4]">Demo clock · skip +15m / +1h / +1d</span>
          </div>
        </section>
      </div>

      {/* journey */}
      <section aria-labelledby="journey" className="scroll-mt-24" id="journey-section">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="journey" className="scroll-mt-24 text-[22px] font-semibold">Try this journey</h2>
          <span className="label">{STEPS.length} steps · about 6 minutes</span>
        </div>
        <ol className="grid grid-cols-3 gap-5">
          {STEPS.map((s, i) => {
            const actor = byId.get(s.userId);
            return (
              <li key={i} className="card card-pad flex flex-col gap-2.5">
                <span className="step-num self-start">STEP {String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-[18px] font-semibold leading-snug tracking-[-0.01em]">{s.title}</h3>
                <p className="flex-1 text-[13.5px] text-ink-2">{s.text}</p>
                <div className="flex items-center justify-between gap-2 border-t border-dashed border-line pt-3">
                  <span className="flex min-w-0 items-center gap-2">
                    {actor && <Avatar name={actor.name} role={actor.role} size={24} />}
                    <span className="min-w-0 text-[12.5px] font-semibold leading-tight">
                      <span className="block truncate">{actor?.name ?? s.who}</span>
                      <span className="text-[11px] font-medium text-ink-3">{actor ? roleLabel(actor.role) : ""}</span>
                    </span>
                  </span>
                  <form action={switchUser}>
                    <input type="hidden" name="userId" value={s.userId} />
                    <input type="hidden" name="next" value={s.next} />
                    <button className="btn btn-primary btn-sm" aria-label={`Act as ${s.who}: ${s.title}`}>
                      {s.cta} <Icon name="arrow" size={15} strokeWidth={2} />
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* stats strip */}
      <section aria-label="At a glance" className="card grid grid-cols-4 px-2 py-5">
        {[
          [String(resourceCount), "Resources listed"],
          [String(liveCount), "Active bookings"],
          [String(pendingCount), "Awaiting a manager"],
          ["100%", "Decisions with a reason"],
        ].map(([n, l], i) => (
          <div key={l} className={`text-center ${i < 3 ? "border-r border-line" : ""}`}>
            <div className="font-display text-[28px] font-bold tracking-[-0.02em]">{n}</div>
            <div className="label mt-1">{l}</div>
          </div>
        ))}
      </section>
    </div>
  );
}