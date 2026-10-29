"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, PenaltyKind, IncidentType, Severity } from "@prisma/client";
import { db } from "@/lib/shared/db";
import { requireUser, canManageResource } from "@/lib/shared/auth";
import { transitionBooking } from "@/lib/shared/bookingState";
import { now, advanceClock, resetClock } from "@/lib/shared/clock";
import { logAudit } from "@/lib/shared/audit";
import { notify, notifyResourceStaff } from "@/lib/shared/notify";
import { FAIRNESS } from "@/lib/shared/types";
import type { ChecklistEntry } from "@/lib/shared/types";
import { runScheduler } from "./scheduler";

export type Res = { ok: boolean; message: string; id?: string };
const fail = (message: string): Res => ({ ok: false, message });
const DAY = 24 * 60 * 60 * 1000;
const asJson = (v: unknown) => v as Prisma.InputJsonValue;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

type ReportInput = { items: ChecklistEntry[]; photos: string[]; notes: string };

function cleanReport(input: ReportInput): ReportInput {
  return {
    items: input.items.map((i) => ({ item: i.item, ok: !!i.ok, ...(i.note ? { note: i.note } : {}) })),
    photos: input.photos.slice(0, 4),
    notes: input.notes.trim(),
  };
}

// ---------------------------------------------------------------- C1 check-in
export async function processCheckIn(
  bookingId: string,
  input: ReportInput & { supervisorPresent?: boolean },
): Promise<Res> {
  const user = await requireUser();
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } });
  if (!booking) return fail("Booking not found.");

  const isSupervisor = booking.supervisorId === user.id;
  if (booking.userId !== user.id && !isSupervisor) return fail("Only the person who booked can check in.");
  if (booking.status !== "APPROVED") return fail("This booking is not waiting for check-in.");

  const at = await now();
  const opens = new Date(booking.start.getTime() - 15 * 60_000);
  const deadline = new Date(booking.start.getTime() + FAIRNESS.NO_SHOW_GRACE_MINUTES * 60_000);
  if (at < opens) return fail("Check-in opens 15 minutes before the start time.");
  if (at > deadline) return fail("The check-in deadline has passed.");

  if (booking.resource.requiresSupervisor) {
    if (!booking.supervisorId) return fail("No supervisor has been assigned yet. Ask a manager.");
    if (!isSupervisor && !input.supervisorPresent) return fail("The supervisor must confirm they are present.");
  }

  const report = cleanReport(input);
  if (report.items.length !== booking.resource.checklist.length) return fail("Answer every checklist item.");
  const problems = report.items.filter((i) => !i.ok);

  try {
    await db.$transaction(async (tx) => {
      await tx.conditionReport.create({
        data: { bookingId, phase: "CHECK_IN", items: asJson(report.items), notes: report.notes, photos: report.photos, createdById: user.id },
      });
      await transitionBooking(
        {
          bookingId,
          to: "CHECKED_IN",
          actorId: user.id,
          action: "CHECKED_IN",
          reason: problems.length ? `Checked in with ${problems.length} checklist problem(s)` : "Checked in, all items OK",
          data: { checkedInAt: at },
        },
        tx,
      );
      if (problems.length) {
        const inc = await tx.incident.create({
          data: {
            bookingId,
            resourceId: booking.resourceId,
            reporterId: user.id,
            type: "DAMAGE",
            severity: "LOW",
            description: `Found at check-in: ${problems.map((p) => p.item + (p.note ? ` (${p.note})` : "")).join(", ")}`,
            photos: report.photos,
          },
        });
        await logAudit(
          { actorId: user.id, action: "INCIDENT_REPORTED", entityType: "Incident", entityId: inc.id, bookingId, resourceId: booking.resourceId, reason: "Found at check-in" },
          tx,
        );
        await notifyResourceStaff(booking.resource, { kind: "INCIDENT", title: "Problem found at check-in", body: `${booking.resource.name}: ${problems.length} item(s) not OK.`, link: `/incidents/${inc.id}` }, tx);
      }
    });
  } catch (e) {
    return fail(errMsg(e));
  }
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Checked in." };
}

// ------------------------------------------------------------------ C2 return
export async function processReturn(
  bookingId: string,
  input: ReportInput & { damageDescription?: string },
): Promise<Res> {
  const user = await requireUser();
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { resource: true, conditionReports: true },
  });
  if (!booking) return fail("Booking not found.");
  if (booking.userId !== user.id && !canManageResource(user, booking.resource)) return fail("You cannot return this booking.");
  if (booking.status !== "CHECKED_IN" && booking.status !== "OVERDUE") return fail("This booking is not in use.");

  const report = cleanReport(input);
  if (report.items.length !== booking.resource.checklist.length) return fail("Answer every checklist item.");
  const failed = report.items.filter((i) => !i.ok);

  const before = booking.conditionReports.find((r) => r.phase === "CHECK_IN");
  const beforeItems = (before?.items ?? []) as unknown as ChecklistEntry[];
  const changed = report.items.filter((i) => !i.ok && beforeItems.find((b) => b.item === i.item)?.ok);
  if (changed.length && (input.damageDescription ?? "").trim().length < 5) {
    return fail("Please describe what happened to the item(s) that changed.");
  }

  const at = await now();
  try {
    await db.$transaction(async (tx) => {
      await tx.conditionReport.create({
        data: { bookingId, phase: "RETURN", items: asJson(report.items), notes: report.notes, photos: report.photos, createdById: user.id },
      });
      await transitionBooking(
        { bookingId, to: "RETURNED", actorId: user.id, action: "RETURNED", reason: `${failed.length} checklist items failed`, data: { returnedAt: at } },
        tx,
      );
      if (changed.length) {
        const inc = await tx.incident.create({
          data: {
            bookingId,
            resourceId: booking.resourceId,
            reporterId: user.id,
            type: "DAMAGE",
            severity: "MEDIUM",
            description: `${input.damageDescription!.trim()} (changed since check-in: ${changed.map((c) => c.item).join(", ")})`,
            photos: report.photos,
          },
        });
        await logAudit({ actorId: user.id, action: "INCIDENT_REPORTED", entityType: "Incident", entityId: inc.id, bookingId, resourceId: booking.resourceId, reason: "Damage found at return" }, tx);
        await notifyResourceStaff(booking.resource, { kind: "INCIDENT", title: "Damage reported at return", body: `${booking.resource.name} came back with ${changed.length} item(s) changed.`, link: `/incidents/${inc.id}` }, tx);
      }
      if (at > booking.end) {
        const existing = await tx.incident.findFirst({ where: { bookingId, type: "DELAY" } });
        if (!existing) {
          const inc = await tx.incident.create({
            data: { bookingId, resourceId: booking.resourceId, reporterId: user.id, type: "DELAY", severity: "LOW", description: "Returned after the booked end time." },
          });
          await logAudit({ actorId: user.id, action: "INCIDENT_REPORTED", entityType: "Incident", entityId: inc.id, bookingId, resourceId: booking.resourceId, reason: "Late return" }, tx);
        }
      }
    });
  } catch (e) {
    return fail(errMsg(e));
  }
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Returned. Thank you." };
}

// ------------------------------------------------------- C4 closing, disputes
async function loadForReview(bookingId: string) {
  const user = await requireUser();
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } });
  return { user, booking };
}

export async function closeBookingAction(bookingId: string): Promise<Res> {
  const { user, booking } = await loadForReview(bookingId);
  if (!booking) return fail("Booking not found.");
  if (!canManageResource(user, booking.resource)) return fail("Only a manager or the owner can close a booking.");
  try {
    await transitionBooking({ bookingId, to: "CLOSED", actorId: user.id, action: "BOOKING_CLOSED", reason: "Reviewed, no issues" });
  } catch (e) {
    return fail(errMsg(e));
  }
  await notify({ userId: booking.userId, kind: "BOOKING_CANCELLED", title: "Booking closed", body: `Your booking of ${booking.resource.name} was reviewed and closed with no issues.`, link: `/bookings/${bookingId}`, email: false });
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Booking closed." };
}

export async function disputeBookingAction(bookingId: string, explanation: string): Promise<Res> {
  const { user, booking } = await loadForReview(bookingId);
  if (!booking || booking.userId !== user.id) return fail("You can only dispute your own booking.");
  if (explanation.trim().length < 10) return fail("Please explain your side (at least 10 characters).");
  try {
    await transitionBooking({ bookingId, to: "DISPUTED", actorId: user.id, action: "BOOKING_DISPUTED", reason: explanation.trim() });
  } catch (e) {
    return fail(errMsg(e));
  }
  await notifyResourceStaff(booking.resource, { kind: "INCIDENT", title: "Damage finding disputed", body: `${user.name} disputes the finding on ${booking.resource.name}.`, link: `/bookings/${bookingId}` });
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: "Dispute sent to a manager." };
}

export async function resolveDisputeAction(bookingId: string, note: string, outcome: "UPHOLD_FINDING" | "OVERTURN_FINDING"): Promise<Res> {
  const { user, booking } = await loadForReview(bookingId);
  if (!booking) return fail("Booking not found.");
  if (!canManageResource(user, booking.resource)) return fail("Only a manager or the owner can resolve a dispute.");
  if (note.trim().length < 5) return fail("Please add a resolution note (at least 5 characters).");

  const penalties = await db.penalty.findMany({
    where: { incident: { bookingId }, status: { in: ["PROPOSED", "CONFIRMED", "APPEALED"] } },
  });
  const at = await now();
  try {
    await db.$transaction(async (tx) => {
      await transitionBooking(
        { bookingId, to: "CLOSED", actorId: user.id, action: "BOOKING_CLOSED", reason: `Dispute resolved (${outcome === "UPHOLD_FINDING" ? "finding upheld" : "finding overturned"}): ${note.trim()}` },
        tx,
      );
      for (const p of penalties) {
        if (outcome === "UPHOLD_FINDING") {
          if (p.status === "CONFIRMED") continue;
          await tx.penalty.update({
            where: { id: p.id },
            data: { status: "CONFIRMED", startsAt: p.startsAt ?? at, endsAt: p.kind === "SUSPENSION" ? new Date(at.getTime() + p.days * DAY) : p.endsAt, decidedById: user.id, decisionNote: note.trim() },
          });
          await logAudit({ actorId: user.id, action: "PENALTY_CONFIRMED", entityType: "Penalty", entityId: p.id, bookingId, reason: note.trim() }, tx);
        } else {
          const to = p.status === "PROPOSED" ? "DISMISSED" : "OVERTURNED";
          await tx.penalty.update({ where: { id: p.id }, data: { status: to, decidedById: user.id, decisionNote: note.trim() } });
          await logAudit({ actorId: user.id, action: to === "DISMISSED" ? "PENALTY_DISMISSED" : "PENALTY_OVERTURNED", entityType: "Penalty", entityId: p.id, bookingId, reason: note.trim() }, tx);
        }
        await notify({ userId: p.userId, kind: "PENALTY", title: "Penalty updated after dispute", body: note.trim(), link: "/penalties" }, tx);
      }
    });
  } catch (e) {
    return fail(errMsg(e));
  }
  await notify({ userId: booking.userId, kind: "BOOKING_CANCELLED", title: "Dispute resolved", body: note.trim(), link: `/bookings/${bookingId}` });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/penalties");
  return { ok: true, message: "Dispute resolved." };
}

// ------------------------------------------------------------- C5 incidents
export async function createIncident(data: {
  bookingId?: string;
  resourceId?: string;
  type: IncidentType;
  severity: Severity;
  description: string;
  photos: string[];
}): Promise<Res> {
  const user = await requireUser();
  if (data.description.trim().length < 10) return fail("Please describe what happened (at least 10 characters).");

  let resourceId = data.resourceId;
  let bookingId: string | undefined = data.bookingId || undefined;
  if (bookingId) {
    const b = await db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } });
    if (!b) return fail("Booking not found.");
    if (b.userId !== user.id && !canManageResource(user, b.resource)) return fail("You are not involved in that booking.");
    resourceId = b.resourceId;
  }
  if (!resourceId) return fail("Choose a booking or a resource.");
  const resource = await db.resource.findUnique({ where: { id: resourceId } });
  if (!resource) return fail("Resource not found.");
  bookingId = bookingId || undefined;

  const incident = await db.incident.create({
    data: {
      bookingId,
      resourceId,
      reporterId: user.id,
      type: data.type,
      severity: data.severity,
      description: data.description.trim(),
      photos: data.photos.slice(0, 4),
    },
  });
  await logAudit({ actorId: user.id, action: "INCIDENT_REPORTED", entityType: "Incident", entityId: incident.id, bookingId, resourceId, reason: data.description.trim() });
  await notifyResourceStaff(resource, { kind: "INCIDENT", title: `Incident: ${data.type} on ${resource.name}`, body: `${user.name} reported a ${data.severity.toLowerCase()} severity incident.`, link: `/incidents/${incident.id}` });
  revalidatePath("/manager/incidents");
  return { ok: true, message: "Incident reported.", id: incident.id };
}

async function loadIncidentForStaff(id: string) {
  const user = await requireUser();
  const incident = await db.incident.findUnique({ where: { id }, include: { resource: true, booking: true } });
  if (!incident) return { user, incident: null, allowed: false };
  return { user, incident, allowed: canManageResource(user, incident.resource) };
}

async function closeIncident(id: string, note: string, status: "RESOLVED" | "DISMISSED"): Promise<Res> {
  const { user, incident, allowed } = await loadIncidentForStaff(id);
  if (!incident) return fail("Incident not found.");
  if (!allowed) return fail("Only staff can do this.");
  if (note.trim().length < 5) return fail("Please add a note (at least 5 characters).");
  if (incident.status !== "OPEN") return fail("This incident is already closed.");
  await db.incident.update({ where: { id }, data: { status, resolutionNote: note.trim(), resolvedById: user.id } });
  await logAudit({ actorId: user.id, action: status === "RESOLVED" ? "INCIDENT_RESOLVED" : "INCIDENT_DISMISSED", entityType: "Incident", entityId: id, bookingId: incident.bookingId ?? undefined, resourceId: incident.resourceId, reason: note.trim() });
  await notify({ userId: incident.reporterId, kind: "INCIDENT", title: `Incident ${status.toLowerCase()}`, body: note.trim(), link: `/incidents/${id}` });
  revalidatePath(`/incidents/${id}`);
  revalidatePath("/manager/incidents");
  return { ok: true, message: status === "RESOLVED" ? "Incident resolved." : "Incident dismissed." };
}
export async function resolveIncident(id: string, note: string) { return closeIncident(id, note, "RESOLVED"); }
export async function dismissIncident(id: string, note: string) { return closeIncident(id, note, "DISMISSED"); }

export async function setResourceService(incidentId: string, outOfService: boolean, note: string): Promise<Res> {
  const { user, incident, allowed } = await loadIncidentForStaff(incidentId);
  if (!incident) return fail("Incident not found.");
  if (!allowed) return fail("Only staff can do this.");
  if (note.trim().length < 5) return fail("Please add a note (at least 5 characters).");
  const resource = incident.resource;
  const at = await now();

  if (!outOfService) {
    await db.resource.update({ where: { id: resource.id }, data: { status: "ACTIVE" } });
    await logAudit({ actorId: user.id, action: "RESOURCE_RESTORED", entityType: "Resource", entityId: resource.id, resourceId: resource.id, reason: note.trim() });
    revalidatePath(`/incidents/${incidentId}`);
    return { ok: true, message: `${resource.name} is back in service.` };
  }

  await db.resource.update({ where: { id: resource.id }, data: { status: "OUT_OF_SERVICE" } });
  await logAudit({ actorId: user.id, action: "RESOURCE_OUT_OF_SERVICE", entityType: "Resource", entityId: resource.id, resourceId: resource.id, reason: note.trim() });

  const upcoming = await db.booking.findMany({
    where: { resourceId: resource.id, status: { in: ["APPROVED", "REQUESTED", "WAITLISTED"] }, end: { gt: at } },
  });
  let cancelled = 0;
  for (const b of upcoming) {
    try {
      await transitionBooking({ bookingId: b.id, to: "CANCELLED", actorId: user.id, action: "BOOKING_CANCELLED", reason: "Resource out of service after incident" });
      await notify({
        userId: b.userId,
        kind: "RESOURCE_OUT_OF_SERVICE",
        title: `${resource.name} is out of service`,
        body: "Your booking was cancelled because the resource is out of service after an incident. You can look for a similar resource.",
        link: `/resources?type=${resource.type}`,
      });
      cancelled++;
    } catch (e) {
      console.error("Could not cancel booking", b.id, e);
    }
  }
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/manager/incidents");
  return { ok: true, message: `${resource.name} is out of service. ${cancelled} booking(s) cancelled and users notified.` };
}

export async function generateIncidentSummary(incidentId: string): Promise<Res> {
  const { incident, allowed } = await loadIncidentForStaff(incidentId);
  if (!incident) return fail("Incident not found.");
  if (!allowed) return fail("Only staff can do this.");
  let problems: string[] = [];
  if (incident.bookingId) {
    const reports = await db.conditionReport.findMany({ where: { bookingId: incident.bookingId } });
    problems = reports.flatMap((r) => ((r.items ?? []) as unknown as ChecklistEntry[]).filter((i) => !i.ok).map((i) => `${i.item} (${r.phase === "CHECK_IN" ? "check-in" : "return"})`));
  }
  const suggested: Severity = problems.length >= 3 || incident.type === "SAFETY" ? "HIGH" : problems.length ? "MEDIUM" : incident.severity;
  const summary = `${incident.type} reported on ${incident.resource.name}. ${problems.length ? `Checklist problems: ${problems.join(", ")}.` : "No checklist problems recorded."} Suggested severity: ${suggested}.`;
  await db.incident.update({ where: { id: incidentId }, data: { aiSummary: summary } });
  revalidatePath(`/incidents/${incidentId}`);
  return { ok: true, message: "Summary created." };
}

// ------------------------------------------------------------ C6 penalties
export async function proposePenalty(incidentId: string, kind: PenaltyKind, amount: number, note: string): Promise<Res> {
  const { user, incident, allowed } = await loadIncidentForStaff(incidentId);
  if (!incident) return fail("Incident not found.");
  if (!allowed) return fail("Only staff can do this.");
  if (!incident.booking) return fail("This incident has no booking, so there is nobody to penalise.");
  if (note.trim().length < 5) return fail("Please add a note (at least 5 characters).");
  if (kind !== "WARNING" && !(amount > 0)) return fail("Enter the number of days (suspension) or hours (quota reduction).");

  const penalty = await db.penalty.create({
    data: { userId: incident.booking.userId, incidentId, kind, days: kind === "WARNING" ? 0 : Math.round(amount), reason: note.trim(), status: "PROPOSED" },
  });
  await logAudit({ actorId: user.id, action: "PENALTY_PROPOSED", entityType: "Penalty", entityId: penalty.id, bookingId: incident.bookingId ?? undefined, resourceId: incident.resourceId, reason: note.trim() });
  await notify({ userId: penalty.userId, kind: "PENALTY", title: "A penalty has been proposed", body: `${kind}: ${note.trim()}. A manager still has to confirm it, and you can appeal.`, link: "/penalties" });
  revalidatePath(`/incidents/${incidentId}`);
  revalidatePath("/manager/penalties");
  return { ok: true, message: "Penalty proposed. A manager must confirm it." };
}

async function decidePenalty(id: string, note: string, to: "CONFIRMED" | "DISMISSED" | "OVERTURNED"): Promise<Res> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  if (note.trim().length < 5) return fail("Please add a note (at least 5 characters).");
  const p = await db.penalty.findUnique({ where: { id } });
  if (!p) return fail("Penalty not found.");
  const allowedFrom = to === "CONFIRMED" ? ["PROPOSED", "APPEALED"] : to === "DISMISSED" ? ["PROPOSED"] : ["APPEALED"];
  if (!allowedFrom.includes(p.status)) return fail(`A ${p.status.toLowerCase()} penalty cannot be set to ${to.toLowerCase()}.`);

  const at = await now();
  const data: Prisma.PenaltyUpdateInput = { status: to, decidedBy: { connect: { id: user.id } }, decisionNote: note.trim() };
  if (to === "CONFIRMED") {
    const startsAt = p.startsAt ?? at;
    data.startsAt = startsAt;
    if (p.kind === "SUSPENSION") data.endsAt = new Date(startsAt.getTime() + p.days * DAY);
  }
  await db.penalty.update({ where: { id }, data });
  const action = to === "CONFIRMED" ? "PENALTY_CONFIRMED" : to === "DISMISSED" ? "PENALTY_DISMISSED" : "PENALTY_OVERTURNED";
  await logAudit({ actorId: user.id, action, entityType: "Penalty", entityId: id, reason: note.trim() });
  await notify({ userId: p.userId, kind: "PENALTY", title: `Penalty ${to.toLowerCase()}`, body: note.trim(), link: "/penalties" });
  revalidatePath("/manager/penalties");
  revalidatePath("/penalties");
  return { ok: true, message: `Penalty ${to.toLowerCase()}.` };
}
export async function confirmPenalty(id: string, note: string) { return decidePenalty(id, note, "CONFIRMED"); }
export async function dismissPenalty(id: string, note: string) { return decidePenalty(id, note, "DISMISSED"); }
export async function overturnPenalty(id: string, note: string) { return decidePenalty(id, note, "OVERTURNED"); }

export async function appealPenalty(id: string, text: string): Promise<Res> {
  const user = await requireUser();
  const p = await db.penalty.findUnique({ where: { id } });
  if (!p || p.userId !== user.id) return fail("You can only appeal your own penalties.");
  if (p.status !== "PROPOSED" && p.status !== "CONFIRMED") return fail("This penalty cannot be appealed.");
  if (text.trim().length < 10) return fail("Please explain why (at least 10 characters).");
  await db.penalty.update({ where: { id }, data: { status: "APPEALED", appealText: text.trim() } });
  await logAudit({ actorId: user.id, action: "PENALTY_APPEALED", entityType: "Penalty", entityId: id, reason: text.trim() });
  const staff = await db.user.findMany({ where: { role: "MANAGER" }, select: { id: true } });
  for (const s of staff) {
    await notify({ userId: s.id, kind: "PENALTY", title: "Penalty appeal", body: `${user.name} appealed a penalty.`, link: "/manager/penalties" });
  }
  revalidatePath("/penalties");
  revalidatePath("/manager/penalties");
  return { ok: true, message: "Appeal sent." };
}

// ------------------------------------------------------------ C8 demo clock
export async function advanceClockAction(minutes: number): Promise<Res> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  await advanceClock(minutes);
  await logAudit({ actorId: user.id, action: "CLOCK_ADVANCED", entityType: "System", entityId: "clock", reason: `Advanced by ${minutes} minutes` });
  await runScheduler();
  revalidatePath("/", "layout");
  return { ok: true, message: `Clock advanced by ${minutes} minutes.` };
}

export async function resetClockAction(): Promise<Res> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  await resetClock();
  await logAudit({ actorId: user.id, action: "CLOCK_ADVANCED", entityType: "System", entityId: "clock", reason: "Reset to real time" });
  await runScheduler();
  revalidatePath("/", "layout");
  return { ok: true, message: "Clock reset to real time." };
}

// ------------------------------------------- C9 before/after photo check review
/** A manager records whether the possible changes found by the photo check are real damage. */
export async function reviewConditionChange(
  bookingId: string,
  input: { verdict: "DAMAGE" | "NO_DAMAGE"; note: string; regions: number; ssim: number },
): Promise<Res> {
  const user = await requireUser();
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } });
  if (!booking) return fail("Booking not found.");
  if (!canManageResource(user, booking.resource)) return fail("Only the owner or manager of this resource can review the photo check.");
  if (input.verdict !== "DAMAGE" && input.verdict !== "NO_DAMAGE") return fail("Unknown verdict.");
  const note = input.note.trim();
  if (note.length < 5) return fail("Please add a note (at least 5 characters).");

  await logAudit({
    actorId: user.id,
    action: "CONDITION_CHANGE_REVIEWED",
    entityType: "Booking",
    entityId: booking.id,
    bookingId: booking.id,
    resourceId: booking.resourceId,
    reason: note,
    meta: { verdict: input.verdict, regions: Math.max(0, Math.round(input.regions)), ssim: Number(input.ssim.toFixed(3)) },
  });
  revalidatePath(`/bookings/${booking.id}`);
  revalidatePath("/incidents/[id]", "page");
  return {
    ok: true,
    message: input.verdict === "DAMAGE"
      ? "Recorded as real damage. Use the incident actions to decide what happens next."
      : "Recorded as not damage.",
  };
}
