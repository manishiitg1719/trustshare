import type { Prisma } from "@prisma/client";
import { db } from "@/lib/shared/db";
import { getCurrentUser, canManageResource, isStaff } from "@/lib/shared/auth";
import { fmtDateTime } from "@/lib/shared/format";
import type { ChecklistEntry } from "@/lib/shared/types";

type Item = { key: string; at: Date; icon: string; tone: string; text: string; reason?: string | null; photos?: string[] };

const TONE = {
  good: "#047857",
  bad: "#BE123C",
  warn: "#B45309",
  info: "#0369A1",
  grey: "#57534E",
} as const;

function describe(action: string, who: string, meta: Record<string, unknown>): { text: string; icon: string; tone: string } {
  const to = typeof meta.to === "string" ? meta.to : "";
  const m: Record<string, [string, string, string]> = {
    RESOURCE_CREATED: [`${who} listed the resource`, "➕", TONE.info],
    RESOURCE_UPDATED: [`${who} updated the resource`, "✏️", TONE.grey],
    RESOURCE_OUT_OF_SERVICE: [`${who} put the resource out of service`, "🚫", TONE.bad],
    RESOURCE_RESTORED: [`${who} put the resource back in service`, "♻️", TONE.good],
    USER_VERIFIED: [`${who} verified an account`, "🪪", TONE.good],
    USER_ROLE_CHANGED: [`${who} changed a role`, "🪪", TONE.grey],
    CREDENTIAL_SUBMITTED: [`${who} submitted a credential`, "📄", TONE.info],
    CREDENTIAL_VERIFIED: [`${who} verified a credential`, "✅", TONE.good],
    CREDENTIAL_REJECTED: [`${who} rejected a credential`, "❌", TONE.bad],
    BOOKING_REQUESTED: [`${who} requested the booking`, "📝", TONE.info],
    BOOKING_AUTO_APPROVED: [`The system approved the request automatically`, "🤖", TONE.good],
    BOOKING_APPROVED: [`${who} approved the request`, "✅", TONE.good],
    BOOKING_REJECTED: [`${who} rejected the request`, "❌", TONE.bad],
    BOOKING_WAITLISTED: [`${who} put the request on the waitlist`, "⏳", TONE.warn],
    BOOKING_PROMOTED: [`${who} moved the request up from the waitlist${to === "APPROVED" ? " and approved it" : ""}`, "⬆️", TONE.good],
    BOOKING_CANCELLED: [`${who} cancelled the booking`, "🗑️", TONE.grey],
    BOOKING_APPROVAL_REVOKED: [`${who} revoked the approval`, "↩️", TONE.warn],
    BOOKING_APPEALED: [`${who} appealed the rejection`, "📣", TONE.info],
    EXTENSION_REQUESTED: [`${who} asked for more time`, "⏱️", TONE.info],
    EXTENSION_APPROVED: [`${who} approved the extension`, "✅", TONE.good],
    EXTENSION_REJECTED: [`${who} rejected the extension`, "❌", TONE.bad],
    CHECKED_IN: [`${who} checked in`, "🔑", TONE.good],
    RETURNED: [`${who} returned it`, "📦", TONE.good],
    BOOKING_CLOSED: [`${who} closed the booking`, "🔒", TONE.grey],
    BOOKING_DISPUTED: [`${who} disputed the finding`, "⚖️", TONE.warn],
    MARKED_OVERDUE: [`${who} marked the booking overdue`, "⏰", TONE.bad],
    MARKED_NO_SHOW: [`${who} marked the booking as a no-show`, "👻", TONE.bad],
    INCIDENT_REPORTED: [`${who} reported an incident`, "⚠️", TONE.bad],
    CONDITION_CHANGE_REVIEWED: [`${who} reviewed the before/after photo check: ${meta.verdict === "DAMAGE" ? "real damage" : "not damage"}`, "🔍", meta.verdict === "DAMAGE" ? TONE.bad : TONE.good],
    INCIDENT_RESOLVED: [`${who} resolved an incident`, "✅", TONE.good],
    INCIDENT_DISMISSED: [`${who} dismissed an incident`, "➖", TONE.grey],
    PENALTY_PROPOSED: [`${who} proposed a penalty`, "⚠️", TONE.warn],
    PENALTY_CONFIRMED: [`${who} confirmed a penalty`, "⛔", TONE.bad],
    PENALTY_DISMISSED: [`${who} dismissed a penalty`, "➖", TONE.grey],
    PENALTY_APPEALED: [`${who} appealed a penalty`, "📣", TONE.info],
    PENALTY_OVERTURNED: [`${who} overturned a penalty`, "✅", TONE.good],
    CLOCK_ADVANCED: [`${who} moved the demo clock`, "🕒", TONE.grey],
    DEMO_RESET: [`${who} reset the demo data`, "🔄", TONE.grey],
  };
  const hit = m[action];
  return hit ? { text: hit[0], icon: hit[1], tone: hit[2] } : { text: `${who} did ${action.toLowerCase().replace(/_/g, " ")}`, icon: "•", tone: TONE.grey };
}

/* eslint-disable @next/next/no-img-element */
export async function HistoryTimeline({ bookingId, resourceId, userId }: { bookingId?: string; resourceId?: string; userId?: string }) {
  const viewer = await getCurrentUser();
  if (!viewer) return null;

  const denied = <p className="card card-pad text-sm text-ink-3">You do not have access to this history.</p>;
  let where: Prisma.AuditLogWhereInput = {};
  let reportWhere: Prisma.ConditionReportWhereInput = { id: "none" };
  let incidentWhere: Prisma.IncidentWhereInput = { id: "none" };

  if (bookingId) {
    const b = await db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } });
    if (!b) return null;
    if (b.userId !== viewer.id && b.supervisorId !== viewer.id && !canManageResource(viewer, b.resource)) return denied;
    where = { bookingId };
    reportWhere = { bookingId };
    incidentWhere = { bookingId };
  } else if (resourceId) {
    const r = await db.resource.findUnique({ where: { id: resourceId } });
    if (!r) return null;
    if (!canManageResource(viewer, r)) return denied;
    where = { resourceId };
    reportWhere = { booking: { resourceId } };
    incidentWhere = { resourceId };
  } else if (userId) {
    if (userId !== viewer.id && !isStaff(viewer)) return denied;
    where = { OR: [{ actorId: userId }, { booking: { userId } }] };
    reportWhere = { booking: { userId } };
    incidentWhere = { OR: [{ reporterId: userId }, { booking: { userId } }] };
  } else {
    return null;
  }

  const [logs, reports, incidents] = await Promise.all([
    db.auditLog.findMany({ where, include: { actor: true }, orderBy: { createdAt: "asc" } }),
    db.conditionReport.findMany({ where: reportWhere, include: { createdBy: true, booking: { include: { resource: true } } } }),
    db.incident.findMany({ where: incidentWhere, include: { reporter: true, resource: true } }),
  ]);

  const items: Item[] = [];
  for (const l of logs) {
    const d = describe(l.action, l.actor?.name ?? "The system", (l.meta ?? {}) as Record<string, unknown>);
    items.push({ key: `a${l.id}`, at: l.createdAt, icon: d.icon, tone: d.tone, text: d.text, reason: l.reason });
  }
  for (const r of reports) {
    const list = (r.items as unknown as ChecklistEntry[]) ?? [];
    const bad = list.filter((i) => !i.ok).length;
    items.push({
      key: `c${r.id}`,
      at: r.createdAt,
      icon: "📋",
      tone: bad ? TONE.warn : TONE.good,
      text: `${r.createdBy.name} recorded the ${r.phase === "CHECK_IN" ? "check-in" : "return"} condition of ${r.booking.resource.name}: ${bad ? `${bad} problem(s)` : "all OK"}`,
      reason: r.notes || null,
      photos: r.photos,
    });
  }
  for (const i of incidents) {
    items.push({
      key: `i${i.id}`,
      at: i.createdAt,
      icon: "⚠️",
      tone: TONE.bad,
      text: `Incident (${i.type.toLowerCase()}, ${i.severity.toLowerCase()} severity) on ${i.resource.name} by ${i.reporter.name}`,
      reason: i.description,
      photos: i.photos,
    });
  }
  items.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <section className="card card-pad">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-semibold">Full history</h2>
        <span className="label flex items-center gap-1.5">
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          This history cannot be edited
        </span>
      </div>
      {items.length === 0 && <p className="text-sm text-ink-3">Nothing recorded yet.</p>}
      <ol className="relative space-y-[18px] pl-[30px] before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-0.5 before:bg-line">
        {items.map((it) => (
          <li key={it.key} className="relative">
            <span
              aria-hidden
              className="absolute -left-[30px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-[2.5px] border-white text-[9px]"
              style={{ background: it.tone, boxShadow: `0 0 0 1.5px ${it.tone}` }}
            >
              <span className="opacity-90 grayscale-0">{it.icon}</span>
            </span>
            <p className="font-mono text-[11px] uppercase tracking-[.04em] text-ink-3">{fmtDateTime(it.at)}</p>
            <p className="mt-0.5 text-[14px] font-semibold text-ink">{it.text}</p>
            {it.reason && <p className="reason-q mt-1.5">“{it.reason}”</p>}
            {it.photos && it.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {it.photos.map((p, k) => (
                  <img key={k} src={p} alt={`Photo ${k + 1}`} className="h-16 w-16 rounded-[10px] border border-line object-cover" />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}