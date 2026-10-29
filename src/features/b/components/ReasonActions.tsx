"use client";

import { ReasonButtons } from "./ReasonButtons";
import { approveBooking, rejectBooking, waitlistBooking, revokeAutoApproval, cancelBooking, appealBooking } from "../actions";

export function ReviewActions({ bookingId, supervisors }: { bookingId: string; supervisors?: { id: string; name: string }[] }) {
  return (
    <ReasonButtons
      supervisors={supervisors}
      actions={[
        { label: "Approve", className: "btn-primary flex-1", run: (r, s) => approveBooking(bookingId, r, s) },
        { label: "Waitlist", className: "btn-secondary", run: (r) => waitlistBooking(bookingId, r) },
        { label: "Reject", className: "btn-danger", run: (r) => rejectBooking(bookingId, r) },
      ]}
    />
  );
}

export function RevokeAction({ bookingId }: { bookingId: string }) {
  return <ReasonButtons actions={[{ label: "Revoke approval", className: "btn-danger", run: (r) => revokeAutoApproval(bookingId, r) }]} />;
}

export function CancelAction({ bookingId }: { bookingId: string }) {
  return <ReasonButtons actions={[{ label: "Cancel booking", className: "btn-secondary", run: (r) => cancelBooking(bookingId, r || "Cancelled by the user") }]} />;
}

export function AppealAction({ bookingId }: { bookingId: string }) {
  return <ReasonButtons actions={[{ label: "Appeal decision", className: "btn-primary", run: (r) => appealBooking(bookingId, r) }]} />;
}
