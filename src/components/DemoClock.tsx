"use client";
// Floating demo clock pill. Uses the existing clock actions (staff only, same as /admin/clock).
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceClockAction } from "@/features/c/actions";

export function DemoClock({ label, canAdvance }: { label: string; canAdvance: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (m: number) =>
    start(async () => {
      await advanceClockAction(m);
      router.refresh();
    });
  const b = "rounded-[7px] border border-[#44403C] bg-[#292524] px-2 py-1 font-mono text-[11px] font-semibold text-[#E7E5E4] hover:bg-[#3a3532] disabled:opacity-50";
  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[90] flex items-center gap-3 rounded-[14px] bg-ink px-3.5 py-2.5 text-white shadow-lg">
      <span className="font-mono text-[11px] tracking-[.12em] text-[#A8A29E]">DEMO CLOCK</span>
      <span className="font-mono text-[13.5px] font-semibold">{label}</span>
      {canAdvance && (
        <>
          <button type="button" disabled={pending} onClick={() => run(15)} className={b} aria-label="Advance demo clock 15 minutes">+15m</button>
          <button type="button" disabled={pending} onClick={() => run(60)} className={b} aria-label="Advance demo clock 1 hour">+1h</button>
          <button type="button" disabled={pending} onClick={() => run(1440)} className={b} aria-label="Advance demo clock 1 day">+1d</button>
        </>
      )}
    </div>
  );
}
