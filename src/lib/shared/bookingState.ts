// SHARED CONTRACT. Do not edit in a part branch.
// The booking state machine. Every status change MUST go through transitionBooking().
import type { BookingStatus, Prisma } from "@prisma/client";
import { db, type Tx } from "./db";
import { logAudit } from "./audit";
import type { AuditActionType } from "./types";

export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED", "WAITLISTED", "CANCELLED"],
  WAITLISTED: ["APPROVED", "REJECTED", "CANCELLED", "REQUESTED"],
  APPROVED: ["CHECKED_IN", "CANCELLED", "NO_SHOW", "REQUESTED"], // REQUESTED = approval revoked by a manager
  REJECTED: ["REQUESTED"], // appeal sends it back for review
  CHECKED_IN: ["RETURNED", "OVERDUE"],
  OVERDUE: ["RETURNED"],
  RETURNED: ["CLOSED", "DISPUTED"],
  DISPUTED: ["CLOSED"],
  CANCELLED: [],
  NO_SHOW: [],
  CLOSED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class TransitionError extends Error {}

export type TransitionInput = {
  bookingId: string;
  to: BookingStatus;
  actorId: string | null; // null = system
  action: AuditActionType;
  reason?: string;
  data?: Prisma.BookingUpdateInput; // extra fields to set, e.g. { checkedInAt }
  meta?: Prisma.InputJsonValue;
};

/** Validates the transition, updates the booking and writes the audit entry in one transaction. */
export async function transitionBooking(input: TransitionInput, tx?: Tx) {
  const run = async (t: Tx) => {
    const booking = await t.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
    if (!canTransition(booking.status, input.to)) {
      throw new TransitionError(`Cannot move booking from ${booking.status} to ${input.to}`);
    }
    const updated = await t.booking.update({
      where: { id: booking.id },
      data: { ...input.data, status: input.to },
    });
    await logAudit(
      {
        actorId: input.actorId,
        action: input.action,
        entityType: "Booking",
        entityId: booking.id,
        bookingId: booking.id,
        resourceId: booking.resourceId,
        reason: input.reason,
        meta: { from: booking.status, to: input.to, ...((input.meta as object) ?? {}) },
      },
      t,
    );
    return updated;
  };
  return tx ? run(tx) : db.$transaction((t) => run(t));
}
