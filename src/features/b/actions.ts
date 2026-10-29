"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/shared/db";
import { evaluateBooking } from "./rules";
import { transitionBooking } from "@/lib/shared/bookingState";
import { promoteWaitlist } from "./waitlist";
import { requireUser, canManageResource, isStaff } from "@/lib/shared/auth";
import { notify, notifyResourceStaff } from "@/lib/shared/notify";
import { logAudit } from "@/lib/shared/audit";
import { now } from "@/lib/shared/clock";
import { LIVE_STATUSES } from "@/lib/shared/types";
import type { RuleResult } from "@/lib/shared/types";

type Result = { ok: boolean; message: string };

const toJson = (r: RuleResult[]) => JSON.parse(JSON.stringify(r)) as Prisma.InputJsonValue;
const isOverlap = (e: unknown) => e instanceof Error && e.message.includes("booking_no_overlap");

export async function preCheckBooking(data: { resourceId: string; start: string; end: string }) {
  const user = await requireUser();
  const start = new Date(data.start);
  const end = new Date(data.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return evaluateBooking({ userId: user.id, resourceId: data.resourceId, start, end });
}

export async function createBooking(data: {
  resourceId: string;
  start: string;
  end: string;
  purpose: string;
}): Promise<{ ok: boolean; message: string; bookingId?: string; results?: RuleResult[] }> {
  const user = await requireUser();
  const start = new Date(data.start);
  const end = new Date(data.end);
  const purpose = data.purpose.trim();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ok: false, message: "Choose a valid start and end time." };
  if (purpose.length < 10) return { ok: false, message: "Purpose must be at least 10 characters." };

  // Always re-run the rules on the server.
  const { outcome, results, priorityScore } = await evaluateBooking({
    userId: user.id,
    resourceId: data.resourceId,
    start,
    end,
  });

  if (outcome === "REJECT") {
    return { ok: false, message: "This request breaks one or more rules.", results };
  }

  const resource = await db.resource.findUniqueOrThrow({ where: { id: data.resourceId } });

  const booking = await db.booking.create({
    data: {
      userId: user.id,
      resourceId: data.resourceId,
      start,
      end,
      purpose,
      status: "REQUESTED",
      priorityScore,
      ruleResults: toJson(results),
    },
  });
  await logAudit({
    actorId: user.id,
    action: "BOOKING_REQUESTED",
    entityType: "Booking",
    entityId: booking.id,
    bookingId: booking.id,
    resourceId: resource.id,
    reason: purpose,
  });
  const link = `/bookings/${booking.id}`;

  const waitlist = async (reason: string) => {
    const ahead = await db.booking.count({
      where: {
        resourceId: resource.id,
        status: "WAITLISTED",
        id: { not: booking.id },
        OR: [{ priorityScore: { gt: priorityScore } }, { priorityScore, createdAt: { lt: booking.createdAt } }],
      },
    });
    const position = ahead + 1;
    const why = `${reason} You are #${position} on the waitlist.`;
    await transitionBooking({
      bookingId: booking.id,
      to: "WAITLISTED",
      actorId: null,
      action: "BOOKING_WAITLISTED",
      reason: why,
      data: { decisionReason: why, decidedAt: new Date() },
    });
    await notify({ userId: user.id, kind: "BOOKING_WAITLISTED", title: "You are on the waitlist", body: why, link });
    return `You are #${position} on the waitlist.`;
  };

  let message = "";
  if (outcome === "AUTO_APPROVE") {
    const reason = `All checks passed; ${resource.riskLevel.toLowerCase()}-risk item approved automatically`;
    try {
      await transitionBooking({
        bookingId: booking.id,
        to: "APPROVED",
        actorId: null,
        action: "BOOKING_AUTO_APPROVED",
        reason,
        data: { autoApproved: true, decisionReason: reason, decidedAt: new Date() },
      });
      await notify({ userId: user.id, kind: "BOOKING_APPROVED", title: "Booking approved", body: reason, link });
      message = "Approved automatically.";
    } catch (err) {
      if (!isOverlap(err)) throw err;
      message = await waitlist("Someone booked this slot at the same moment.");
    }
  } else if (outcome === "WAITLIST") {
    message = await waitlist("This slot is already taken.");
  } else {
    const failed = results.filter((r) => !r.passed && r.onFail === "REVIEW").map((r) => r.detail);
    const reason = `Needs a manager because: ${failed.join("; ")}`;
    await db.booking.update({ where: { id: booking.id }, data: { decisionReason: reason } });
    await notify({ userId: user.id, kind: "NEW_REQUEST", title: "Waiting for a manager", body: reason, link });
    await notifyResourceStaff(resource, {
      kind: "NEW_REQUEST",
      title: `New request: ${resource.name}`,
      body: `${user.name} needs approval. ${reason}`,
      link: "/manager/queue",
    });
    message = "Sent to a manager for review.";
  }

  revalidatePath("/bookings");
  revalidatePath("/manager/queue");
  return { ok: true, message, bookingId: booking.id };
}

export async function approveBooking(bookingId: string, reason: string, supervisorId?: string): Promise<Result> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  if (reason.trim().length < 5) return { ok: false, message: "Please give a reason (at least 5 characters)." };

  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } });
  if (!booking) return { ok: false, message: "Booking not found." };
  if (booking.resource.requiresSupervisor && !supervisorId) {
    return { ok: false, message: "Choose a supervisor for this resource." };
  }
  if (supervisorId) {
    const sup = await db.user.findUnique({ where: { id: supervisorId } });
    if (!sup || (sup.role !== "MANAGER" && sup.userType !== "STAFF")) {
      return { ok: false, message: "The supervisor must be a manager or a staff member." };
    }
  }

  const clash = await db.booking.findFirst({
    where: { resourceId: booking.resourceId, id: { not: booking.id }, status: { in: LIVE_STATUSES }, start: { lt: booking.end }, end: { gt: booking.start } },
  });
  if (clash) return { ok: false, message: "Another approved booking now overlaps this slot. Waitlist or reject instead." };

  try {
    await transitionBooking({
      bookingId,
      to: "APPROVED",
      actorId: user.id,
      action: "BOOKING_APPROVED",
      reason,
      data: {
        decisionReason: reason,
        decidedAt: new Date(),
        decidedBy: { connect: { id: user.id } },
        autoApproved: false,
        ...(supervisorId ? { supervisor: { connect: { id: supervisorId } } } : {}),
      },
    });
  } catch (err) {
    if (isOverlap(err)) return { ok: false, message: "That slot was just taken by another booking." };
    return { ok: false, message: err instanceof Error ? err.message : "Could not approve." };
  }
  await notify({ userId: booking.userId, kind: "BOOKING_APPROVED", title: "Booking approved", body: `Manager note: ${reason}`, link: `/bookings/${bookingId}` });
  revalidatePath("/manager/queue");
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Approved." };
}

export async function rejectBooking(bookingId: string, reason: string): Promise<Result> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  if (reason.trim().length < 5) return { ok: false, message: "Please give a reason (at least 5 characters)." };
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, message: "Booking not found." };
  try {
    await transitionBooking({
      bookingId,
      to: "REJECTED",
      actorId: user.id,
      action: "BOOKING_REJECTED",
      reason,
      data: { decisionReason: reason, decidedAt: new Date(), decidedBy: { connect: { id: user.id } } },
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reject." };
  }
  await notify({ userId: booking.userId, kind: "BOOKING_REJECTED", title: "Booking rejected", body: `Manager note: ${reason}`, link: `/bookings/${bookingId}` });
  await promoteWaitlist(booking.resourceId, user.id);
  revalidatePath("/manager/queue");
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Rejected." };
}

export async function waitlistBooking(bookingId: string, reason: string): Promise<Result> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  if (reason.trim().length < 5) return { ok: false, message: "Please give a reason (at least 5 characters)." };
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, message: "Booking not found." };
  try {
    await transitionBooking({
      bookingId,
      to: "WAITLISTED",
      actorId: user.id,
      action: "BOOKING_WAITLISTED",
      reason,
      data: { decisionReason: reason, decidedAt: new Date(), decidedBy: { connect: { id: user.id } } },
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not waitlist." };
  }
  await notify({ userId: booking.userId, kind: "BOOKING_WAITLISTED", title: "Booking waitlisted", body: `Manager note: ${reason}`, link: `/bookings/${bookingId}` });
  revalidatePath("/manager/queue");
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Waitlisted." };
}

export async function cancelBooking(bookingId: string, reason: string): Promise<Result> {
  const user = await requireUser();
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } });
  if (!booking) return { ok: false, message: "Booking not found." };

  const staff = isStaff(user) || canManageResource(user, booking.resource);
  if (booking.userId !== user.id && !staff) return { ok: false, message: "You cannot cancel this booking." };
  if (staff && reason.trim().length < 5) return { ok: false, message: "Please give a reason (at least 5 characters)." };

  if (!staff) {
    if (booking.start.getTime() <= (await now()).getTime()) {
      return { ok: false, message: "You can only cancel before the booking starts." };
    }
  }

  const why = reason.trim() || "Cancelled by the user";
  try {
    await transitionBooking({ bookingId, to: "CANCELLED", actorId: user.id, action: "BOOKING_CANCELLED", reason: why });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not cancel." };
  }
  if (booking.userId !== user.id) {
    await notify({ userId: booking.userId, kind: "BOOKING_CANCELLED", title: "Booking cancelled", body: why, link: `/bookings/${bookingId}` });
  }
  await promoteWaitlist(booking.resourceId, user.id);
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Cancelled." };
}

export async function revokeAutoApproval(bookingId: string, reason: string): Promise<Result> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  if (reason.trim().length < 5) return { ok: false, message: "Please give a reason (at least 5 characters)." };
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, message: "Booking not found." };
  try {
    await transitionBooking({
      bookingId,
      to: "REQUESTED",
      actorId: user.id,
      action: "BOOKING_APPROVAL_REVOKED",
      reason,
      data: { decisionReason: `Approval revoked: ${reason}`, autoApproved: false },
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not revoke." };
  }
  await notify({ userId: booking.userId, kind: "BOOKING_REJECTED", title: "Approval revoked", body: `A manager revoked the approval: ${reason}`, link: `/bookings/${bookingId}` });
  revalidatePath("/manager/queue");
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Approval revoked. The request is back in the queue." };
}

export async function appealBooking(bookingId: string, text: string): Promise<Result> {
  const user = await requireUser();
  if (text.trim().length < 10) return { ok: false, message: "Please explain your appeal (at least 10 characters)." };
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } });
  if (!booking || booking.userId !== user.id) return { ok: false, message: "You cannot appeal this booking." };
  try {
    await transitionBooking({ bookingId, to: "REQUESTED", actorId: user.id, action: "BOOKING_APPEALED", reason: text.trim() });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not appeal." };
  }
  await notifyResourceStaff(booking.resource, {
    kind: "NEW_REQUEST",
    title: "Appeal received",
    body: `${user.name} appealed a rejection: ${text.trim()}`,
    link: "/manager/queue",
  });
  revalidatePath("/bookings");
  revalidatePath("/manager/queue");
  return { ok: true, message: "Appeal sent to the manager queue." };
}
