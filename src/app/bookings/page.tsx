import Link from "next/link";
import { db } from "@/lib/shared/db";
import { requireUser, isStaff } from "@/lib/shared/auth";
import { now } from "@/lib/shared/clock";
import { fmtRange } from "@/lib/shared/format";
import { StatusBadge } from "@/lib/shared/StatusBadge";
import { Icon, PageHead, RiskBadge } from "@/components/ui";

export default async function MyBookings({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await requireUser();
  const { all } = await searchParams;
  const showAll = all === "1" && isStaff(user);
  const at = await now();

  const bookings = await db.booking.findMany({
    where: showAll ? {} : { userId: user.id },
    include: { resource: true, user: true },
    orderBy: { start: "asc" },
  });

  const groups = {
    Upcoming: bookings.filter((b) => ["REQUESTED", "APPROVED"].includes(b.status) && b.end > at),
    Waitlisted: bookings.filter((b) => b.status === "WAITLISTED"),
    "In use": bookings.filter((b) => ["CHECKED_IN", "OVERDUE"].includes(b.status)),
    Past: bookings.filter((b) => ["REJECTED", "CANCELLED", "RETURNED", "CLOSED", "DISPUTED", "NO_SHOW"].includes(b.status) || (["REQUESTED", "APPROVED"].includes(b.status) && b.end <= at)),
  };

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHead
        title={showAll ? "All bookings" : "My bookings"}
        sub="Every request, decision and return — each with a named human and a reason."
        right={
          isStaff(user) && (
            <Link className="chip hover:bg-surface-2" href={showAll ? "/bookings" : "/bookings?all=1"}>
              {showAll ? "Show only mine" : "Show all bookings"}
            </Link>
          )
        }
      />
      <div className="space-y-7">
        {Object.entries(groups).map(([title, list]) => (
          <section key={title}>
            <div className="mb-2.5 flex items-center gap-2">
              <h2 className="text-[18px] font-semibold">{title}</h2>
              <span className="chip">{list.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {list.map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}`} className="card card-hover flex items-center gap-3.5 p-3.5">
                  {b.resource.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.resource.photoUrl} alt="" className="h-14 w-[74px] shrink-0 rounded-[10px] border border-line object-cover" />
                  ) : (
                    <span className="flex h-14 w-[74px] shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand-line"><Icon name="shieldCheck" size={26} /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold">
                      {b.resource.name}
                      {showAll && <span className="font-medium text-ink-3"> · {b.user.name}</span>}
                    </h3>
                    <p className="mt-0.5 truncate font-mono text-[11px] uppercase text-ink-3">{fmtRange(b.start, b.end)}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <StatusBadge status={b.status} />
                      <RiskBadge level={b.resource.riskLevel} />
                    </div>
                  </div>
                  <Icon name="arrow" className="text-ink-3" />
                </Link>
              ))}
              {list.length === 0 && <p className="col-span-2 rounded-xl border border-dashed border-line-2 px-4 py-5 text-center text-[13px] text-ink-3">Nothing here.</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}