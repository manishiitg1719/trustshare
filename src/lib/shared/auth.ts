// SHARED CONTRACT. Do not edit in a part branch.
// Demo auth: the current user is the id in the "ts_user" cookie, set by the role switcher.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { db } from "./db";

export const USER_COOKIE = "ts_user";

export async function getCurrentUser(): Promise<User | null> {
  const id = (await cookies()).get(USER_COOKIE)?.value;
  if (!id) return null;
  return db.user.findUnique({ where: { id } });
}

/** Use at the top of a page or server action. Redirects to /start if nobody is signed in or the role is not allowed. */
export async function requireUser(roles?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/start");
  if (roles && !roles.includes(user.role)) redirect("/start?denied=1");
  return user;
}

/** Managers and admins can manage any resource; owners only their own; a resource's assigned manager can manage it. */
export function canManageResource(user: User, resource: { ownerId: string; managerId: string | null }): boolean {
  if (user.role === "ADMIN" || user.role === "MANAGER") return true;
  return resource.ownerId === user.id || resource.managerId === user.id;
}

export function isStaff(user: User): boolean {
  return user.role === "MANAGER" || user.role === "ADMIN";
}
