// SHARED CONTRACT. Do not edit in a part branch.
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "./db";
import type { AuditActionType } from "./types";

export type AuditInput = {
  actorId: string | null; // null = system
  action: AuditActionType;
  entityType: string;
  entityId: string;
  bookingId?: string;
  resourceId?: string;
  reason?: string;
  meta?: Prisma.InputJsonValue;
};

/** Writes one audit entry. Pass the transaction client when inside db.$transaction. */
export async function logAudit(input: AuditInput, tx: Tx = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      bookingId: input.bookingId,
      resourceId: input.resourceId,
      reason: input.reason,
      meta: input.meta ?? {},
    },
  });
}
