import type { Prisma } from "@prisma/client";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { fmtDateTime } from "@/lib/shared/format";
import { AuditAction } from "@/lib/shared/types";

type Params = { action?: string; actor?: string; from?: string; to?: string };
const field = "rounded border border-gray-400 bg-white px-2 py-1.5";

function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { action, actor, from, to } = await searchParams;
  await requireUser(["ADMIN"]);

  const fromDate = parseDay(from);
  const toDate = parseDay(to);
  if (toDate) toDate.setDate(toDate.getDate() + 1); // include the whole "to" day

  const where: Prisma.AuditLogWhereInput = {
    action: action || undefined,
    actorId: actor === "system" ? null : actor || undefined,
    createdAt: fromDate || toDate ? { gte: fromDate ?? undefined, lt: toDate ?? undefined } : undefined,
  };

  const [logs, users] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { actor: true } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm text-gray-700">Read-only. Newest first, up to 200 entries.</p>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded border bg-white p-3 text-sm">
        <div>
          <label htmlFor="action" className="block font-medium">Action</label>
          <select id="action" name="action" defaultValue={action ?? ""} className={field}>
            <option value="">All</option>
            {Object.values(AuditAction).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="actor" className="block font-medium">Actor</label>
          <select id="actor" name="actor" defaultValue={actor ?? ""} className={field}>
            <option value="">All</option>
            <option value="system">System</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="block font-medium">From</label>
          <input id="from" type="date" name="from" defaultValue={from} className={field} />
        </div>
        <div>
          <label htmlFor="to" className="block font-medium">To</label>
          <input id="to" type="date" name="to" defaultValue={to} className={field} />
        </div>
        <button className="rounded bg-blue-700 px-4 py-1.5 text-white hover:bg-blue-800">Filter</button>
      </form>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th scope="col" className="p-3">Time</th>
              <th scope="col" className="p-3">Actor</th>
              <th scope="col" className="p-3">Action</th>
              <th scope="col" className="p-3">Entity</th>
              <th scope="col" className="p-3">Reason / details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-gray-700">No entries match.</td>
              </tr>
            )}
            {logs.map((log) => {
              const meta = JSON.stringify(log.meta);
              return (
                <tr key={log.id}>
                  <td className="whitespace-nowrap p-3 text-gray-700">{fmtDateTime(log.createdAt)}</td>
                  <td className="p-3">{log.actor?.name ?? "System"}</td>
                  <td className="p-3 font-mono text-xs">{log.action}</td>
                  <td className="p-3">{log.entityType} <span className="text-xs text-gray-600">{log.entityId}</span></td>
                  <td className="p-3">
                    {log.reason}
                    {meta !== "{}" && <div className="font-mono text-xs text-gray-600">{meta}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
