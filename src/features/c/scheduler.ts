import { db } from "@/lib/shared/db";
import { now } from "@/lib/shared/clock";
import { notify, notifyResourceStaff } from "@/lib/shared/notify";
import { transitionBooking } from "@/lib/shared/bookingState";
import { logAudit } from "@/lib/shared/audit";
import { FAIRNESS } from "@/lib/shared/types";
import { promoteWaitlist } from "@/features/b/waitlist";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Safe to run many times: every step only acts on a state it then changes, or checks for an existing record. */
export async function runScheduler(): Promise<void> {
  const at = await now();

  // 1. Reminders (once per booking)
  const upcoming = await db.booking.findMany({
    where: { status: "APPROVED", start: { gt: at, lte: new Date(at.getTime() + FAIRNESS.REMINDER_MINUTES_BEFORE * MIN) } },
    include: { resource: true },
  });
  for (const b of upcoming) {
    const link = `/bookings/${b.id}`;
    const sent = await db.notification.findFirst({ where: { userId: b.userId, kind: "REMINDER", link } });
    if (!sent) {
      await notify({ userId: b.userId, kind: "REMINDER", title: "Booking starting soon", body: `Your booking of ${b.resource.name} starts within the hour. Check in when you arrive.`, link });
    }
  }

  // 2. No-shows
  const missed = await db.booking.findMany({
    where: { status: "APPROVED", start: { lte: new Date(at.getTime() - FAIRNESS.NO_SHOW_GRACE_MINUTES * MIN) } },
    include: { resource: true },
  });
  const freed = new Set<string>();
  for (const b of missed) {
    try {
      await transitionBooking({ bookingId: b.id, to: "NO_SHOW", actorId: null, action: "MARKED_NO_SHOW", reason: "Did not check in within the grace period" });
    } catch (e) {
      console.error("Scheduler NO_SHOW error", b.id, e);
      continue;
    }
    const earlier = await db.booking.count({
      where: { userId: b.userId, status: "NO_SHOW", id: { not: b.id }, start: { gte: new Date(at.getTime() - 30 * DAY) } },
    });
    const second = earlier > 0;
    const penalty = await db.penalty.create({
      data: {
        userId: b.userId,
        kind: second ? "SUSPENSION" : "WARNING",
        days: second ? 7 : 0,
        status: "PROPOSED",
        reason: second ? "Second no-show within 30 days (7-day suspension proposed)" : `No-show for ${b.resource.name}`,
      },
    });
    await logAudit({ actorId: null, action: "PENALTY_PROPOSED", entityType: "Penalty", entityId: penalty.id, bookingId: b.id, resourceId: b.resourceId, reason: penalty.reason });
    await notify({ userId: b.userId, kind: "NO_SHOW", title: "Missed booking", body: `You did not check in for ${b.resource.name}. A penalty has been proposed; a manager will decide and you can appeal.`, link: "/penalties" });
    freed.add(b.resourceId);
  }
  for (const resourceId of freed) await promoteWaitlist(resourceId, null);

  // 3. Overdue
  const late = await db.booking.findMany({ where: { status: "CHECKED_IN", end: { lte: at } }, include: { resource: true } });
  for (const b of late) {
    try {
      await transitionBooking({ bookingId: b.id, to: "OVERDUE", actorId: null, action: "MARKED_OVERDUE", reason: "Not returned by the booked end time" });
    } catch (e) {
      console.error("Scheduler OVERDUE error", b.id, e);
      continue;
    }
    let incident = await db.incident.findFirst({ where: { bookingId: b.id, type: "DELAY" } });
    if (!incident) {
      incident = await db.incident.create({
        data: { bookingId: b.id, resourceId: b.resourceId, reporterId: b.resource.ownerId, type: "DELAY", severity: "LOW", description: "Marked overdue automatically by the system." },
      });
      await logAudit({ actorId: null, action: "INCIDENT_REPORTED", entityType: "Incident", entityId: incident.id, bookingId: b.id, resourceId: b.resourceId, reason: "Overdue" });
    }
    const penalty = await db.penalty.create({
      data: { userId: b.userId, incidentId: incident.id, kind: "WARNING", status: "PROPOSED", reason: `Late return of ${b.resource.name}` },
    });
    await logAudit({ actorId: null, action: "PENALTY_PROPOSED", entityType: "Penalty", entityId: penalty.id, bookingId: b.id, resourceId: b.resourceId, reason: penalty.reason });
    await notify({ userId: b.userId, kind: "OVERDUE", title: "Booking overdue", body: `Please return ${b.resource.name} now.`, link: `/bookings/${b.id}` });
    await notifyResourceStaff(b.resource, { kind: "OVERDUE", title: "Resource overdue", body: `${b.resource.name} has not been returned.`, link: `/bookings/${b.id}` });
  }

  // 4. Credential expiry (once per credential)
  const expiring = await db.userCredential.findMany({
    where: { status: "VERIFIED", expiresAt: { gt: at, lte: new Date(at.getTime() + 14 * DAY) } },
    include: { credential: true },
  });
  for (const c of expiring) {
    const link = `/credentials?expiring=${c.id}`;
    const sent = await db.notification.findFirst({ where: { userId: c.userId, kind: "CREDENTIAL", link } });
    if (!sent) {
      await notify({ userId: c.userId, kind: "CREDENTIAL", title: "Credential expiring soon", body: `Your ${c.credential.name} credential expires on ${c.expiresAt!.toDateString()}.`, link });
    }
  }
}
