"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { preCheckBooking, createBooking } from "../actions";
import type { RuleResult } from "@/lib/shared/types";

export function BookButton({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [purpose, setPurpose] = useState("");
  const [results, setResults] = useState<RuleResult[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  // Live pre-check whenever the times change (uses the new values, not stale state).
  useEffect(() => {
    if (!start || !end) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await preCheckBooking({
        resourceId,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      });
      if (!cancelled) setResults(res?.results ?? []);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [start, end, resourceId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    startTransition(async () => {
      const res = await createBooking({
        resourceId,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        purpose,
      });
      if (res.results) setResults(res.results);
      setMessage(res.message);
      if (res.ok && res.bookingId) router.push(`/bookings/${res.bookingId}`);
    });
  }

  return (
    <div className="card card-pad shadow-md">
      <h3 className="mb-3.5 font-display text-[18px] font-semibold">Book a slot</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="bk-start" className="field-label">Start</label>
          <input id="bk-start" type="datetime-local" step={900} value={start} onChange={(e) => setStart(e.target.value)} className="w-full" required />
        </div>
        <div>
          <label htmlFor="bk-end" className="field-label">End</label>
          <input id="bk-end" type="datetime-local" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className="w-full" required />
        </div>
        <div>
          <label htmlFor="bk-purpose" className="field-label">Purpose (at least 10 characters)</label>
          <textarea id="bk-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} minLength={10} rows={3} className="w-full" required />
        </div>

        {results.length > 0 && (
          <ul className="space-y-2 rounded-xl border border-line bg-surface-2 p-3 text-[12.5px]">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`check-ic !h-[18px] !w-[18px] ${r.passed ? "" : "fail"}`} aria-hidden>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    {r.passed ? <path d="M20 6 9 17l-5-5" /> : <path d="M18 6 6 18M6 6l12 12" />}
                  </svg>
                </span>
                <span className="sr-only">{r.passed ? "Passed:" : "Failed:"}</span>
                <span>
                  <strong className="text-ink">{r.label}:</strong> <span className="text-ink-2">{r.detail}</span>
                  {!r.passed && r.fix && <span className="block font-medium text-brand">Fix: {r.fix}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {message && <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-[13px] font-medium text-brand-deep">{message}</p>}

        <button type="submit" disabled={pending} className="btn btn-primary btn-block">
          {pending ? "Submitting…" : "Request booking"}
        </button>
      </form>
    </div>
  );
}