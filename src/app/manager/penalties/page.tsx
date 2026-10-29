import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { runScheduler } from "@/features/c/scheduler";
import { ClockBanner } from "@/features/c/components/ClockBanner";
import { PenaltyManagerActions } from "./PenaltyManagerActions";

export const dynamic = "force-dynamic";

export default async function ManagerPenaltiesPage() {
  await requireUser(["MANAGER", "ADMIN"]);
  await runScheduler();
  const penalties = await db.penalty.findMany({
    where: { status: { in: ["PROPOSED", "APPEALED"] } },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div className="mx-auto max-w-4xl p-6">
      <ClockBanner />
      <h1 className="mb-6 text-3xl font-bold">Penalties to decide ({penalties.length})</h1>
      <div className="space-y-4">
        {penalties.map((p) => (
          <div key={p.id} className="rounded border bg-white p-4 shadow-sm">
            <p className="font-bold">{p.kind.toLowerCase().replace("_", " ")}{p.days ? ` (${p.days} ${p.kind === "SUSPENSION" ? "days" : "hours"})` : ""} <span className="ml-2 rounded bg-gray-200 px-2 text-sm font-normal">{p.status.toLowerCase()}</span></p>
            <p className="text-sm text-gray-600">User: {p.user.name} ({p.user.userType.toLowerCase()})</p>
            <p className="mt-2">{p.reason}</p>
            {p.appealText && <p className="mt-2 rounded bg-blue-50 p-2 text-sm"><strong>Appeal:</strong> {p.appealText}</p>}
            <div className="mt-3 border-t pt-3"><PenaltyManagerActions id={p.id} status={p.status} /></div>
          </div>
        ))}
        {penalties.length === 0 && <p>No pending penalties.</p>}
      </div>
    </div>
  );
}
