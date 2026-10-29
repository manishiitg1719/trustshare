// SHARED CONTRACT. Do not edit in a part branch.
import type { BookingStatus } from "@prisma/client";

/** One line of an eligibility or booking check. Stored on Booking.ruleResults and shown in "Why this decision?". */
export type RuleResult = {
  rule: RuleId;
  label: string; // human sentence, e.g. "Laser cutter induction"
  passed: boolean;
  detail: string; // e.g. "Verified, expires 12 Mar 2027" or "Missing"
  fix?: string; // what the user can do, e.g. "Next induction: Tuesday 3pm, Room B12"
  /** When a failed rule should send the request to the waitlist or a manager instead of rejecting it. */
  onFail?: "REJECT" | "WAITLIST" | "REVIEW";
};

export type RuleId =
  | "account_verified"
  | "resource_active"
  | "external_allowed"
  | "credential"
  | "not_suspended"
  | "opening_hours"
  | "max_duration"
  | "in_future"
  | "no_clash"
  | "active_cap"
  | "monthly_quota"
  | "cooldown"
  | "risk_tier"
  | "supervisor";

export type EligibilityResult = {
  eligible: boolean;
  checks: RuleResult[];
};

/** Item in ConditionReport.items. */
export type ChecklistEntry = { item: string; ok: boolean; note?: string };

/** Booking outcome decided by the booking engine (Part B). */
export type BookingOutcome = "AUTO_APPROVE" | "NEEDS_REVIEW" | "WAITLIST" | "REJECT";

/** Every value written to AuditLog.action. Add new ones here only by agreement. */
export const AuditAction = {
  RESOURCE_CREATED: "RESOURCE_CREATED",
  RESOURCE_UPDATED: "RESOURCE_UPDATED",
  RESOURCE_OUT_OF_SERVICE: "RESOURCE_OUT_OF_SERVICE",
  RESOURCE_RESTORED: "RESOURCE_RESTORED",
  USER_VERIFIED: "USER_VERIFIED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  CREDENTIAL_SUBMITTED: "CREDENTIAL_SUBMITTED",
  CREDENTIAL_VERIFIED: "CREDENTIAL_VERIFIED",
  CREDENTIAL_REJECTED: "CREDENTIAL_REJECTED",
  BOOKING_REQUESTED: "BOOKING_REQUESTED",
  BOOKING_AUTO_APPROVED: "BOOKING_AUTO_APPROVED",
  BOOKING_APPROVED: "BOOKING_APPROVED",
  BOOKING_REJECTED: "BOOKING_REJECTED",
  BOOKING_WAITLISTED: "BOOKING_WAITLISTED",
  BOOKING_PROMOTED: "BOOKING_PROMOTED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_APPROVAL_REVOKED: "BOOKING_APPROVAL_REVOKED",
  BOOKING_APPEALED: "BOOKING_APPEALED",
  EXTENSION_REQUESTED: "EXTENSION_REQUESTED",
  EXTENSION_APPROVED: "EXTENSION_APPROVED",
  EXTENSION_REJECTED: "EXTENSION_REJECTED",
  CHECKED_IN: "CHECKED_IN",
  RETURNED: "RETURNED",
  BOOKING_CLOSED: "BOOKING_CLOSED",
  BOOKING_DISPUTED: "BOOKING_DISPUTED",
  MARKED_OVERDUE: "MARKED_OVERDUE",
  MARKED_NO_SHOW: "MARKED_NO_SHOW",
  INCIDENT_REPORTED: "INCIDENT_REPORTED",
  CONDITION_CHANGE_REVIEWED: "CONDITION_CHANGE_REVIEWED",
  INCIDENT_RESOLVED: "INCIDENT_RESOLVED",
  INCIDENT_DISMISSED: "INCIDENT_DISMISSED",
  PENALTY_PROPOSED: "PENALTY_PROPOSED",
  PENALTY_CONFIRMED: "PENALTY_CONFIRMED",
  PENALTY_DISMISSED: "PENALTY_DISMISSED",
  PENALTY_APPEALED: "PENALTY_APPEALED",
  PENALTY_OVERTURNED: "PENALTY_OVERTURNED",
  CLOCK_ADVANCED: "CLOCK_ADVANCED",
  DEMO_RESET: "DEMO_RESET",
} as const;
export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export const NotificationKind = {
  BOOKING_APPROVED: "BOOKING_APPROVED",
  BOOKING_REJECTED: "BOOKING_REJECTED",
  BOOKING_WAITLISTED: "BOOKING_WAITLISTED",
  BOOKING_PROMOTED: "BOOKING_PROMOTED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  NEW_REQUEST: "NEW_REQUEST", // to managers
  EXTENSION_DECIDED: "EXTENSION_DECIDED",
  REMINDER: "REMINDER",
  OVERDUE: "OVERDUE",
  NO_SHOW: "NO_SHOW",
  INCIDENT: "INCIDENT",
  PENALTY: "PENALTY",
  CREDENTIAL: "CREDENTIAL",
  RESOURCE_OUT_OF_SERVICE: "RESOURCE_OUT_OF_SERVICE",
} as const;
export type NotificationKindType = (typeof NotificationKind)[keyof typeof NotificationKind];

/** Statuses that hold the resource (used by the clash check and the DB exclusion constraint). */
export const LIVE_STATUSES: BookingStatus[] = ["APPROVED", "CHECKED_IN", "OVERDUE"];

/** Statuses that count towards a user's active booking cap. */
export const ACTIVE_STATUSES: BookingStatus[] = ["REQUESTED", "APPROVED", "WAITLISTED", "CHECKED_IN", "OVERDUE"];

/** Fairness constants that are the same for every resource. Per-resource limits live on Resource. */
export const FAIRNESS = {
  MAX_ACTIVE_BOOKINGS: 3,
  NO_SHOW_GRACE_MINUTES: 30,
  REMINDER_MINUTES_BEFORE: 60,
} as const;
