"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Res } from "../actions";

type Btn = { label: string; className: string; run: (note: string) => Promise<Res> };

/** A required note box plus decision buttons. */
export function NoteButtons({ buttons, label = "Note (at least 5 characters)" }: { buttons: Btn[]; label?: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Res | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        {label}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded border p-2" rows={2} />
      </label>
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await b.run(note);
                setMsg(r);
                if (r.ok) {
                  setNote("");
                  router.refresh();
                }
              })
            }
            className={`rounded px-3 py-2 text-sm text-white disabled:opacity-50 ${b.className}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.message}</p>}
    </div>
  );
}
