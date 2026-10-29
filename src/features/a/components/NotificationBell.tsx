// Owned by Part A. Keep the export name and props (see OWNERS.md).
import Link from "next/link";
import { db } from "@/lib/shared/db";
import { Icon } from "@/components/ui";

export async function NotificationBell({ userId }: { userId: string }) {
  const unread = await db.notification.count({ where: { userId, readAt: null } });
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications, ${unread} unread`}
      className="relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <Icon name="bell" size={17} />
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-bad px-1 text-[10px] font-bold leading-[14px] text-white">
          {unread}
        </span>
      )}
    </Link>
  );
}
