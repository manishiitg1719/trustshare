"use client";

import type { PenaltyStatus } from "@prisma/client";
import { NoteButtons } from "@/features/c/components/NoteButtons";
import { confirmPenalty, dismissPenalty, overturnPenalty } from "@/features/c/actions";

export function PenaltyManagerActions({ id, status }: { id: string; status: PenaltyStatus }) {
  const appealed = status === "APPEALED";
  return (
    <NoteButtons
      buttons={[
        { label: appealed ? "Uphold" : "Confirm", className: "bg-green-600", run: (n) => confirmPenalty(id, n) },
        appealed
          ? { label: "Overturn", className: "bg-gray-700", run: (n) => overturnPenalty(id, n) }
          : { label: "Dismiss", className: "bg-gray-700", run: (n) => dismissPenalty(id, n) },
      ]}
    />
  );
}
