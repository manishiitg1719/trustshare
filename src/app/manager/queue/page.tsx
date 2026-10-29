import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { StatusBadge } from "@/lib/shared/StatusBadge";
import { fmtDateTime } from "@/lib/shared/format";
import type { RuleResult } from "@/lib/shared/types";
import { ReviewActions } from "@/features/b/components/ReasonActions";
import { Avatar, Icon, PageHead, RiskBadge } from "@/components/ui";

const RISK_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export default async function ManagerQueue() {
  await requireUser(["MANAGER", "ADMIN"]);

  const [requests, supervisors] = await Promise.all([
    db.booking.findMany({
      where: { status: "REQUESTED" },
      include: { user: { include: { credentials: { include: { credential: true } } } }, resource: true },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({ where: { OR: [{ role: "MANAGER" }, { userType: "STAFF" }] }, select: { id: true, name: true } }),
  ]);
  // Risk first (HIGH, MEDIUM, LOW), then oldest first (the DB order above is already oldest first).
  requests.sort((a, b) => RISK_ORDER[a.resource.riskLevel] - RISK_ORDER[b.resource.riskLevel]);
  const highCount = requests.filter((r) => r.resource.riskLevel === "HIGH").length;

  return (
    <div>
      <PageHead
        title="Manager queue"
        sub="Only what a human should decide. Low-risk bookings were already auto-approved — everything risky or borderline lands here."
        right={
          <>
            <span className="chip chip-active">{requests.length} pending</span>
            <span className="chip">{highCount} high risk</span>
          </>
        }
      />
      <h2 className="label mb-3 !font-mono !tracking-[.14em]">Needs review ({requests.length})</h2>
      <div className="space-y-5">
        {requests.map((req) => {
          const results = (Array.isArray(req.ruleResults) ? req.ruleResults : []) as unknown as RuleResult[];
          const passed = results.filter((r) => r.passed).length;
          return (
            <article key={req.id} className="card grid grid-cols-[1fr_360px] overflow-hidden">
              <div className="min-w-0">
                <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-[22px] py-4">
                  <Avatar name={req.user.name} role={req.user.role} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">
                      {req.user.name} <span className="font-medium text-ink-3">· {req.user.userType.charAt(0) + req.user.userType.slice(1).toLowerCase()}</span>
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-[.06em] text-ink-3">
                      Request #{req.id.slice(-6).toUpperCase()} · lodged {fmtDateTime(req.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="space-y-4 px-[22px] py-5">
                  <div className="flex items-center gap-3.5">
                    {req.resource.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={req.resource.photoUrl} alt="" className="h-14 w-[74px] rounded-[10px] border border-line object-cover" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 text-[16px] font-semibold">
                        {req.resource.name} <RiskBadge level={req.resource.riskLevel} />
                      </div>
                      <div className="mt-0.5 font-mono text-[11.5px] uppercase text-ink-3">
                        {fmtDateTime(req.start)} → {fmtDateTime(req.end)} · {req.resource.location}
                      </div>
                    </div>
                  </div>

                  <p className="text-[13.5px] text-ink-2"><strong className="text-ink">Purpose:</strong> {req.purpose}</p>
                  {req.decisionReason && <p className="reason-q">{req.decisionReason}</p>}

                  {results.length > 0 && (
                    <div>
                      <div className="label mb-2.5">Automatic checks · {passed} of {results.length} passed</div>
                      <ul className="grid grid-cols-2 gap-x-5 gap-y-2">
                        {results.map((r, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-[13px] text-ink-2">
                            <span className={`check-ic ${r.passed ? "" : "fail"}`} aria-hidden>
                              <Icon name={r.passed ? "check" : "x"} size={12} strokeWidth={2.6} />
                            </span>
                            <span className="sr-only">{r.passed ? "Passed:" : "Failed:"}</span>
                            <span><b className="font-semibold text-ink">{r.label}</b> · {r.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="font-mono text-[11px] text-ink-3">
                    CREDENTIALS: {req.user.credentials.map((c) => `${c.credential.name} (${c.status.toLowerCase()})`).join(", ") || "none"}
                  </p>

                  {req.resource.riskLevel !== "LOW" && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-warn-line bg-warn-bg px-3.5 py-2.5 text-[13px] text-[#92400E]">
                      <Icon name="shield" />
                      <span>
                        <b>{req.resource.riskLevel === "HIGH" ? "High-risk item." : "Medium-risk item."}</b> Your approval{req.resource.requiresSupervisor ? " — and a named supervisor —" : ""} is required before this request is confirmed.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-l border-line border-t-[3px] border-t-brand bg-surface p-[22px]">
                <h3 className="mb-1 flex items-center gap-2 font-display text-[17px] font-semibold">
                  <Icon name="scale" className="text-brand-deep" /> Decide — always with a reason
                </h3>
                <p className="mb-3.5 text-[12.5px] text-ink-2">The reason is shown to {req.user.name.split(" ")[0]} in the &quot;Why this decision?&quot; panel and stored permanently in the history.</p>
                <ReviewActions bookingId={req.id} supervisors={req.resource.requiresSupervisor ? supervisors : undefined} />
              </div>
            </article>
          );
        })}
        {requests.length === 0 && (
          <div className="card card-pad flex items-center gap-3 text-ink-2">
            <span className="check-ic"><Icon name="check" size={12} strokeWidth={2.6} /></span> No pending requests. Everything is decided.
          </div>
        )}
      </div>
    </div>
  );
}