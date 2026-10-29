import { db } from "@/lib/shared/db";
import { getCurrentUser, canManageResource } from "@/lib/shared/auth";
import { now } from "@/lib/shared/clock";
import { FAIRNESS } from "@/lib/shared/types";
import type { ChecklistEntry } from "@/lib/shared/types";
import { fmtDateTime } from "@/lib/shared/format";
import { CheckInForm, ReturnForm, ReviewActions } from "./UsageForms";
import { ConditionComparison } from "./ConditionComparison";

export async function UsagePanel({ bookingId }: { bookingId: string }) {
  const [user, booking] = await Promise.all([
    getCurrentUser(),
    db.booking.findUnique({ where: { id: bookingId }, include: { resource: true, supervisor: true, conditionReports: true } }),
  ]);
  if (!user || !booking) return null;

  const isOwnerOfBooking = booking.userId === user.id;
  const isSupervisor = booking.supervisorId === user.id;
  const staff = canManageResource(user, booking.resource);
  const at = await now();
  const box = "card card-pad";

  if (booking.status === "APPROVED") {
    if (!isOwnerOfBooking && !isSupervisor) return null;
    const opens = new Date(booking.start.getTime() - 15 * 60_000);
    const deadline = new Date(booking.start.getTime() + FAIRNESS.NO_SHOW_GRACE_MINUTES * 60_000);
    const open = at >= opens && at <= deadline;
    return (
      <section className={box}>
        <h2 className="mb-2 text-[18px] font-semibold">Check-in</h2>
        <p className="mb-1 text-sm">Your check-in code: <strong className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-lg tracking-widest">{booking.checkInCode.slice(0, 6)}</strong></p>
        <p className="mb-3 text-sm"><a className="font-semibold text-brand underline" href={`/checkin/${booking.checkInCode}`}>Open the check-in page</a> (this link is what a sticker on the equipment would contain)</p>
        <CheckInForm
          bookingId={booking.id}
          items={booking.resource.checklist}
          supervisorName={booking.supervisor?.name ?? null}
          needsSupervisor={booking.resource.requiresSupervisor}
          viewerIsSupervisor={isSupervisor}
          open={open}
          windowText={open ? `Check-in is open until ${fmtDateTime(deadline)}.` : at < opens ? `Check-in opens at ${fmtDateTime(opens)}.` : "The check-in deadline has passed."}
        />
      </section>
    );
  }

  if (booking.status === "CHECKED_IN" || booking.status === "OVERDUE") {
    if (!isOwnerOfBooking && !staff) return null;
    const before = booking.conditionReports.find((r) => r.phase === "CHECK_IN");
    const okAtCheckIn = ((before?.items ?? []) as unknown as ChecklistEntry[]).filter((i) => i.ok).map((i) => i.item);
    return (
      <section className={box}>
        <h2 className="mb-2 text-[18px] font-semibold">Return</h2>
        {booking.status === "OVERDUE" && <p className="mb-3 rounded-lg border border-bad-line bg-bad-bg px-3 py-2 text-sm font-medium text-bad">This booking is overdue. Please return it as soon as you can.</p>}
        <ReturnForm bookingId={booking.id} items={booking.resource.checklist} okAtCheckIn={okAtCheckIn} />
      </section>
    );
  }

  if (booking.status === "RETURNED" || booking.status === "DISPUTED" || booking.status === "CLOSED") {
    return (
      <section className={box}>
        <h2 className="mb-3 text-[18px] font-semibold">Condition proof</h2>
        <ConditionComparison bookingId={booking.id} />
        <div className="mt-4 border-t border-line pt-4">
          {booking.status === "RETURNED" && staff && <ReviewActions bookingId={booking.id} mode="STAFF_RETURNED" />}
          {booking.status === "RETURNED" && isOwnerOfBooking && !staff && <ReviewActions bookingId={booking.id} mode="USER_RETURNED" />}
          {booking.status === "DISPUTED" && staff && <ReviewActions bookingId={booking.id} mode="STAFF_DISPUTED" />}
          {booking.status === "DISPUTED" && !staff && <p className="text-sm">Your dispute is waiting for a manager.</p>}
        </div>
      </section>
    );
  }
  return null;
}
