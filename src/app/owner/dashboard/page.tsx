// Owned by Part A: utilization dashboard (last 30 days).
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { now } from "@/lib/shared/clock";

const HOUR = 3_600_000;
const COUNTED = ["APPROVED", "CHECKED_IN", "OVERDUE", "RETURNED", "CLOSED", "DISPUTED"] as const;

function overlapHours(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const ms = Math.min(aEnd.getTime(), bEnd.getTime()) - Math.max(aStart.getTime(), bStart.getTime());
  return ms > 0 ? ms / HOUR : 0;
}

export default async function OwnerDashboard() {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const to = await now();
  const from = new Date(to.getTime() - 30 * 24 * HOUR);

  const resources = await db.resource.findMany({
    where: { status: { not: "ARCHIVED" }, ...(user.role === "OWNER" ? { ownerId: user.id } : {}) },
    orderBy: { name: "asc" },
  });

  const stats = await Promise.all(
    resources.map(async (res) => {
      const [bookings, waiting, openIncidents] = await Promise.all([
        db.booking.findMany({
          where: { resourceId: res.id, status: { in: [...COUNTED, "NO_SHOW"] }, start: { lt: to }, end: { gt: from } },
          select: { start: true, end: true, status: true },
        }),
        db.booking.count({ where: { resourceId: res.id, status: "WAITLISTED", end: { gt: to } } }),
        db.incident.count({ where: { resourceId: res.id, status: "OPEN" } }),
      ]);
      const used = bookings.filter((b) => (COUNTED as readonly string[]).includes(b.status));

      let openHours = 0;
      let bookedHours = 0;
      for (let i = 0; i <= 30; i++) {
        const day = new Date(from);
        day.setDate(day.getDate() + i);
        if (!res.openDays.includes(day.getDay())) continue;
        const open = new Date(day);
        open.setHours(res.openHour, 0, 0, 0);
        const close = new Date(day);
        close.setHours(res.closeHour, 0, 0, 0);
        openHours += overlapHours(open, close, from, to);
        for (const b of used) {
          const startInDay = new Date(Math.max(open.getTime(), from.getTime()));
          const endInDay = new Date(Math.min(close.getTime(), to.getTime()));
          bookedHours += overlapHours(b.start, b.end, startInDay, endInDay);
        }
      }
      const idle = openHours > 0 ? Math.min(100, Math.max(0, Math.round((1 - bookedHours / openHours) * 100))) : 100;
      return {
        res,
        openHours,
        bookedHours,
        idle,
        bookingCount: used.length,
        noShows: bookings.filter((b) => b.status === "NO_SHOW").length,
        waiting,
        openIncidents,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Utilization, last 30 days</h1>
      {stats.length === 0 && <p className="text-gray-700">You have no resources yet.</p>}
      <ul className="grid gap-6">
        {stats.map((s) => (
          <li key={s.res.id} className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-bold">{s.res.name}</h2>
            <p className="mb-4 text-gray-800">
              {s.res.name} idle {s.idle}% of open hours, {s.waiting} {s.waiting === 1 ? "request" : "requests"} waiting
            </p>

            <div
              role="img"
              aria-label={`Booked ${s.bookedHours.toFixed(1)} of ${s.openHours.toFixed(0)} open hours`}
              className="h-4 w-full overflow-hidden rounded bg-gray-200"
            >
              <div className="h-full bg-blue-700" style={{ width: `${100 - s.idle}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-700">
              Booked {s.bookedHours.toFixed(1)} h of {s.openHours.toFixed(0)} open hours
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="font-semibold">Bookings</dt><dd>{s.bookingCount}</dd></div>
              <div><dt className="font-semibold">No-shows</dt><dd>{s.noShows}</dd></div>
              <div><dt className="font-semibold">Waitlisted now</dt><dd>{s.waiting}</dd></div>
              <div><dt className="font-semibold">Open incidents</dt><dd>{s.openIncidents}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
