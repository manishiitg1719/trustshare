import Link from "next/link";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { fmtDateTime } from "@/lib/shared/format";
import { markNotificationsRead } from "@/features/a/actions";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unread > 0 && (
          <form action={markNotificationsRead}>
            <button className="text-sm text-blue-700 underline">Mark all as read</button>
          </form>
        )}
      </div>

      {notifications.length === 0 && <p className="text-gray-700">No notifications.</p>}
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li key={n.id} className={`rounded border p-4 ${n.readAt ? "bg-white" : "border-blue-300 bg-blue-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={n.readAt ? "text-lg" : "text-lg font-bold"}>{n.title}</div>
                <div className={`mt-1 text-sm text-gray-800 ${n.readAt ? "" : "font-semibold"}`}>{n.body}</div>
              </div>
              <span className="shrink-0 text-xs text-gray-600">{fmtDateTime(n.createdAt)}</span>
            </div>
            {n.link && (
              <Link href={n.link} className="mt-3 inline-block text-sm text-blue-700 underline">
                View details &rarr;
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
