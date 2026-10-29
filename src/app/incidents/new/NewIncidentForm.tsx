"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIncident } from "@/features/c/actions";
import { fileToDataUrl } from "@/lib/shared/images";

type Opt = { id: string; label: string };
const TYPES = ["DAMAGE", "DELAY", "NO_SHOW", "MISUSE", "SAFETY", "OTHER"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export function NewIncidentForm(props: { bookingId: string; resourceId: string; bookings: Opt[]; resources: Opt[] }) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(props.bookingId);
  const [resourceId, setResourceId] = useState(props.resourceId);
  const [type, setType] = useState<(typeof TYPES)[number]>("DAMAGE");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("LOW");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await createIncident({ bookingId: bookingId || undefined, resourceId: bookingId ? undefined : resourceId || undefined, type, severity, description, photos });
      setMsg(r.message);
      if (r.ok && r.id) router.push(`/incidents/${r.id}`);
    });
  }

  const field = "mt-1 block w-full rounded border p-2";
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">Booking (optional)
        <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className={field}>
          <option value="">No booking</option>
          {props.bookings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </label>
      {!bookingId && (
        <label className="block text-sm">Resource
          <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className={field} required>
            <option value="">Choose…</option>
            {props.resources.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
      )}
      <label className="block text-sm">Type
        <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} className={field}>
          {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ").toLowerCase()}</option>)}
        </select>
      </label>
      <label className="block text-sm">Severity
        <select value={severity} onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])} className={field}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
      </label>
      <label className="block text-sm">What happened? (at least 10 characters)
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} h-32`} required />
      </label>
      <label className="block text-sm">Photos (up to 4)
        <input type="file" accept="image/*" multiple disabled={photos.length >= 4} className="mt-1 block"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
            setPhotos([...photos, ...(await Promise.all(files.map((f) => fileToDataUrl(f))))]);
            e.target.value = "";
          }} />
        <span className="text-xs text-gray-500">{photos.length} attached</span>
      </label>
      {msg && <p role="status" className="text-sm text-red-700">{msg}</p>}
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{pending ? "Sending…" : "Submit report"}</button>
    </form>
  );
}
