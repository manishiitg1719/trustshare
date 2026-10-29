import Link from "next/link";
import { db } from "@/lib/shared/db";
import { requireUser, isStaff } from "@/lib/shared/auth";
import { HistoryTimeline } from "@/features/c/components/HistoryTimeline";
import { ClockBanner } from "@/features/c/components/ClockBanner";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ user?: string; resource?: string }> }) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const staff = isStaff(viewer);
  const [users, resources] = staff
    ? await Promise.all([db.user.findMany({ orderBy: { name: "asc" } }), db.resource.findMany({ orderBy: { name: "asc" } })])
    : [[], []];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <ClockBanner />
      <h1 className="text-3xl font-bold">History</h1>
      {staff && (
        <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
          <label>
            User
            <select name="user" defaultValue={sp.user ?? ""} className="ml-2 rounded border p-1">
              <option value="">Me</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label>
            Resource
            <select name="resource" defaultValue={sp.resource ?? ""} className="ml-2 rounded border p-1">
              <option value="">None</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <button className="rounded bg-gray-800 px-3 py-1 text-white">Show</button>
          <Link href="/history" className="underline">Reset</Link>
        </form>
      )}
      {staff && sp.resource ? <HistoryTimeline resourceId={sp.resource} /> : <HistoryTimeline userId={staff && sp.user ? sp.user : viewer.id} />}
    </div>
  );
}
