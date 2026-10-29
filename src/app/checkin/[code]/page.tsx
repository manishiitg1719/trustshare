import Link from "next/link";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { fmtRange } from "@/lib/shared/format";
import { UsagePanel } from "@/features/c/components/UsagePanel";

export const dynamic = "force-dynamic";

export default async function CheckInPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;

  // The typed code is only the first 6 characters, so several bookings can match: only show the user's own.
  const matches = await db.booking.findMany({
    where: {
      checkInCode: { startsWith: code },
      status: { in: ["APPROVED", "CHECKED_IN", "OVERDUE"] },
      OR: [{ userId: user.id }, { supervisorId: user.id }],
    },
    include: { resource: true },
  });

  if (matches.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-2 text-2xl font-bold">Check-in</h1>
        <p>No active booking of yours matches this code. Check the code, or that you are signed in as the person who booked.</p>
      </div>
    );
  }
  if (matches.length > 1) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-2 text-2xl font-bold">Which booking?</h1>
        <ul className="list-disc pl-5">
          {matches.map((b) => (
            <li key={b.id}><Link className="text-blue-600 underline" href={`/checkin/${b.checkInCode}`}>{b.resource.name} · {fmtRange(b.start, b.end)}</Link></li>
          ))}
        </ul>
      </div>
    );
  }
  const booking = matches[0];
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">{booking.resource.name}</h1>
      <p className="text-sm text-gray-600">{fmtRange(booking.start, booking.end)}</p>
      <UsagePanel bookingId={booking.id} />
    </div>
  );
}
