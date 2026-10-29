// SHARED CONTRACT.
import type { BookingStatus } from "@prisma/client";
import { STATUS_LABEL, STATUS_TONE } from "./format";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${STATUS_TONE[status]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
