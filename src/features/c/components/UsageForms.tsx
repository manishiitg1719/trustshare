"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fileToDataUrl } from "@/lib/shared/images";
import type { ChecklistEntry } from "@/lib/shared/types";
import { processCheckIn, processReturn, disputeBookingAction, closeBookingAction, resolveDisputeAction, type Res } from "../actions";
import { NoteButtons } from "./NoteButtons";

type Answers = Record<string, { ok: boolean | null; note: string }>;

function ChecklistFields({ items, answers, setAnswers }: { items: string[]; answers: Answers; setAnswers: (a: Answers) => void }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const a = answers[item] ?? { ok: null, note: "" };
        return (
          <fieldset key={item} className="rounded border p-2">
            <legend className="px-1 text-sm font-medium">{item}</legend>
            <label className="mr-4 text-sm"><input type="radio" name={`item-${i}`} checked={a.ok === true} onChange={() => setAnswers({ ...answers, [item]: { ...a, ok: true } })} /> OK</label>
            <label className="text-sm"><input type="radio" name={`item-${i}`} checked={a.ok === false} onChange={() => setAnswers({ ...answers, [item]: { ...a, ok: false } })} /> Problem</label>
            <label className="mt-1 block text-xs">
              Note (optional)
              <input value={a.note} onChange={(e) => setAnswers({ ...answers, [item]: { ...a, note: e.target.value } })} className="mt-1 block w-full rounded border p-1 text-sm" />
            </label>
          </fieldset>
        );
      })}
    </div>
  );
}

function PhotoPicker({ photos, setPhotos }: { photos: string[]; setPhotos: (p: string[]) => void }) {
  /* eslint-disable @next/next/no-img-element */
  return (
    <div>
      <label className="block text-sm">
        Photos (up to 4)
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={photos.length >= 4}
          className="mt-1 block text-sm"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
            const urls = await Promise.all(files.map((f) => fileToDataUrl(f)));
            setPhotos([...photos, ...urls]);
            e.target.value = "";
          }}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative">
            <img src={p} alt={`Upload ${i + 1}`} className="h-20 w-20 rounded border object-cover" />
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos(photos.filter((_, k) => k !== i))} className="absolute right-0 top-0 rounded bg-black/70 px-1 text-xs text-white">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function toEntries(items: string[], answers: Answers): ChecklistEntry[] | null {
  const out: ChecklistEntry[] = [];
  for (const item of items) {
    const a = answers[item];
    if (!a || a.ok === null) return null;
    out.push({ item, ok: a.ok, ...(a.note.trim() ? { note: a.note.trim() } : {}) });
  }
  return out;
}

export function CheckInForm(props: {
  bookingId: string;
  items: string[];
  supervisorName: string | null;
  needsSupervisor: boolean;
  viewerIsSupervisor: boolean;
  open: boolean;
  windowText: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [present, setPresent] = useState(false);
  const [msg, setMsg] = useState<Res | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const entries = toEntries(props.items, answers);
    if (!entries) return setMsg({ ok: false, message: "Mark every checklist item OK or Problem." });
    start(async () => {
      const r = await processCheckIn(props.bookingId, { items: entries, photos, notes, supervisorPresent: present });
      setMsg(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-gray-600">{props.windowText}</p>
      {props.needsSupervisor && !props.viewerIsSupervisor && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={present} onChange={(e) => setPresent(e.target.checked)} />
          I am present: {props.supervisorName ?? "no supervisor assigned yet"} (supervisor)
        </label>
      )}
      <ChecklistFields items={props.items} answers={answers} setAnswers={setAnswers} />
      <label className="block text-sm">
        General notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full rounded border p-2" rows={2} />
      </label>
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.message}</p>}
      <button disabled={pending || !props.open} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Complete check-in"}
      </button>
    </form>
  );
}

export function ReturnForm({ bookingId, items, okAtCheckIn }: { bookingId: string; items: string[]; okAtCheckIn: string[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [damage, setDamage] = useState("");
  const [msg, setMsg] = useState<Res | null>(null);
  const [pending, start] = useTransition();

  const changed = items.filter((i) => answers[i]?.ok === false && okAtCheckIn.includes(i));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const entries = toEntries(items, answers);
    if (!entries) return setMsg({ ok: false, message: "Mark every checklist item OK or Problem." });
    start(async () => {
      const r = await processReturn(bookingId, { items: entries, photos, notes, damageDescription: damage });
      setMsg(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <ChecklistFields items={items} answers={answers} setAnswers={setAnswers} />
      {changed.length > 0 && (
        <label className="block text-sm font-medium text-red-700">
          These were OK at check-in but not now ({changed.join(", ")}). What happened?
          <textarea value={damage} onChange={(e) => setDamage(e.target.value)} className="mt-1 block w-full rounded border p-2" rows={2} />
        </label>
      )}
      <label className="block text-sm">
        General notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full rounded border p-2" rows={2} />
      </label>
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.message}</p>}
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{pending ? "Saving…" : "Complete return"}</button>
    </form>
  );
}

export function ReviewActions({ bookingId, mode }: { bookingId: string; mode: "STAFF_RETURNED" | "USER_RETURNED" | "STAFF_DISPUTED" }) {
  if (mode === "STAFF_RETURNED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <CloseButton bookingId={bookingId} />
        <a href={`/incidents/new?bookingId=${bookingId}`} className="rounded bg-red-600 px-3 py-2 text-sm text-white">Raise an issue</a>
      </div>
    );
  }
  if (mode === "USER_RETURNED") {
    return <NoteButtons label="Dispute a damage finding: explain your side (at least 10 characters)" buttons={[{ label: "Dispute", className: "bg-orange-600", run: (n) => disputeBookingAction(bookingId, n) }]} />;
  }
  return (
    <NoteButtons
      label="Resolution note (at least 5 characters)"
      buttons={[
        { label: "Uphold finding and close", className: "bg-red-700", run: (n) => resolveDisputeAction(bookingId, n, "UPHOLD_FINDING") },
        { label: "Overturn finding and close", className: "bg-green-700", run: (n) => resolveDisputeAction(bookingId, n, "OVERTURN_FINDING") },
      ]}
    />
  );
}

function CloseButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Res | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        disabled={pending}
        onClick={() => start(async () => { const r = await closeBookingAction(bookingId); setMsg(r); if (r.ok) router.refresh(); })}
        className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        Close (no issues)
      </button>
      {msg && <span role="status" className="text-sm">{msg.message}</span>}
    </>
  );
}
