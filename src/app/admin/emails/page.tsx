import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { fmtDateTime } from "@/lib/shared/format";

export default async function EmailLogPage() {
  await requireUser(["ADMIN"]);
  const emails = await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Email log</h1>
      <p className="text-sm text-gray-700">Simulated emails, nothing is actually sent</p>
      <ul className="divide-y rounded border bg-white">
        {emails.length === 0 && <li className="p-4 text-gray-700">No emails yet.</li>}
        {emails.map((email) => (
          <li key={email.id} className="p-4">
            <div className="mb-1 text-xs text-gray-600">
              {fmtDateTime(email.createdAt)} &middot; To: {email.to}
            </div>
            <div className="font-bold">{email.subject}</div>
            <div className="mt-2 whitespace-pre-wrap text-gray-800">{email.body}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
