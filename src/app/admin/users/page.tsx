import { Role } from "@prisma/client";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { verifyUser, changeUserRole } from "@/features/a/actions";

export default async function AdminUsers() {
  const admin = await requireUser(["ADMIN"]);
  const users = await db.user.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th scope="col" className="p-3">Name</th>
              <th scope="col" className="p-3">Role</th>
              <th scope="col" className="p-3">Status</th>
              <th scope="col" className="p-3">Verify</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="p-3">
                  {u.name} <span className="text-gray-600">({u.userType.toLowerCase()})</span>
                  <div className="text-xs text-gray-600">{u.email}</div>
                </td>
                <td className="p-3">
                  {u.id === admin.id ? (
                    <span>{u.role} (you)</span>
                  ) : (
                    <form action={changeUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <label htmlFor={`role-${u.id}`} className="sr-only">Role for {u.name}</label>
                      <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="rounded border border-gray-400 p-1">
                        {Object.values(Role).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <button className="rounded border border-gray-400 px-2 py-1 hover:bg-gray-100">Change</button>
                    </form>
                  )}
                </td>
                <td className="p-3">
                  {u.verified ? <span className="text-green-800">Verified</span> : <span className="text-yellow-800">Not verified</span>}
                </td>
                <td className="p-3">
                  {!u.verified && (
                    <form action={verifyUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800">Verify {u.name.split(" ")[0]}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
