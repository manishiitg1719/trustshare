# Who owns which file

Each builder edits only their own files. Shared files change only by agreement with Mamba, and then the same change goes to everyone.

| Area | Owner | Files |
|---|---|---|
| Shared contracts | Nobody (frozen) | `prisma/schema.prisma`, `scripts/*`, `src/lib/shared/**`, `prisma/seed.ts` |
| Part A: foundation, listings, discovery, credentials, admin | Builder A | `src/features/a/**`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/start/**`, `src/app/resources/page.tsx`, `src/app/resources/[id]/page.tsx`, `src/app/owner/**`, `src/app/credentials/**`, `src/app/manager/credentials/**`, `src/app/notifications/**`, `src/app/privacy/**`, `src/app/admin/page.tsx`, `src/app/admin/users/**`, `src/app/admin/audit/**`, `src/app/admin/emails/**` |
| Part B: booking engine, fairness, approvals | Builder B | `src/features/b/**`, `src/app/resources/[id]/book/**`, `src/app/bookings/**`, `src/app/manager/queue/**`, `src/app/manager/extensions/**` |
| Part C: check-in/out, incidents, penalties, history, demo clock | Builder C | `src/features/c/**`, `src/app/checkin/**`, `src/app/incidents/**`, `src/app/manager/incidents/**`, `src/app/penalties/**`, `src/app/manager/penalties/**`, `src/app/history/**`, `src/app/admin/clock/**` |

## Cross-part components (stubs in the starter kit)

| Export | File | Owner | Used by |
|---|---|---|---|
| `BookButton({ resourceId })` | `src/features/b/components/BookButton.tsx` | B | A's resource page |
| `DecisionPanel({ bookingId })` | `src/features/b/components/DecisionPanel.tsx` | B | B's booking page |
| `promoteWaitlist(resourceId, actorId, tx?)` | `src/features/b/waitlist.ts` | B | C (no-show, cancellations from out-of-service) |
| `UsagePanel({ bookingId })` | `src/features/c/components/UsagePanel.tsx` | C | B's booking page |
| `HistoryTimeline({ bookingId?, resourceId?, userId? })` | `src/features/c/components/HistoryTimeline.tsx` | C | B's booking page, A's resource and admin pages |
| `NotificationBell({ userId })` | `src/features/a/components/NotificationBell.tsx` | A | A's layout |

Never rename these exports or change their props. Replace the body only.
