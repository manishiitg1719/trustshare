import { db } from "@/lib/shared/db";
import type { ChecklistEntry } from "@/lib/shared/types";
import { getCurrentUser, canManageResource } from "@/lib/shared/auth";
import { fmtDateTime } from "@/lib/shared/format";
import { PhotoDiff } from "./PhotoDiff";

/* eslint-disable @next/next/no-img-element */
export async function ConditionComparison({ bookingId }: { bookingId: string }) {
  const [reports, user, booking, lastReview] = await Promise.all([
    db.conditionReport.findMany({ where: { bookingId }, include: { createdBy: true } }),
    getCurrentUser(),
    db.booking.findUnique({ where: { id: bookingId }, include: { resource: true } }),
    db.auditLog.findFirst({ where: { bookingId, action: "CONDITION_CHANGE_REVIEWED" }, orderBy: { createdAt: "desc" }, include: { actor: true } }),
  ]);
  const before = reports.find((r) => r.phase === "CHECK_IN");
  const after = reports.find((r) => r.phase === "RETURN");
  if (!before && !after) return <p className="text-sm text-gray-500">No condition reports were recorded.</p>;

  const toItems = (r?: { items: unknown }) => ((r?.items ?? []) as ChecklistEntry[]);
  const b = toItems(before);
  const a = toItems(after);
  const names = Array.from(new Set([...b.map((i) => i.item), ...a.map((i) => i.item)]));

  const cell = (e?: ChecklistEntry) =>
    e ? (
      <span>
        <span className={`chip ${e.ok ? "chip-ok" : "chip-bad"}`}>{e.ok ? "OK" : "Problem"}</span>
        {e.note ? <span className="mt-1 block text-xs text-ink-2">{e.note}</span> : null}
      </span>
    ) : (
      <span className="text-gray-400">not recorded</span>
    );

  const canReview = !!user && !!booking && canManageResource(user, booking.resource);
  const reviewMeta = (lastReview?.meta ?? {}) as { verdict?: string };
  const review = lastReview
    ? { verdict: reviewMeta.verdict ?? "", note: lastReview.reason, by: lastReview.actor?.name ?? "A manager", at: fmtDateTime(lastReview.createdAt) }
    : null;
  const canCompare = !!before?.photos.length && !!after?.photos.length;

  return (
    <div className="space-y-4">
      {canCompare && <PhotoDiff bookingId={bookingId} before={before!.photos} after={after!.photos} canReview={canReview} review={review} />}
      <div className="overflow-x-auto">
        <table className="w-full overflow-hidden rounded-xl border border-line text-sm">
          <thead>
            <tr className="bg-surface-2 text-left font-mono text-[11px] uppercase tracking-[.06em]">
              <th className="p-2">Item</th>
              <th className="p-2">At check-in{before ? ` (${before.createdBy.name})` : ""}</th>
              <th className="p-2">At return{after ? ` (${after.createdBy.name})` : ""}</th>
            </tr>
          </thead>
          <tbody>
            {names.map((n) => {
              const x = b.find((i) => i.item === n);
              const y = a.find((i) => i.item === n);
              const changed = !!x && !!y && x.ok !== y.ok;
              return (
                <tr key={n} className={changed ? "bg-bad-bg font-medium" : ""}>
                  <td className="border-t border-line p-2.5">{n}{changed && <span className="risk risk-high ml-2">Changed</span>}</td>
                  <td className="border-t border-line p-2.5">{cell(x)}</td>
                  <td className="border-t border-line p-2.5">{cell(y)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[before, after].map((r, i) => (
          <div key={i}>
            <h4 className="mb-1 text-sm font-semibold"><span className={`chip ${i === 0 ? "chip-ok" : "chip-warn"} mr-2`}>{i === 0 ? "At pickup" : "At return"}</span>{i === 0 ? "Check-in" : "Return"} notes and photos</h4>
            <p className="text-sm text-gray-700">{r?.notes || "No notes."}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {r?.photos.map((src, k) => (
                <img key={k} src={src} alt={`${i === 0 ? "Check-in" : "Return"} photo ${k + 1}`} className="h-28 w-full max-w-[160px] rounded-xl border border-line object-cover" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
