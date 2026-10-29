// SHARED CONTRACT. Do not edit in a part branch.
// Creates an in-app notification and a simulated email (EmailLog). No real email is sent.
import { db, type Tx } from "./db";
import type { NotificationKindType } from "./types";

export type NotifyInput = {
  userId: string;
  kind: NotificationKindType;
  title: string;
  body: string;
  link?: string; // app path, e.g. /bookings/abc
  email?: boolean; // default true
};

export async function notify(input: NotifyInput, tx: Tx = db): Promise<void> {
  await tx.notification.create({
    data: { userId: input.userId, kind: input.kind, title: input.title, body: input.body, link: input.link },
  });
  if (input.email !== false) {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    if (user) {
      await tx.emailLog.create({ data: { to: user.email, subject: input.title, body: input.body } });
    }
  }
}

/** Notifies the resource's manager (or every MANAGER if none is assigned) and the owner. */
export async function notifyResourceStaff(
  resource: { ownerId: string; managerId: string | null },
  input: Omit<NotifyInput, "userId">,
  tx: Tx = db,
): Promise<void> {
  const ids = new Set<string>([resource.ownerId]);
  if (resource.managerId) ids.add(resource.managerId);
  else (await tx.user.findMany({ where: { role: "MANAGER" }, select: { id: true } })).forEach((u) => ids.add(u.id));
  for (const userId of ids) await notify({ ...input, userId }, tx);
}
