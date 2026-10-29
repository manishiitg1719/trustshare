import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { NewIncidentForm } from "./NewIncidentForm";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage({ searchParams }: { searchParams: Promise<{ bookingId?: string; resourceId?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [bookings, resources] = await Promise.all([
    db.booking.findMany({
      where: { userId: user.id, status: { in: ["CHECKED_IN", "OVERDUE", "RETURNED", "DISPUTED", "CLOSED", "APPROVED"] } },
      include: { resource: true },
      orderBy: { start: "desc" },
      take: 30,
    }),
    db.resource.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Report an incident</h1>
      <NewIncidentForm
        bookingId={sp.bookingId ?? ""}
        resourceId={sp.resourceId ?? ""}
        bookings={bookings.map((b) => ({ id: b.id, label: `${b.resource.name}, ${b.start.toLocaleDateString("en-GB")}` }))}
        resources={resources.map((r) => ({ id: r.id, label: r.name }))}
      />
    </div>
  );
}
