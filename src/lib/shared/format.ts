// SHARED CONTRACT. Display helpers so all parts format dates and statuses the same way.
import type { BookingStatus } from "@prisma/client";

export function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtRange(start: Date, end: Date): string {
  const sameDay = start.toDateString() === end.toDateString();
  const endText = sameDay ? end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : fmtDateTime(end);
  return `${fmtDateTime(start)} - ${endText}`;
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  REQUESTED: "Waiting for review",
  APPROVED: "Approved",
  WAITLISTED: "Waitlisted",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  CHECKED_IN: "In use",
  RETURNED: "Returned, awaiting sign-off",
  CLOSED: "Closed",
  DISPUTED: "Disputed",
  OVERDUE: "Overdue",
  NO_SHOW: "No-show",
};

/** Tailwind classes for a status badge. */
export const STATUS_TONE: Record<BookingStatus, string> = {
  REQUESTED: "bg-info-bg text-info border-info-line",
  APPROVED: "bg-ok-bg text-ok border-ok-line",
  WAITLISTED: "bg-warn-bg text-warn border-warn-line",
  REJECTED: "bg-bad-bg text-bad border-bad-line",
  CANCELLED: "bg-surface-2 text-ink-3 border-line",
  CHECKED_IN: "bg-brand-soft text-brand border-brand-line",
  RETURNED: "bg-brand-soft text-brand border-brand-line",
  CLOSED: "bg-surface-2 text-ink-3 border-line",
  DISPUTED: "bg-warn-bg text-warn border-warn-line",
  OVERDUE: "bg-bad-bg text-bad border-bad-line",
  NO_SHOW: "bg-bad-bg text-bad border-bad-line",
};
