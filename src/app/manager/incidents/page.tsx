import Link from "next/link";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { runScheduler } from "@/features/c/scheduler";
import { ClockBanner } from "@/features/c/components/ClockBanner";

export const dynamic = "force-dynamic";

const SEV = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export default async function ManagerIncidentsPage() {
  const user = await requireUser(["MANAGER", "ADMIN", "OWNER"]);
  await runScheduler();

  const incidents = await db.incident.findMany({
    where: { status: "OPEN", ...(user.role === "OWNER" ? { resource: { OR: [{ ownerId: user.id }, { managerId: user.id }] } } : {}) },
    include: { resource: true },
    orderBy: { createdAt: "asc" },
  });
  // Risk first: severity HIGH first, then HIGH-risk resources, then oldest (already sorted by date).
  incidents.sort((a, b) => SEV[a.severity] - SEV[b.severity] || SEV[a.resource.riskLevel] - SEV[b.resource.riskLevel]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <ClockBanner />
      <h1 className="mb-6 text-3xl font-bold">Open incidents ({incidents.length})</h1>
      <div className="space-y-3">
        {incidents.map((inc) => (
          <div key={inc.id} className="flex flex-col gap-2 rounded border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold">{inc.type.toLowerCase()} <span className="ml-1 rounded bg-gray-200 px-2 py-0.5 text-sm font-normal">{inc.severity.toLowerCase()}</span></p>
              <p className="text-gray-700">{inc.description}</p>
              <p className="text-sm text-blue-700">{inc.resource.name} ({inc.resource.riskLevel.toLowerCase()} risk)</p>
            </div>
            <Link href={`/incidents/${inc.id}`} className="rounded bg-gray-800 px-4 py-2 text-center text-white">Review</Link>
          </div>
        ))}
        {incidents.length === 0 && <p>No open incidents.</p>}
      </div>
    </div>
  );
}
