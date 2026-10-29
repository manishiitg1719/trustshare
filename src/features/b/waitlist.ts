import { db, type Tx } from "@/lib/shared/db";
import { evaluateBooking } from "./rules";
import { transitionBooking } from "@/lib/shared/bookingState";
import { notify } from "@/lib/shared/notify";

function isOverlap(err: unknown): boolean {
  return err instanceof Error && err.message.includes("booking_no_overlap");
}

/**
 * Promotes the highest-priority eligible WAITLISTED bookings on this resource whose slot is now free.
 * Low-risk and passing: approved automatically. Otherwise: moved to REQUESTED for a manager.
 */
export async function promoteWaitlist(resourceId: string, actorId: string | null, tx?: Tx): Promise<void> {
  const client = tx ?? db;
  const waitlisted = await client.booking.findMany({
    where: { resourceId, status: "WAITLISTED" },
    orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
  });

  for (const booking of waitlisted) {
    const { outcome, results, priorityScore } = await evaluateBooking({
      userId: booking.userId,
      resourceId,
      start: booking.start,
      end: booking.end,
      excludeBookingId: booking.id,
    });
    const link = `/bookings/${booking.id}`;

    if (outcome === "AUTO_APPROVE") {
      try {
        await transitionBooking(
          {
            bookingId: booking.id,
            to: "APPROVED",
            actorId,
            action: "BOOKING_PROMOTED",
            reason: "Promoted from the waitlist because the slot became free and all checks passed",
            data: { autoApproved: true, ruleResults: JSON.parse(JSON.stringify(results)), priorityScore, decidedAt: new Date() },
          },
          tx,
        );
        await notify(
          { userId: booking.userId, kind: "BOOKING_PROMOTED", title: "You got the slot", body: "Your waitlisted booking has been approved.", link },
          client,
        );
      } catch (err) {
        if (!isOverlap(err)) throw err;
      }
    } else if (outcome === "NEEDS_REVIEW") {
      await transitionBooking(
        {
          bookingId: booking.id,
          to: "REQUESTED",
          actorId,
          action: "BOOKING_PROMOTED",
          reason: "Slot became free; this resource needs a manager to approve it",
          data: { ruleResults: JSON.parse(JSON.stringify(results)), priorityScore },
        },
        tx,
      );
      await notify(
        { userId: booking.userId, kind: "BOOKING_PROMOTED", title: "Your slot opened up", body: "A manager will now review your request.", link },
        client,
      );
    }
    // WAITLIST (still clashing) or REJECT (no longer eligible): leave as is.
  }

  const remaining = await client.booking.findMany({
    where: { resourceId, status: "WAITLISTED" },
    orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
  });
  for (let i = 0; i < remaining.length; i++) {
    await notify(
      {
        userId: remaining[i].userId,
        kind: "BOOKING_WAITLISTED",
        title: "Waitlist position",
        body: `You are now #${i + 1} of ${remaining.length} on the waitlist.`,
        link: `/bookings/${remaining[i].id}`,
        email: false,
      },
      client,
    );
  }
}
