"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import type { Prisma, ResourceType, RiskLevel, User } from "@prisma/client";
import { db } from "@/lib/shared/db";
import { logAudit } from "@/lib/shared/audit";
import { notify } from "@/lib/shared/notify";
import { now } from "@/lib/shared/clock";
import { requireUser } from "@/lib/shared/auth";
import { AuditAction, NotificationKind } from "@/lib/shared/types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type ResourceInput = {
  name: string;
  type: string;
  description: string;
  location: string;
  photoUrl: string;
  managerId: string;
  riskLevel: string;
  requiresSupervisor: boolean;
  externalAllowed: boolean;
  usageRules: string;
  maxHoursPerBooking: number;
  monthlyHourQuota: number;
  cooldownDays: number;
  openHour: number;
  closeHour: number;
  openDays: number[];
  checklist: string[];
  credentialIds: string[];
};

const RESOURCE_TYPES: ResourceType[] = ["SPACE", "EQUIPMENT", "DEVICE", "TOOL"];
const RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

type CleanResource = Omit<ResourceInput, "type" | "riskLevel" | "managerId" | "photoUrl"> & {
  type: ResourceType;
  riskLevel: RiskLevel;
  managerId: string | null;
  photoUrl: string | null;
};

/* ------------------------------------------------------------------ */
/* Helpers (not exported: a "use server" file may only export actions) */
/* ------------------------------------------------------------------ */

function validateResource(input: ResourceInput): { ok: true; data: CleanResource } | { ok: false; error: string } {
  const name = input.name.trim();
  const description = input.description.trim();
  const location = input.location.trim();
  if (!name) return { ok: false, error: "Name is required" };
  if (!description) return { ok: false, error: "Description is required" };
  if (!location) return { ok: false, error: "Location is required" };
  if (!RESOURCE_TYPES.includes(input.type as ResourceType)) return { ok: false, error: "Pick a valid type" };
  if (!RISK_LEVELS.includes(input.riskLevel as RiskLevel)) return { ok: false, error: "Pick a valid risk level" };

  const ints = [input.maxHoursPerBooking, input.monthlyHourQuota, input.cooldownDays, input.openHour, input.closeHour];
  if (ints.some((n) => !Number.isInteger(n))) return { ok: false, error: "Hours, quota and cooldown must be whole numbers" };
  if (input.openHour < 0 || input.openHour > 23) return { ok: false, error: "Opening hour must be between 0 and 23" };
  if (input.closeHour <= input.openHour) return { ok: false, error: "Closing hour must be after the opening hour" };
  if (input.closeHour > 24) return { ok: false, error: "Closing hour cannot be after 24" };
  if (input.maxHoursPerBooking < 1) return { ok: false, error: "Max hours per booking must be at least 1" };
  if (input.monthlyHourQuota < 1) return { ok: false, error: "Monthly hour quota must be at least 1" };
  if (input.cooldownDays < 0) return { ok: false, error: "Cooldown days cannot be negative" };

  const openDays = [...new Set(input.openDays)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (openDays.length === 0) return { ok: false, error: "Pick at least one open day" };

  const checklist = input.checklist.map((c) => c.trim()).filter(Boolean);
  if (checklist.length === 0) return { ok: false, error: "Add at least one condition checklist item" };

  return {
    ok: true,
    data: {
      name,
      type: input.type as ResourceType,
      description,
      location,
      photoUrl: input.photoUrl.trim() || null,
      managerId: input.managerId || null,
      riskLevel: input.riskLevel as RiskLevel,
      requiresSupervisor: input.requiresSupervisor,
      externalAllowed: input.externalAllowed,
      usageRules: input.usageRules.trim(),
      maxHoursPerBooking: input.maxHoursPerBooking,
      monthlyHourQuota: input.monthlyHourQuota,
      cooldownDays: input.cooldownDays,
      openHour: input.openHour,
      closeHour: input.closeHour,
      openDays,
      checklist,
      credentialIds: [...new Set(input.credentialIds)],
    },
  };
}

async function checkManager(managerId: string | null): Promise<string | null> {
  if (!managerId) return null;
  const m = await db.user.findFirst({ where: { id: managerId, role: "MANAGER" } });
  return m ? null : "The chosen manager is not a manager account";
}

/** Owners may only touch their own resources; admins may touch all. */
function canEditListing(user: User, resource: { ownerId: string }): boolean {
  return user.role === "ADMIN" || resource.ownerId === user.id;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formString(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export async function markNotificationsRead(): Promise<void> {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: await now() },
  });
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export async function createResource(input: ResourceInput): Promise<ActionResult> {
  const user = await requireUser(["OWNER", "ADMIN"]);
  if (user.role === "OWNER" && !user.verified) {
    return { ok: false, error: "Your owner account is waiting for admin verification" };
  }
  const parsed = validateResource(input);
  if (!parsed.ok) return parsed;
  const managerError = await checkManager(parsed.data.managerId);
  if (managerError) return { ok: false, error: managerError };

  const { credentialIds, ...data } = parsed.data;
  const resource = await db.$transaction(async (tx) => {
    const created = await tx.resource.create({
      data: {
        ...data,
        ownerId: user.id,
        status: "ACTIVE",
        requirements: { create: credentialIds.map((credentialId) => ({ credentialId })) },
      },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.RESOURCE_CREATED,
        entityType: "Resource",
        entityId: created.id,
        resourceId: created.id,
        meta: { fields: Object.keys(input) },
      },
      tx,
    );
    return created;
  });

  revalidatePath("/owner/resources");
  revalidatePath("/resources");
  return { ok: true, id: resource.id };
}

export async function updateResource(id: string, input: ResourceInput): Promise<ActionResult> {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const existing = await db.resource.findUnique({ where: { id }, include: { requirements: true } });
  if (!existing) return { ok: false, error: "Resource not found" };
  if (!canEditListing(user, existing)) return { ok: false, error: "You can only edit your own resources" };

  const parsed = validateResource(input);
  if (!parsed.ok) return parsed;
  const managerError = await checkManager(parsed.data.managerId);
  if (managerError) return { ok: false, error: managerError };

  const { credentialIds, ...data } = parsed.data;

  const changed: string[] = [];
  const before = existing as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(data)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) changed.push(key);
  }
  const oldCreds = existing.requirements.map((r) => r.credentialId).sort();
  if (JSON.stringify(oldCreds) !== JSON.stringify([...credentialIds].sort())) changed.push("requiredCredentials");

  await db.$transaction(async (tx) => {
    await tx.resource.update({ where: { id }, data });
    await tx.resourceCredential.deleteMany({ where: { resourceId: id } });
    if (credentialIds.length) {
      await tx.resourceCredential.createMany({ data: credentialIds.map((credentialId) => ({ resourceId: id, credentialId })) });
    }
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.RESOURCE_UPDATED,
        entityType: "Resource",
        entityId: id,
        resourceId: id,
        meta: { changed },
      },
      tx,
    );
  });

  revalidatePath(`/resources/${id}`);
  revalidatePath("/resources");
  revalidatePath("/owner/resources");
  return { ok: true, id };
}

export async function archiveResource(id: string): Promise<ActionResult> {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const existing = await db.resource.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Resource not found" };
  if (!canEditListing(user, existing)) return { ok: false, error: "You can only archive your own resources" };

  await db.$transaction(async (tx) => {
    await tx.resource.update({ where: { id }, data: { status: "ARCHIVED" } });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.RESOURCE_UPDATED,
        entityType: "Resource",
        entityId: id,
        resourceId: id,
        reason: "Archived",
        meta: { changed: ["status"] },
      },
      tx,
    );
  });

  revalidatePath("/resources");
  revalidatePath("/owner/resources");
  return { ok: true, id };
}

/* ------------------------------------------------------------------ */
/* Credentials                                                         */
/* ------------------------------------------------------------------ */

export async function requestCredential(credentialId: string, evidence: string): Promise<ActionResult> {
  const user = await requireUser();
  const proof = evidence.trim();
  if (!proof) return { ok: false, error: "Add a photo or a link as evidence" };
  if (!proof.startsWith("data:image/") && !/^https?:\/\//i.test(proof)) {
    return { ok: false, error: "Evidence must be an image or a link starting with http(s)://" };
  }
  const credential = await db.credential.findUnique({ where: { id: credentialId } });
  if (!credential) return { ok: false, error: "Credential not found" };

  const alreadyPending = await db.userCredential.findFirst({ where: { userId: user.id, credentialId, status: "PENDING" } });
  if (alreadyPending) return { ok: false, error: "You already have a pending request for this credential" };

  const uc = await db.$transaction(async (tx) => {
    const created = await tx.userCredential.create({
      data: { userId: user.id, credentialId, status: "PENDING", evidence: proof },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.CREDENTIAL_SUBMITTED,
        entityType: "UserCredential",
        entityId: created.id,
        meta: { credential: credential.name },
      },
      tx,
    );
    const managers = await tx.user.findMany({ where: { role: "MANAGER" }, select: { id: true } });
    for (const m of managers) {
      await notify(
        {
          userId: m.id,
          kind: NotificationKind.CREDENTIAL,
          title: "New credential to verify",
          body: `${user.name} submitted evidence for "${credential.name}".`,
          link: "/manager/credentials",
        },
        tx,
      );
    }
    return created;
  });

  revalidatePath("/credentials");
  revalidatePath("/manager/credentials");
  return { ok: true, id: uc.id };
}

export async function verifyCredential(formData: FormData): Promise<void> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  const id = formString(formData, "id");
  const note = formString(formData, "note");
  const uc = await db.userCredential.findUnique({ where: { id }, include: { credential: true } });
  if (!uc || uc.status !== "PENDING") redirect("/manager/credentials");

  const at = await now();
  await db.$transaction(async (tx) => {
    await tx.userCredential.update({
      where: { id },
      data: {
        status: "VERIFIED",
        issuedAt: at,
        expiresAt: addMonths(at, uc.credential.validMonths),
        verifiedById: user.id,
        reviewNote: note || null,
      },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.CREDENTIAL_VERIFIED,
        entityType: "UserCredential",
        entityId: id,
        reason: note || undefined,
        meta: { userId: uc.userId, credential: uc.credential.name },
      },
      tx,
    );
    await notify(
      {
        userId: uc.userId,
        kind: NotificationKind.CREDENTIAL,
        title: "Credential verified",
        body: `"${uc.credential.name}" is verified. Resources that need it are now unlocked.`,
        link: "/credentials",
      },
      tx,
    );
  });

  revalidatePath("/manager/credentials");
  revalidatePath("/credentials");
  revalidatePath("/resources", "layout");
}

export async function rejectCredential(formData: FormData): Promise<void> {
  const user = await requireUser(["MANAGER", "ADMIN"]);
  const id = formString(formData, "id");
  const note = formString(formData, "note");
  if (!note) redirect("/manager/credentials?error=note");

  const uc = await db.userCredential.findUnique({ where: { id }, include: { credential: true } });
  if (!uc || uc.status !== "PENDING") redirect("/manager/credentials");

  await db.$transaction(async (tx) => {
    await tx.userCredential.update({
      where: { id },
      data: { status: "REJECTED", reviewNote: note, verifiedById: user.id },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.CREDENTIAL_REJECTED,
        entityType: "UserCredential",
        entityId: id,
        reason: note,
        meta: { userId: uc.userId, credential: uc.credential.name },
      },
      tx,
    );
    await notify(
      {
        userId: uc.userId,
        kind: NotificationKind.CREDENTIAL,
        title: "Credential not accepted",
        body: `"${uc.credential.name}" was not accepted. Reason: ${note}`,
        link: "/credentials",
      },
      tx,
    );
  });

  revalidatePath("/manager/credentials");
  revalidatePath("/credentials");
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function verifyUser(formData: FormData): Promise<void> {
  const admin = await requireUser(["ADMIN"]);
  const id = formString(formData, "id");
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.verified) return;

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { verified: true } });
    await logAudit(
      { actorId: admin.id, action: AuditAction.USER_VERIFIED, entityType: "User", entityId: id, meta: { name: target.name, role: target.role } },
      tx,
    );
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function changeUserRole(formData: FormData): Promise<void> {
  const admin = await requireUser(["ADMIN"]);
  const id = formString(formData, "id");
  const newRole = formString(formData, "role");
  if (!(Object.values(Role) as string[]).includes(newRole)) return;
  if (id === admin.id && newRole !== "ADMIN") return; // an admin cannot remove their own admin role

  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.role === newRole) return;

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { role: newRole as Role } });
    await logAudit(
      {
        actorId: admin.id,
        action: AuditAction.USER_ROLE_CHANGED,
        entityType: "User",
        entityId: id,
        meta: { from: target.role, to: newRole } satisfies Prisma.InputJsonObject,
      },
      tx,
    );
  });
  revalidatePath("/admin/users");
}
