import { db } from "@/lib/shared/db";
import { getCurrentUser, isStaff } from "@/lib/shared/auth";
import { fmtDateTime } from "@/lib/shared/format";
import type { RuleResult } from "@/lib/shared/types";
import { PRIORITY_FORMULA } from "../priority";
import { RevokeAction } from "./ReasonActions";

export async function DecisionPanel({ bookingId }: { bookingId: string }) {
  const [booking, viewer] = await Promise.all([
    db.booking.findUnique({ where: { id: bookingId }, include: { resource: true, decidedBy: true } }),
    getCurrentUser(),
  ]);
  if (!booking) return null;

  const results = (Array.isArray(booking.ruleResults) ? booking.ruleResults : []) as unknown as RuleResult[];

  let position: number | null = null;
  let total = 0;
  if (booking.status === "WAITLISTED") {
    const queue = await db.booking.findMany({
      where: { resourceId: booking.resourceId, status: "WAITLISTED" },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    total = queue.length;
    position = queue.findIndex((b) => b.id === booking.id) + 1;
  }

  // Quota bar (this calendar month of the booking)
  const monthStart = new Date(booking.start.getFullYear(), booking.start.getMonth(), 1);
  const nextMonth = new Date(booking.start.getFullYear(), booking.start.getMonth() + 1, 1);
  const used = await db.booking.findMany({
    where: {
      userId: booking.userId,
      resourceId: booking.resourceId,
      start: { gte: monthStart, lt: nextMonth },
      status: { in: ["APPROVED", "CHECKED_IN", "OVERDUE", "RETURNED", "CLOSED"] },
    },
  });
  const usedHours = used.reduce((a, b) => a + (b.end.getTime() - b.start.getTime()) / 3_600_000, 0);
  const quota = booking.resource.monthlyHourQuota;
  const pct = Math.min(100, Math.round((usedHours / quota) * 100));

  const risk = booking.resource.riskLevel.toLowerCase();
  let summary = booking.decisionReason ?? "No decision yet.";
  switch (booking.status) {
    case "APPROVED":
      summary = booking.autoApproved
        ? `Approved automatically because every check passed and this is a ${risk}-risk item.`
        : `Approved by ${booking.decidedBy?.name ?? "a manager"}.`;
      break;
    case "REQUESTED":
      summary = booking.decisionReason ?? `Waiting for a manager because this ${risk}-risk item needs review.`;
      break;
    case "WAITLISTED":
      summary = `You are #${position} of ${total} on the waitlist.`;
      break;
    case "REJECTED":
      summary = `Rejected${booking.decisionReason ? `: ${booking.decisionReason}` : "."}`;
      break;
    default:
      break;
  }

  return (
    <section className="why">
      <h2 className="mb-2 flex items-center gap-2 font-sans text-[14px] font-bold tracking-normal text-brand-deep">
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg>
        Why this decision?
      </h2>
      <p className="rounded-[10px] border border-brand-line bg-surface px-3 py-2.5 text-[14px] font-medium text-ink">{summary}</p>

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px]">
              <span className={`check-ic ${r.passed ? "" : "fail"}`} aria-hidden>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  {r.passed ? <path d="M20 6 9 17l-5-5" /> : <path d="M18 6 6 18M6 6l12 12" />}
                </svg>
              </span>
              <span className="sr-only">{r.passed ? "Passed:" : "Failed:"}</span>
              <div>
                <span className="font-semibold text-ink">{r.label}</span> <span className="text-ink-2">· {r.detail}</span>
                {!r.passed && r.fix && <p className="font-medium text-brand">Fix: {r.fix}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[.04em] text-ink-3">
        {booking.decidedAt
          ? `Decided ${fmtDateTime(booking.decidedAt)} by ${booking.decidedBy?.name ?? "Automatic, reviewable by a manager"}`
          : "No final decision yet."}
      </p>
      {booking.decidedAt && booking.decisionReason && <p className="reason-q mt-1.5">“{booking.decisionReason}”</p>}

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[12px] text-ink-2">
          <span>Fair-use quota this month</span>
          <span><b className="text-ink">{usedHours}</b> of {quota} hours</span>
        </div>
        <div className="meter-track bg-white"><div className={`meter-fill ${pct >= 100 ? "!bg-bad" : ""}`} style={{ width: `${pct}%` }} /></div>
      </div>

      {booking.status === "WAITLISTED" && (
        <div className="mt-3 rounded-[10px] border border-warn-line bg-warn-bg p-3 text-[13px] text-[#92400E]">
          <p>{PRIORITY_FORMULA}</p>
          <p className="mt-1 font-semibold">Your score: {booking.priorityScore}</p>
        </div>
      )}

      {booking.status === "APPROVED" && viewer && isStaff(viewer) && (
        <div className="mt-4 border-t border-brand-line pt-4"><RevokeAction bookingId={booking.id} /></div>
      )}
    </section>
  );
}