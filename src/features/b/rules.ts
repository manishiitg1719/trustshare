import { db } from "@/lib/shared/db";
import { now } from "@/lib/shared/clock";
import { checkEligibility } from "@/lib/shared/eligibility";
import { calculatePriorityScore } from "./priority";
import { FAIRNESS, ACTIVE_STATUSES, LIVE_STATUSES } from "@/lib/shared/types";
import type { BookingOutcome, RuleResult } from "@/lib/shared/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function hourOf(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

export async function evaluateBooking({
  userId,
  resourceId,
  start,
  end,
  excludeBookingId,
}: {
  userId: string;
  resourceId: string;
  start: Date;
  end: Date;
  excludeBookingId?: string;
}): Promise<{ outcome: BookingOutcome; results: RuleResult[]; priorityScore: number }> {
  const results: RuleResult[] = [];
  const [resource, user, at] = await Promise.all([
    db.resource.findUnique({ where: { id: resourceId } }),
    db.user.findUnique({ where: { id: userId } }),
    now(),
  ]);
  if (!resource || !user) throw new Error("Resource or user not found");

  // 1. Person-level eligibility
  const eligibility = await checkEligibility(userId, resourceId);
  results.push(...eligibility.checks);

  // 2. In future
  const inFuture = start.getTime() > at.getTime();
  results.push({
    rule: "in_future",
    label: "Starts in the future",
    passed: inFuture,
    detail: inFuture ? "The start time is in the future" : "The start time has already passed",
    fix: inFuture ? undefined : "Pick a start time later than now",
    onFail: "REJECT",
  });

  // 3. Opening hours (same day, open day, inside open hours)
  const sameDay = start.toDateString() === end.toDateString();
  const openDays = resource.openDays;
  const withinHours =
    end.getTime() > start.getTime() &&
    sameDay &&
    openDays.includes(start.getDay()) &&
    hourOf(start) >= resource.openHour &&
    hourOf(end) <= resource.closeHour;
  results.push({
    rule: "opening_hours",
    label: "Within opening hours",
    passed: withinHours,
    detail: withinHours
      ? "Falls inside opening hours"
      : `Open ${resource.openHour}:00 to ${resource.closeHour}:00 on open days, and a booking must end the same day`,
    fix: withinHours ? undefined : "Choose a start and end time inside opening hours on an open day",
    onFail: "REJECT",
  });

  // 4. Max duration
  const durationHours = (end.getTime() - start.getTime()) / HOUR;
  const durationOk = durationHours > 0 && durationHours <= resource.maxHoursPerBooking;
  results.push({
    rule: "max_duration",
    label: "Booking length",
    passed: durationOk,
    detail: durationOk
      ? `${durationHours} h requested, at most ${resource.maxHoursPerBooking} h allowed`
      : `${durationHours} h requested, but at most ${resource.maxHoursPerBooking} h is allowed`,
    fix: durationOk ? undefined : `Shorten the booking to ${resource.maxHoursPerBooking} hours or less`,
    onFail: "REJECT",
  });

  // 5. Active cap
  const activeCount = await db.booking.count({
    where: { userId, status: { in: ACTIVE_STATUSES }, id: { not: excludeBookingId } },
  });
  const capOk = activeCount < FAIRNESS.MAX_ACTIVE_BOOKINGS;
  results.push({
    rule: "active_cap",
    label: "Active bookings limit",
    passed: capOk,
    detail: capOk
      ? `You have ${activeCount} of ${FAIRNESS.MAX_ACTIVE_BOOKINGS} active bookings`
      : `${FAIRNESS.MAX_ACTIVE_BOOKINGS} active bookings maximum, and you already have ${activeCount}`,
    fix: capOk ? undefined : "Cancel or finish one of your active bookings first",
    onFail: "REJECT",
  });

  // 6. Monthly quota (calendar month of the requested start)
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const [monthBookings, reductions] = await Promise.all([
    db.booking.findMany({
      where: {
        userId,
        resourceId,
        id: { not: excludeBookingId },
        start: { gte: monthStart, lt: nextMonth },
        status: { in: ["APPROVED", "CHECKED_IN", "OVERDUE", "RETURNED", "CLOSED"] },
      },
    }),
    db.penalty.findMany({ where: { userId, kind: "QUOTA_REDUCTION", status: "CONFIRMED" } }),
  ]);
  const usedHours = monthBookings.reduce((acc, b) => acc + (b.end.getTime() - b.start.getTime()) / HOUR, 0);
  const reduction = reductions.reduce((acc, p) => acc + p.days, 0); // days = hours for QUOTA_REDUCTION
  const quota = Math.max(0, resource.monthlyHourQuota - reduction);
  const quotaOk = usedHours + durationHours <= quota;
  const resets = nextMonth.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const left = Math.max(0, quota - usedHours);
  results.push({
    rule: "monthly_quota",
    label: "Monthly hours quota",
    passed: quotaOk,
    detail: `You have used ${usedHours} of ${quota} hours this month${reduction ? ` (quota reduced by ${reduction} h)` : ""}; this request adds ${durationHours}`,
    fix: quotaOk ? undefined : `Try a slot of ${left} hour(s) or less, or wait until ${resets} when your quota resets`,
    onFail: "REJECT",
  });

  // 7. Cooldown
  let cooldownOk = true;
  let cooldownDetail = resource.cooldownDays === 0 ? "No cooldown on this resource" : "Cooldown period is clear";
  let cooldownFix: string | undefined;
  if (resource.cooldownDays > 0) {
    const last = await db.booking.findFirst({
      where: {
        userId,
        resourceId,
        id: { not: excludeBookingId },
        status: { in: ["APPROVED", "CHECKED_IN", "OVERDUE", "RETURNED", "CLOSED"] },
        end: { lte: start },
      },
      orderBy: { end: "desc" },
    });
    if (last) {
      const gapDays = (start.getTime() - last.end.getTime()) / DAY;
      if (gapDays < resource.cooldownDays) {
        cooldownOk = false;
        const earliest = new Date(last.end.getTime() + resource.cooldownDays * DAY);
        cooldownDetail = `Your last booking ended ${gapDays.toFixed(1)} days before this one; ${resource.cooldownDays} days are required`;
        cooldownFix = `Choose a start on or after ${earliest.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      }
    }
  }
  results.push({
    rule: "cooldown",
    label: "Cooldown between bookings",
    passed: cooldownOk,
    detail: cooldownDetail,
    fix: cooldownFix,
    onFail: "REJECT",
  });

  // 8. No clash
  const clash = await db.booking.findFirst({
    where: {
      resourceId,
      status: { in: LIVE_STATUSES },
      id: { not: excludeBookingId },
      start: { lt: end },
      end: { gt: start },
    },
  });
  results.push({
    rule: "no_clash",
    label: "Slot is free",
    passed: !clash,
    detail: clash ? "Someone else already holds this slot" : "Nobody else has this slot",
    fix: clash ? "Pick one of the suggested slots, or join the waitlist by submitting anyway" : undefined,
    onFail: "WAITLIST",
  });

  // 9. Risk tier
  const external = user.userType === "EXTERNAL";
  const riskOk =
    resource.riskLevel === "LOW" ||
    (resource.riskLevel === "MEDIUM" && !external);
  results.push({
    rule: "risk_tier",
    label: "Risk level",
    passed: riskOk,
    detail: riskOk
      ? `${resource.riskLevel.toLowerCase()}-risk item, can be approved automatically`
      : resource.riskLevel === "HIGH"
        ? "High-risk item, a manager must approve it"
        : "External users need manager approval for medium-risk items",
    onFail: "REVIEW",
  });

  // 10. Supervisor
  if (resource.requiresSupervisor) {
    results.push({
      rule: "supervisor",
      label: "Supervisor required",
      passed: false,
      detail: "A manager must assign a supervisor for this resource",
      onFail: "REVIEW",
    });
  }

  let outcome: BookingOutcome = "AUTO_APPROVE";
  if (results.some((r) => !r.passed && r.onFail === "REJECT")) outcome = "REJECT";
  else if (results.some((r) => !r.passed && r.onFail === "WAITLIST")) outcome = "WAITLIST";
  else if (results.some((r) => !r.passed && r.onFail === "REVIEW")) outcome = "NEEDS_REVIEW";

  const priorityScore = await calculatePriorityScore(userId, resourceId, excludeBookingId);
  return { outcome, results, priorityScore };
}
