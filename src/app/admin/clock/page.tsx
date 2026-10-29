import { requireUser } from "@/lib/shared/auth";
import { getOffsetMinutes, now } from "@/lib/shared/clock";
import { ClockButtons } from "./ClockButtons";

export const dynamic = "force-dynamic";

export default async function AdminClockPage() {
  await requireUser(["ADMIN", "MANAGER"]);
  const [at, offset] = await Promise.all([now(), getOffsetMinutes()]);
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Demo clock</h1>
      <p className="text-lg">Now: <strong>{at.toLocaleString("en-GB")}</strong></p>
      <p className="text-sm text-gray-600">Offset from real time: {offset} minutes. Moving the clock runs the scheduler: reminders, no-shows, overdue returns and credential expiry.</p>
      <ClockButtons />
    </div>
  );
}
