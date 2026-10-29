"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PenaltyKind } from "@prisma/client";
import { resolveIncident, dismissIncident, setResourceService, proposePenalty, generateIncidentSummary, type Res } from "@/features/c/actions";

export function IncidentActions({ incidentId, open, outOfService, canPenalise }: { incidentId: string; open: boolean; outOfService: boolean; canPenalise: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<PenaltyKind>("WARNING");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Res | null>(null);
  const [pending, start] = useTransition();

  const go = (f: () => Promise<Res>) =>
    start(async () => {
      const r = await f();
      setMsg(r);
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm">Note for the actions below (at least 5 characters)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 block w-full rounded border p-2" />
        </label>
        <div className="flex flex-wrap gap-2">
          {open && <button disabled={pending} onClick={() => go(() => resolveIncident(incidentId, note))} className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50">Resolve</button>}
          {open && <button disabled={pending} onClick={() => go(() => dismissIncident(incidentId, note))} className="rounded bg-gray-600 px-3 py-2 text-sm text-white disabled:opacity-50">Dismiss</button>}
          <button disabled={pending} onClick={() => go(() => setResourceService(incidentId, !outOfService, note))} className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            {outOfService ? "Put back in service" : "Mark resource out of service"}
          </button>
          <button disabled={pending} onClick={() => go(() => generateIncidentSummary(incidentId))} className="rounded bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-50">Draft summary</button>
        </div>
      </div>

      {canPenalise && (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Propose a penalty (a manager confirms it later)</h3>
          <label className="block text-sm">Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as PenaltyKind)} className="ml-2 rounded border p-1">
              <option value="WARNING">Warning</option>
              <option value="SUSPENSION">Suspension (days)</option>
              <option value="QUOTA_REDUCTION">Quota reduction (hours)</option>
            </select>
          </label>
          {kind !== "WARNING" && (
            <label className="block text-sm">{kind === "SUSPENSION" ? "Days" : "Hours"}
              <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="ml-2 w-24 rounded border p-1" />
            </label>
          )}
          <button disabled={pending} onClick={() => go(() => proposePenalty(incidentId, kind, amount, note))} className="rounded bg-yellow-600 px-3 py-2 text-sm text-white disabled:opacity-50">Propose penalty</button>
        </div>
      )}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.message}</p>}
    </div>
  );
}
