// SHARED CONTRACT. Do not edit in a part branch.
// Always use now() instead of new Date() for business logic, so the demo clock works everywhere.
import { db } from "./db";

export async function getOffsetMinutes(): Promise<number> {
  const row = await db.demoClock.findUnique({ where: { id: 1 } });
  return row?.offsetMinutes ?? 0;
}

export async function now(): Promise<Date> {
  return new Date(Date.now() + (await getOffsetMinutes()) * 60_000);
}

/** Moves the demo clock. Only Part C's admin clock page should call this (then run the scheduler). */
export async function advanceClock(minutes: number): Promise<number> {
  const row = await db.demoClock.upsert({
    where: { id: 1 },
    create: { id: 1, offsetMinutes: minutes },
    update: { offsetMinutes: { increment: minutes } },
  });
  return row.offsetMinutes;
}

export async function resetClock(): Promise<void> {
  await db.demoClock.upsert({ where: { id: 1 }, create: { id: 1, offsetMinutes: 0 }, update: { offsetMinutes: 0 } });
}
