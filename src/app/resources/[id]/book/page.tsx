import { notFound } from "next/navigation";
import { db } from "@/lib/shared/db";
import { requireUser } from "@/lib/shared/auth";
import { BookButton } from "@/features/b/components/BookButton";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const resource = await db.resource.findUnique({ where: { id } });
  if (!resource) notFound();
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Book {resource.name}</h1>
      <BookButton resourceId={resource.id} />
    </div>
  );
}
