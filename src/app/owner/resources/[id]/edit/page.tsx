import { notFound, redirect } from "next/navigation";
import ResourceForm from "@/features/a/components/ResourceForm";
import type { ResourceFormData } from "@/features/a/components/ResourceForm";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["OWNER", "ADMIN"]);
  const resource = await db.resource.findUnique({ where: { id }, include: { requirements: true } });
  if (!resource) notFound();
  if (user.role !== "ADMIN" && resource.ownerId !== user.id) redirect("/start?denied=1");

  const [credentials, managers] = await Promise.all([
    db.credential.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "MANAGER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const initialData: ResourceFormData = {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    description: resource.description,
    location: resource.location,
    photoUrl: resource.photoUrl ?? "",
    managerId: resource.managerId ?? "",
    riskLevel: resource.riskLevel,
    requiresSupervisor: resource.requiresSupervisor,
    externalAllowed: resource.externalAllowed,
    usageRules: resource.usageRules,
    maxHoursPerBooking: resource.maxHoursPerBooking,
    monthlyHourQuota: resource.monthlyHourQuota,
    cooldownDays: resource.cooldownDays,
    openHour: resource.openHour,
    closeHour: resource.closeHour,
    openDays: resource.openDays,
    checklist: resource.checklist,
    credentialIds: resource.requirements.map((r) => r.credentialId),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit resource</h1>
      <ResourceForm initialData={initialData} credentials={credentials} managers={managers} canPublish />
    </div>
  );
}
