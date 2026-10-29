"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appealPenalty, type Res } from "@/features/c/actions";

export function AppealButton({ penaltyId }: { penaltyId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<Res | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <label className="block text-sm">Appeal: why should this be reconsidered? (at least 10 characters)
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="mt-1 block w-full rounded border p-2" />
      </label>
      <button disabled={pending} onClick={() => start(async () => { const r = await appealPenalty(penaltyId, text); setMsg(r); if (r.ok) router.refresh(); })} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Appeal</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.message}</p>}
    </div>
  );
}
