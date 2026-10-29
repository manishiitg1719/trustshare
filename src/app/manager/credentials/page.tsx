// Owned by Part A: manager queue of pending credential submissions.
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { verifyCredential, rejectCredential } from "@/features/a/actions";

export default async function ManagerCredentials({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await requireUser(["MANAGER", "ADMIN"]);
  const pending = await db.userCredential.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: true, credential: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Credential queue</h1>
      {error === "note" && (
        <p role="alert" className="rounded bg-red-100 p-3 text-red-900">
          A note is required when rejecting a credential.
        </p>
      )}
      {pending.length === 0 && <p className="text-gray-700">No pending submissions.</p>}
      <ul className="grid gap-4">
        {pending.map((uc) => {
          const evidence = uc.evidence ?? "";
          const isImage = evidence.startsWith("data:image/");
          const isLink = /^https?:\/\//i.test(evidence);
          return (
            <li key={uc.id} className="space-y-4 rounded border bg-white p-4 sm:p-6">
              <div>
                <h2 className="text-lg font-bold">{uc.user.name}</h2>
                <p className="text-gray-800">{uc.credential.name}</p>
                <p className="text-xs text-gray-600">Valid for {uc.credential.validMonths} months once verified</p>
                {isImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={evidence} alt={`Evidence from ${uc.user.name}`} className="mt-2 max-h-64 rounded border object-contain" />
                )}
                {isLink && (
                  <a href={evidence} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-blue-700 underline">
                    Open evidence link
                  </a>
                )}
                {!isImage && !isLink && <p className="mt-2 text-sm text-gray-600">No evidence attached.</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <form action={verifyCredential} className="space-y-2">
                  <input type="hidden" name="id" value={uc.id} />
                  <label htmlFor={`v-${uc.id}`} className="block text-sm font-medium">Note (optional)</label>
                  <input id={`v-${uc.id}`} name="note" className="block w-full rounded border border-gray-400 px-3 py-2" />
                  <button className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800">Verify</button>
                </form>
                <form action={rejectCredential} className="space-y-2">
                  <input type="hidden" name="id" value={uc.id} />
                  <label htmlFor={`r-${uc.id}`} className="block text-sm font-medium">Reason for rejecting (required)</label>
                  <input id={`r-${uc.id}`} name="note" required className="block w-full rounded border border-gray-400 px-3 py-2" />
                  <button className="rounded bg-red-700 px-4 py-2 text-white hover:bg-red-800">Reject</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
