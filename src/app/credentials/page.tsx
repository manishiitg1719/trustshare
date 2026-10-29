// Owned by Part A: credentials passport.
import Link from "next/link";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { now } from "@/lib/shared/clock";
import CredentialForm from "@/features/a/components/CredentialForm";

export default async function CredentialsPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  const user = await requireUser();
  const at = await now();

  const [mine, all] = await Promise.all([
    db.userCredential.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { credential: true } }),
    db.credential.findMany({
      orderBy: { name: "asc" },
      include: { resources: { include: { resource: { select: { id: true, name: true, status: true } } } } },
    }),
  ]);
  const unlocks = new Map(
    all.map((c) => [c.id, c.resources.map((r) => r.resource).filter((r) => r.status !== "ARCHIVED")]),
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">My credentials</h1>

      {mine.length === 0 && <p className="text-gray-700">You have no credentials yet. Request one below.</p>}

      <ul className="grid gap-4 md:grid-cols-2">
        {mine.map((uc) => {
          const expired = uc.status === "VERIFIED" && !!uc.expiresAt && uc.expiresAt < at;
          const daysLeft = uc.expiresAt ? Math.ceil((uc.expiresAt.getTime() - at.getTime()) / 86_400_000) : null;
          const soon = uc.status === "VERIFIED" && !expired && daysLeft !== null && daysLeft <= 30;
          const badge = expired
            ? "bg-red-100 text-red-900"
            : uc.status === "VERIFIED"
              ? "bg-green-100 text-green-900"
              : uc.status === "REJECTED"
                ? "bg-red-100 text-red-900"
                : "bg-yellow-100 text-yellow-900";
          const unlocked = unlocks.get(uc.credentialId) ?? [];
          return (
            <li key={uc.id} className="space-y-2 rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <strong className="text-lg">{uc.credential.name}</strong>
                <span className={`shrink-0 rounded px-2 py-1 text-xs ${badge}`}>{expired ? "Expired" : uc.status.toLowerCase()}</span>
              </div>
              {uc.issuedAt && <p className="text-sm text-gray-700">Issued: {uc.issuedAt.toLocaleDateString("en-GB")}</p>}
              {uc.expiresAt && (
                <p className={`text-sm ${expired ? "font-medium text-red-700" : soon ? "font-medium text-amber-800" : "text-gray-700"}`}>
                  {expired
                    ? `Expired on ${uc.expiresAt.toLocaleDateString("en-GB")}`
                    : soon
                      ? `Expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`
                      : `Expires: ${uc.expiresAt.toLocaleDateString("en-GB")}`}
                </p>
              )}
              {uc.status === "REJECTED" && uc.reviewNote && <p className="text-sm text-red-800">Reason: {uc.reviewNote}</p>}
              {(expired || uc.status === "REJECTED") && (
                <Link href={`/credentials?request=${uc.credentialId}`} className="text-sm text-blue-700 underline">
                  Request again
                </Link>
              )}
              <p className="text-sm text-gray-800">
                Unlocks:{" "}
                {unlocked.length ? (
                  unlocked.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ", "}
                      <Link href={`/resources/${r.id}`} className="text-blue-700 underline">{r.name}</Link>
                    </span>
                  ))
                ) : (
                  "nothing yet"
                )}
              </p>
            </li>
          );
        })}
      </ul>

      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Request a credential</h2>
        <CredentialForm credentials={all.map((c) => ({ id: c.id, name: c.name }))} defaultSelected={request} />
      </section>
    </div>
  );
}
