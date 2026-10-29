import ResourceForm from "@/features/a/components/ResourceForm";
import { requireUser } from "@/lib/shared/auth";
import { db } from "@/lib/shared/db";

export default async function NewResourcePage() {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const [credentials, managers] = await Promise.all([
    db.credential.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "MANAGER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const canPublish = user.role === "ADMIN" || user.verified;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Create resource</h1>
      <ResourceForm credentials={credentials} managers={managers} canPublish={canPublish} />
    </div>
  );
}
