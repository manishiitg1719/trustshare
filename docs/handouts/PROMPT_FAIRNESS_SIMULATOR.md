You are adding one feature, the **Explainable Fairness Simulator**, to an existing hackathon app called TrustShare. TrustShare is a Next.js 15 (App Router, React 19, TypeScript strict, Tailwind v4) + Prisma 6 + PostgreSQL app where a college department shares lab equipment and rooms. The full spec is in `docs/handouts/HANDOUT_FAIRNESS_SIMULATOR.md`. Read it first and follow it exactly. This prompt summarises it and adds the working rules.

## Working rules
- Read these files before writing code: `docs/handouts/HANDOUT_FAIRNESS_SIMULATOR.md`, `src/features/b/rules.ts`, `src/features/b/priority.ts`, `src/features/b/waitlist.ts`, `src/features/b/components/DecisionPanel.tsx`, `src/app/manager/queue/page.tsx`, `src/lib/shared/types.ts`, `src/lib/shared/auth.ts`, `src/lib/shared/clock.ts`, `src/lib/shared/seed.ts`, `src/components/ui.tsx`, `src/app/layout.tsx`, and `prisma/schema.prisma` (read only).
- Reuse what exists: call `evaluateBooking` for eligibility and `calculatePriorityScore` for the current priority. Use `now()` from `src/lib/shared/clock.ts` for "now", never `new Date()` for business logic, because the app has a demo clock.
- **Do not** change `prisma/schema.prisma`, `scripts/`, `.env`, any file in `src/lib/shared/` except `seed.ts`, or anything in `src/features/a/` or `src/features/c/`. **Do not** add npm packages. Use Node's built-in `crypto` for the lottery hash.
- The simulator is **read only**: no server actions, no database writes, and no change to how real bookings are decided.
- Match the existing UI: use `PageHead`, `Icon`, `Avatar`, `RiskBadge` from `src/components/ui.tsx`, the CSS classes `card`, `chip chip-ok`, `chip chip-warn`, `chip chip-bad`, and the color tokens (`text-ink`, `text-ink-2`, `text-ink-3`, `bg-surface`, `bg-surface-2`, `border-line`, `text-brand`, `bg-brand-soft`). The layout is desktop-first (minimum width 1100px).
- Write plain, short, human sentences in the UI and the explanation log. Do not use gendered pronouns for personas; use their names.
- Keep the code style of the surrounding files (2-space indent, double quotes, named exports, comments only where they help).

## What to build
1. **`src/features/b/allocation.ts`**: a pure, deterministic engine with no database access. Export `PolicyId` (`"CURRENT" | "FIFO" | "LEAST_ACCESS" | "RELIABILITY" | "LOTTERY"`), `TieBreak` (`"FIFO" | "LOTTERY"`), `Candidate`, `AllocationResult`, `POLICIES` (id, name, one-line rule) and `allocate(candidates, policy, tieBreak)`. Use the exact types in section 3.6 of the handout.
   - Only eligible candidates are ranked. Ineligible ones go into the log with their failed rules.
   - CURRENT: `priorityScore` desc. FIFO: `requestedAt` asc. LEAST_ACCESS: `hoursLast30d` asc, then `pastBookings` asc. RELIABILITY: `noShows30d + penalties30d` asc. LOTTERY: `lotteryNumber` asc.
   - Remaining ties use the tieBreak: FIFO (earlier `requestedAt`) or LOTTERY (lower `lotteryNumber`). If a tie still remains, use `bookingId` asc so the result is always deterministic.
   - The log is an ordered list of sentences: who was dropped and why, who is eligible, each person's value for the deciding factor, every tie and how it was broken, and the winner plus whether that person would be auto-approved or sent to a manager (`needsReview`).
   - With CURRENT policy and FIFO tie-break, the ranking must equal the live waitlist order (`priorityScore desc, createdAt asc`).
2. **`src/features/b/simulator.ts`**: server-only database loaders (no `"use server"` directive).
   - `findContestedSlots()`: future time windows on one resource with 2 or more overlapping bookings in status REQUESTED, WAITLISTED or APPROVED.
   - `buildCandidates(resourceId, start, end, { seed, includeHolder })`: builds `Candidate[]` as in section 3.2 of the handout. Eligibility comes from `evaluateBooking({ ..., excludeBookingId: booking.id })` ignoring the `no_clash` rule. `failedRules` = labels of failed rules with `onFail: "REJECT"`. `needsReview` = any failed rule with `onFail: "REVIEW"`. `lotteryNumber` = `parseInt(sha256(seed + ":" + bookingId).slice(0, 8), 16)`. When `includeHolder` is false (the default), the APPROVED holder is returned marked as the holder, shown greyed out as "cancelled in this simulation", and not ranked. When true, the holder competes like everyone else.
3. **`src/app/manager/fairness/page.tsx`**: a server component, protected by `requireUser(["MANAGER", "ADMIN"])`, with `export const dynamic = "force-dynamic"`. Controls are a GET form: slot picker (from `findContestedSlots`), tie-break, lottery seed (default = slot start date `YYYY-MM-DD`), and an "Include the current holder as a competitor" checkbox (default off). It also accepts `?resource=<id>&start=<iso>` to preselect a slot. Show:
   - a candidates table with every factor and the eligibility result,
   - one card per policy with the full ranking, the winner highlighted and its "Why" log,
   - a banner saying whether all policies agree or how many different winners there are,
   - the note "The live system uses the Current TrustShare rule. This page changes nothing."
   - If there are no contested slots, show a friendly empty state that says to press Reset demo data on /start.
4. **Links**:
   - In `src/app/layout.tsx`, add `{ href: "/manager/fairness", label: "Fairness simulator" }` to the staff `manage` list.
   - In `DecisionPanel.tsx`, add a staff-only link under the priority formula: `/manager/fairness?resource=<resourceId>&start=<booking.start ISO>`.
   - At the top of `/manager/queue`, add a link to `/manager/fairness`.
5. **Demo data in `src/lib/shared/seed.ts`** (keep every existing id and state):
   - Set explicit `createdAt` on the seminar bookings so Ravi's `b_seminar_w2` was created before Aisha's `b_seminar_w1`.
   - Add `seminarWait3: "b_seminar_w3"` to `IDS.bookings`: a WAITLISTED booking by `u_tom` (not verified) on `r_seminar` for the same slot, `priorityScore` computed or set to 2.
   - Add one RETURNED seminar booking for Ravi within the last 30 days (2 to 3 hours, in the past) so LEAST_ACCESS ranks Aisha above Ravi for a visible reason. Add matching audit rows the same way the file does for other bookings.
   - Create Tom's booking after Aisha's.
   - Result for the seminar slot with the holder not included: CURRENT and LEAST_ACCESS pick Aisha, FIFO and RELIABILITY (tie broken by FIFO) pick Ravi, LOTTERY depends on the seed, and Tom is shown as not eligible.

## Done means
- `npm run typecheck` and `npm run lint` pass with no new errors.
- Every item in section 5 ("Acceptance checklist") of the handout is true.
- At the end, list every file you created or changed, with one line each on what changed, and any assumption you made.
