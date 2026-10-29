import Link from "next/link";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";

export default async function OwnerResources() {
  const user = await requireUser(["OWNER", "ADMIN"]);
  const resources = await db.resource.findMany({
    where: user.role === "OWNER" ? { ownerId: user.id } : {},
    orderBy: { name: "asc" },
  });
  const unverified = user.role === "OWNER" && !user.verified;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My listings</h1>
        <Link href="/owner/resources/new" className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800">
          Create resource
        </Link>
      </div>

      {unverified && (
        <p role="status" className="rounded border border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
          Your owner account is waiting for admin verification. You cannot publish resources yet.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">Location</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {resources.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-gray-700">No listings yet.</td>
              </tr>
            )}
            {resources.map((res) => (
              <tr key={res.id}>
                <td className="px-4 py-3">
                  <Link href={`/resources/${res.id}`} className="text-blue-700 underline">{res.name}</Link>
                </td>
                <td className="px-4 py-3">{res.location}</td>
                <td className="px-4 py-3">{res.status.replaceAll("_", " ").toLowerCase()}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/owner/resources/${res.id}/edit`} className="text-blue-700 underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
