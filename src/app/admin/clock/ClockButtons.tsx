"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceClockAction, resetClockAction, type Res } from "@/features/c/actions";

export function ClockButtons() {
  const router = useRouter();
  const [msg, setMsg] = useState<Res | null>(null);
  const [pending, start] = useTransition();
  const run = (f: () => Promise<Res>) =>
    start(async () => {
      setMsg(await f());
      router.refresh();
    });
  const btn = "rounded px-4 py-3 text-white disabled:opacity-50";
  return (
    <div className="flex flex-col gap-3">
      <button disabled={pending} onClick={() => run(() => advanceClockAction(15))} className={`${btn} bg-blue-600`}>+15 minutes</button>
      <button disabled={pending} onClick={() => run(() => advanceClockAction(60))} className={`${btn} bg-blue-700`}>+1 hour</button>
      <button disabled={pending} onClick={() => run(() => advanceClockAction(1440))} className={`${btn} bg-blue-800`}>+1 day</button>
      <button disabled={pending} onClick={() => run(() => resetClockAction())} className={`${btn} bg-gray-700`}>Reset to real time</button>
      {msg && <p role="status" className="text-sm">{msg.message}</p>}
    </div>
  );
}
