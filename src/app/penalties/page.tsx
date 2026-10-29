import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { fmtDateTime } from "@/lib/shared/format";
import { ClockBanner } from "@/features/c/components/ClockBanner";
import { AppealButton } from "./AppealButton";

export const dynamic = "force-dynamic";

export default async function PenaltiesPage() {
  const user = await requireUser();
  const penalties = await db.penalty.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="mx-auto max-w-3xl p-6">
      <ClockBanner />
      <h1 className="mb-6 text-3xl font-bold">My penalties</h1>
      <div className="space-y-4">
        {penalties.map((p) => (
          <div key={p.id} className="rounded border bg-white p-4 shadow-sm">
            <p className="font-bold">{p.kind.toLowerCase().replace("_", " ")}{p.days ? ` (${p.days} ${p.kind === "SUSPENSION" ? "days" : "hours"})` : ""} <span className="ml-2 rounded bg-gray-200 px-2 text-sm font-normal">{p.status.toLowerCase()}</span></p>
            <p className="mt-2">{p.reason}</p>
            {p.status === "PROPOSED" && <p className="mt-1 text-sm text-gray-600">Proposed only. It has no effect until a manager confirms it.</p>}
            {p.endsAt && <p className="text-sm text-gray-600">Runs until {fmtDateTime(p.endsAt)}</p>}
            {p.decisionNote && <p className="text-sm text-gray-600">Manager note: {p.decisionNote}</p>}
            {p.appealText && <p className="text-sm text-gray-600">Your appeal: {p.appealText}</p>}
            {(p.status === "PROPOSED" || p.status === "CONFIRMED") && <AppealButton penaltyId={p.id} />}
          </div>
        ))}
        {penalties.length === 0 && <p>No penalties.</p>}
      </div>
    </div>
  );
}
