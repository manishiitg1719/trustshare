"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = { label: string; className: string; run: (reason: string, extra?: string) => Promise<{ ok: boolean; message: string }> };

/** Reason box plus one or more decision buttons. Optional supervisor picker. */
export function ReasonButtons({
  actions,
  supervisors,
}: {
  actions: Action[];
  supervisors?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="field-label">Your reason <span className="text-bad">*</span> <span className="font-normal text-ink-3">(at least 5 characters)</span></span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="block w-full" />
      </label>
      {supervisors && (
        <label className="block">
          <span className="field-label">Assign supervisor</span>
          <select value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="block w-full">
            <option value="">Choose…</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={pending}
            className={`btn ${a.className}`}
            onClick={() =>
              start(async () => {
                const res = await a.run(reason, supervisor || undefined);
                setMsg(res.message);
                if (res.ok) {
                  setReason("");
                  router.refresh();
                }
              })
            }
          >
            {a.label}
          </button>
        ))}
      </div>
      {msg && <p role="status" className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{msg}</p>}
    </div>
  );
}