import Link from "next/link";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";

const links: { href: string; label: string }[] = [
  { href: "/admin/users", label: "Users and roles" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/emails", label: "Simulated emails" },
  { href: "/admin/clock", label: "Demo clock" },
  { href: "/manager/queue", label: "Booking review queue" },
  { href: "/manager/credentials", label: "Credential verification" },
  { href: "/manager/incidents", label: "Incidents" },
  { href: "/manager/penalties", label: "Penalties" },
  { href: "/owner/resources", label: "Resource listings" },
  { href: "/owner/dashboard", label: "Utilization dashboard" },
];

export default async function AdminDashboard() {
  await requireUser(["ADMIN"]);
  const [unverifiedUsers, pendingCredentials, openIncidents, overdue] = await Promise.all([
    db.user.count({ where: { verified: false } }),
    db.userCredential.count({ where: { status: "PENDING" } }),
    db.incident.count({ where: { status: "OPEN" } }),
    db.booking.count({ where: { status: "OVERDUE" } }),
  ]);
  const counts = [
    { label: "Users waiting for verification", value: unverifiedUsers },
    { label: "Credentials waiting for review", value: pendingCredentials },
    { label: "Open incidents", value: openIncidents },
    { label: "Overdue bookings", value: overdue },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {counts.map((c) => (
          <div key={c.label} className="rounded border bg-white p-4 text-center">
            <dd className="text-3xl font-bold text-blue-700">{c.value}</dd>
            <dt className="text-sm text-gray-700">{c.label}</dt>
          </div>
        ))}
      </dl>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block rounded border bg-white p-4 font-medium text-blue-700 hover:bg-gray-50">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
