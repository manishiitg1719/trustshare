import { notFound } from "next/navigation";
import { db } from "@/lib/shared/db";
import { requireUser, canManageResource } from "@/lib/shared/auth";
import { now } from "@/lib/shared/clock";
import { fmtRange } from "@/lib/shared/format";
import { StatusBadge } from "@/lib/shared/StatusBadge";
import { DecisionPanel } from "@/features/b/components/DecisionPanel";
import { CancelAction, AppealAction } from "@/features/b/components/ReasonActions";
import { UsagePanel } from "@/features/c/components/UsagePanel";
import { HistoryTimeline } from "@/features/c/components/HistoryTimeline";
import Link from "next/link";
import { RiskBadge } from "@/components/ui";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const booking = await db.booking.findUnique({ where: { id }, include: { resource: true, user: true } });
  if (!booking) notFound();

  const staff = canManageResource(user, booking.resource);
  if (booking.userId !== user.id && !staff) {
    return <p className="card card-pad">You do not have access to this booking.</p>;
  }

  const at = await now();
  const canCancel = ["REQUESTED", "APPROVED", "WAITLISTED"].includes(booking.status) && (staff || (booking.userId === user.id && booking.start > at));
  const canAppeal = booking.status === "REJECTED" && booking.userId === user.id;

  return (
    <div className="mx-auto max-w-[1040px]">
      <nav aria-label="Breadcrumb" className="mb-3 font-mono text-[11.5px] uppercase tracking-[.04em] text-ink-3">
        <Link href="/bookings" className="hover:text-ink">My bookings</Link> / <span className="text-ink">#{booking.id.slice(-6).toUpperCase()}</span>
      </nav>

      <header className="card card-pad mb-5 flex items-center gap-4">
        {booking.resource.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={booking.resource.photoUrl} alt="" className="h-16 w-[86px] rounded-xl border border-line object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] font-bold">{booking.resource.name}</h1>
            <StatusBadge status={booking.status} />
            <RiskBadge level={booking.resource.riskLevel} />
          </div>
          <p className="mt-1 font-mono text-[11.5px] uppercase text-ink-3">
            {fmtRange(booking.start, booking.end)} · {booking.resource.location} · booked by {booking.user.name}
          </p>
        </div>
        <Link href={`/resources/${booking.resourceId}`} className="btn btn-secondary btn-sm">View resource</Link>
      </header>

      <div className="grid grid-cols-[1.5fr_1fr] gap-5">
        <div className="min-w-0 space-y-5">
          <UsagePanel bookingId={booking.id} />
          <HistoryTimeline bookingId={booking.id} />
        </div>
        <aside className="space-y-4">
          <section className="card card-pad">
            <div className="label mb-1.5">Purpose</div>
            <p className="text-[14px] text-ink">{booking.purpose}</p>
          </section>
          <DecisionPanel bookingId={booking.id} />
          {canCancel && (
            <section className="card card-pad">
              <div className="label mb-3">Cancel this booking</div>
              <CancelAction bookingId={booking.id} />
            </section>
          )}
          {canAppeal && (
            <section className="card card-pad">
              <div className="label mb-3">Appeal the decision</div>
              <AppealAction bookingId={booking.id} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}