import { db } from "@/lib/shared/db";
import { now } from "@/lib/shared/clock";

export const PRIORITY_FORMULA =
  "Priority = +2 if this is your first booking of this resource, +1 if you have used under half your monthly quota on it, −1 for each no-show or confirmed penalty in the last 30 days. Higher goes first; ties go to the earlier request.";

const USED_STATUSES = ["APPROVED", "CHECKED_IN", "OVERDUE", "RETURNED", "CLOSED"] as const;

export async function calculatePriorityScore(
  userId: string,
  resourceId: string,
  excludeBookingId?: string,
): Promise<number> {
  const at = await now();
  const since = new Date(at.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(at.getFullYear(), at.getMonth(), 1);

  const [resource, pastCount, monthBookings, noShows, penalties] = await Promise.all([
    db.resource.findUnique({ where: { id: resourceId } }),
    db.booking.count({
      where: {
        userId,
        resourceId,
        id: { not: excludeBookingId },
        status: { in: [...USED_STATUSES] },
      },
    }),
    db.booking.findMany({
      where: {
        userId,
        resourceId,
        id: { not: excludeBookingId },
        start: { gte: startOfMonth },
        status: { in: [...USED_STATUSES] },
      },
    }),
    db.booking.count({ where: { userId, status: "NO_SHOW", start: { gte: since } } }),
    db.penalty.count({ where: { userId, status: "CONFIRMED", createdAt: { gte: since } } }),
  ]);

  if (!resource) return 0;

  let score = 0;
  if (pastCount === 0) score += 2;

  const hoursUsed = monthBookings.reduce((acc, b) => acc + (b.end.getTime() - b.start.getTime()) / 3_600_000, 0);
  if (hoursUsed < resource.monthlyHourQuota / 2) score += 1;

  score -= noShows + penalties;
  return score;
}
