import { notFound } from "next/navigation";
import { db } from "@/lib/shared/db";
import { requireUser, canManageResource } from "@/lib/shared/auth";
import { fmtDateTime } from "@/lib/shared/format";
import { ConditionComparison } from "@/features/c/components/ConditionComparison";
import { IncidentActions } from "./IncidentActions";

export const dynamic = "force-dynamic";

/* eslint-disable @next/next/no-img-element */
export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const incident = await db.incident.findUnique({
    where: { id },
    include: { resource: true, reporter: true, resolvedBy: true, booking: { include: { user: true } }, penalties: true },
  });
  if (!incident) notFound();

  const staff = canManageResource(user, incident.resource);
  if (!staff && incident.reporterId !== user.id && incident.booking?.userId !== user.id) {
    return <p className="p-6">You do not have access to this incident.</p>;
  }

  const subject = incident.booking?.user;
  const since = new Date(Date.now() - 90 * 24 * 3600_000);
  const history = staff && subject
    ? await Promise.all([
        db.booking.count({ where: { userId: subject.id, status: "NO_SHOW", start: { gte: since } } }),
        db.penalty.count({ where: { userId: subject.id, status: "CONFIRMED", createdAt: { gte: since } } }),
        db.incident.count({ where: { booking: { userId: subject.id }, createdAt: { gte: since } } }),
      ])
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-3xl font-bold">Incident: {incident.type.toLowerCase()} ({incident.severity.toLowerCase()})</h1>
      <section className="rounded border bg-white p-4 text-sm">
        <p><strong>Resource:</strong> {incident.resource.name} ({incident.resource.status.replace("_", " ").toLowerCase()})</p>
        <p><strong>Reported by:</strong> {incident.reporter.name} on {fmtDateTime(incident.createdAt)}</p>
        <p><strong>Status:</strong> {incident.status.toLowerCase()}{incident.resolutionNote ? ` · ${incident.resolutionNote}` : ""}</p>
        <p className="mt-2">{incident.description}</p>
        <div className="mt-2 flex gap-2">
          {incident.photos.map((p, i) => <img key={i} src={p} alt={`Incident photo ${i + 1}`} className="h-24 w-24 rounded border object-cover" />)}
        </div>
        {incident.aiSummary && (
          <p className="mt-3 rounded bg-purple-50 p-2">
            <strong>{incident.aiSummary}</strong>
            <span className="block text-xs text-purple-800">AI suggestion, human decision required</span>
          </p>
        )}
      </section>

      {incident.booking && (
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-semibold">Condition at check-in and return</h2>
          <ConditionComparison bookingId={incident.booking.id} />
          <a className="mt-2 inline-block text-sm text-blue-600 underline" href={`/bookings/${incident.booking.id}`}>Open the booking</a>
        </section>
      )}

      {history && subject && (
        <section className="rounded border bg-white p-4 text-sm">
          <h2 className="mb-1 font-semibold">{subject.name}, last 90 days</h2>
          <p>{history[0]} no-show(s), {history[1]} confirmed penalt{history[1] === 1 ? "y" : "ies"}, {history[2]} incident(s).</p>
        </section>
      )}

      {incident.penalties.length > 0 && (
        <section className="rounded border bg-white p-4 text-sm">
          <h2 className="mb-1 font-semibold">Penalties from this incident</h2>
          <ul className="list-disc pl-5">{incident.penalties.map((p) => <li key={p.id}>{p.kind.toLowerCase()} · {p.status.toLowerCase()} · {p.reason}</li>)}</ul>
        </section>
      )}

      {staff && (
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-semibold">Decide</h2>
          <IncidentActions incidentId={incident.id} open={incident.status === "OPEN"} outOfService={incident.resource.status === "OUT_OF_SERVICE"} canPenalise={!!incident.booking} />
        </section>
      )}
    </div>
  );
}
