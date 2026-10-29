import { getOffsetMinutes, now } from "@/lib/shared/clock";

export async function ClockBanner() {
  const offset = await getOffsetMinutes();
  if (offset === 0) return null;
  const at = await now();
  const days = offset / 1440;
  const label = Math.abs(days) >= 1 ? `${days > 0 ? "+" : ""}${Number(days.toFixed(2))} day(s)` : `${offset > 0 ? "+" : ""}${offset} min`;
  return (
    <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-warn-line bg-warn-bg px-3.5 py-2.5 font-mono text-[12px] tracking-wide text-warn">
      Demo clock: {label} (now {at.toLocaleString("en-GB")})
    </p>
  );
}
