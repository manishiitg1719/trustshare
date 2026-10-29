# Handout: Explainable Fairness Simulator

**Goal:** before a scarce slot is given out, show who qualifies, why one request wins, and let a judge switch the allocation policy and compare who would get access under each one.

**Rule for this feature:** the simulator only reads data. It never approves, rejects or moves a real booking. The live system keeps using today's rules.

---

## 1. What already exists (do not rebuild)

| What | Where | Notes |
|---|---|---|
| Rule engine | `src/features/b/rules.ts` → `evaluateBooking({ userId, resourceId, start, end, excludeBookingId })` | Returns `{ outcome, results: RuleResult[], priorityScore }`. Rules: eligibility (credentials, verified, suspension), in_future, opening_hours, max_duration, active_cap, monthly_quota, cooldown, no_clash (onFail WAITLIST), risk_tier and supervisor (onFail REVIEW). |
| Priority score | `src/features/b/priority.ts` → `calculatePriorityScore(userId, resourceId, excludeBookingId)` and `PRIORITY_FORMULA` | +2 first booking of this resource, +1 under half the monthly quota, −1 per no-show or confirmed penalty in the last 30 days. Ties go to the earlier `createdAt`. |
| Waitlist promotion | `src/features/b/waitlist.ts` → `promoteWaitlist` | Orders by `priorityScore desc, createdAt asc`. |
| Decision explanation for one booking | `src/features/b/components/DecisionPanel.tsx` | Shows the rule results, formula, score and waitlist position. |
| Manager queue | `src/app/manager/queue/page.tsx` | Requests in priority order. |
| Shared types | `src/lib/shared/types.ts` | `RuleResult`, `BookingOutcome`, `FAIRNESS`, `LIVE_STATUSES`, `ACTIVE_STATUSES`. |
| Demo data | `src/lib/shared/seed.ts` | Seminar room A (`r_seminar`) tomorrow 10:00 to 12:00: Lena holds it (`b_seminar_ok`, APPROVED), Aisha (`b_seminar_w1`, score 2) and Ravi (`b_seminar_w2`, score 1) are WAITLISTED. |
| UI kit | `src/components/ui.tsx` (`PageHead`, `Icon`, `Avatar`, `RiskBadge`, `RolePill`), CSS classes `card`, `chip chip-ok/warn/bad`, `risk risk-low/medium/high` in `src/app/globals.css` | Use these so the page matches the rest. |
| Auth | `src/lib/shared/auth.ts` → `requireUser(["MANAGER","ADMIN"])`, `isStaff`, `canManageResource` | |

## 2. What is missing

1. A deterministic allocation engine that can run several **policies**.
2. A **tie-break** that is FIFO or a **transparent lottery** (seeded and repeatable).
3. An **explanation log**: step-by-step sentences of why each request was dropped, ranked, or won.
4. A **comparison dashboard** where a judge picks a contested slot and sees the winner under every policy side by side.
5. Links from the existing screens to the simulator.

## 3. Design

### 3.1 Contested slot
A group of requests for the same resource that overlap one time window. Candidates are bookings on that resource with status `REQUESTED`, `WAITLISTED`, or `APPROVED`, whose `[start, end)` overlaps the window. The page lists contested slots (2 or more overlapping bookings, start in the future) so the judge can pick one.

Option on the page: **"Include the current holder as a competitor"** (default off). When off, the APPROVED holder is shown greyed out as "cancelled in this simulation" and is not ranked, so you see who would get the slot next if it frees up. When on, the holder competes like everyone else, as if the slot were being given out for the first time.

### 3.2 Pipeline (same for every policy)
1. **Eligibility and availability first.** For each candidate call `evaluateBooking({ userId, resourceId, start, end, excludeBookingId: candidate.id })`. Ignore the `no_clash` rule (we are deciding who gets the slot). If any other rule with `onFail: "REJECT"` fails, the candidate is **not eligible**. Record the failed rule labels.
2. **Collect factors** for eligible candidates (read only):
   - `requestedAt` = `createdAt`
   - `priorityScore` = `calculatePriorityScore(...)` (today's live formula)
   - `hoursLast30d` = hours of this user's bookings on this resource with status in `APPROVED, CHECKED_IN, OVERDUE, RETURNED, CLOSED` and start in the last 30 days (by the demo clock `now()`)
   - `pastBookings` = count of such bookings ever
   - `noShows30d`, `penalties30d` (CONFIRMED)
   - `userType` (STUDENT, STAFF, EXTERNAL)
   - `needsReview` = any failed rule with `onFail: "REVIEW"` (still eligible, but the winner would go to a manager instead of being auto-approved)
3. **Apply the policy** to get a sort key.
4. **Break ties** with the chosen tie-break.
5. **Winner** = first in the ranking (capacity is 1 for all current resources).

### 3.3 Policies
| Id | Name | Rule (higher ranks first unless stated) |
|---|---|---|
| `CURRENT` | Current TrustShare rule | `priorityScore` desc. This must match what the live waitlist does. |
| `FIFO` | First come, first served | `requestedAt` asc only. |
| `LEAST_ACCESS` | Least access first | `hoursLast30d` asc, then `pastBookings` asc. |
| `RELIABILITY` | Reliability first | `noShows30d + penalties30d` asc. |
| `LOTTERY` | Transparent lottery | Ranked only by the lottery number. |

Tie-break options: `FIFO` (earlier `requestedAt` wins) or `LOTTERY`.

**Lottery:** `lotteryNumber = first 8 hex chars of sha256(seed + ":" + bookingId)` read as an integer; lower wins. The seed is shown on the page and can be changed (default: the slot's start date as `YYYY-MM-DD`). Same seed gives the same result every time, and anyone can recompute it. Use Node `crypto` on the server.

### 3.4 Explanation log
Each run returns a list of steps, written as plain sentences, for example:
- "Tom Becker is not eligible: account not verified."
- "3 requests are eligible: Aisha Khan, Ravi Mehta, Lena Ortiz."
- "Policy Least access first: Aisha used 0 h in the last 30 days, Ravi 4 h, Lena 2 h."
- "Tie between Ravi and Lena on 2 h; broken by FIFO: Ravi asked first (09:12 vs 09:40)."
- "Winner: Aisha Khan. Aisha would be approved automatically because every check passed and the room is low risk." (or "...would go to a manager because the item is high risk.")

### 3.5 Comparison dashboard (page `/manager/fairness`)
- Access: `requireUser(["MANAGER","ADMIN"])`. Add a nav link "Fairness simulator" in the staff `manage` list in `src/app/layout.tsx`.
- Controls (a GET form, so the URL can be shared): contested slot picker, tie-break (FIFO or LOTTERY), lottery seed, "include the current holder as a competitor" checkbox.
- **Candidates table:** one row per request: name, user type, requested at, eligible yes/no (with the failed rules), priority score, hours last 30 days, past bookings, no-shows and penalties, lottery number.
- **Policy comparison:** one card per policy showing the full ranking (1, 2, 3...), the winner highlighted, and a "Why" list (that policy's explanation log). Mark each card's winner with a chip, and show a banner: "All policies pick the same person" or "Policies disagree: 3 different winners".
- **Live decision note:** "The live system uses Current TrustShare rule; this page changes nothing."
- Under the formula in `DecisionPanel.tsx`, add a staff-only link: "Inspect competing requests in the fairness simulator" → `/manager/fairness?resource=<id>&start=<iso>`. Add the same link at the top of `/manager/queue`.

### 3.6 Data contracts (new file `src/features/b/allocation.ts`)
```ts
export type PolicyId = "CURRENT" | "FIFO" | "LEAST_ACCESS" | "RELIABILITY" | "LOTTERY";
export type TieBreak = "FIFO" | "LOTTERY";

export type Candidate = {
  bookingId: string;
  userId: string;
  userName: string;
  userType: string;
  status: string;          // current booking status
  requestedAt: Date;
  eligible: boolean;
  failedRules: string[];   // labels of REJECT rules that failed (no_clash ignored)
  needsReview: boolean;
  priorityScore: number;
  hoursLast30d: number;
  pastBookings: number;
  noShows30d: number;
  penalties30d: number;
  lotteryNumber: number;
};

export type AllocationResult = {
  policy: PolicyId;
  tieBreak: TieBreak;
  ranking: string[];       // bookingIds, eligible only, best first
  winnerId: string | null;
  log: string[];           // explanation sentences, in order
};

/** Pure and deterministic: same input gives the same output. No database access. */
export function allocate(candidates: Candidate[], policy: PolicyId, tieBreak: TieBreak): AllocationResult;

export const POLICIES: { id: PolicyId; name: string; rule: string }[];
```
Server-side loader in a new file `src/features/b/simulator.ts` (no `"use server"`, it is only called from the page):
```ts
export async function findContestedSlots(): Promise<{ resourceId: string; resourceName: string; start: Date; end: Date; count: number }[]>;
export async function buildCandidates(resourceId: string, start: Date, end: Date, opts: { seed: string; includeHolder: boolean }): Promise<Candidate[]>;
```

### 3.7 Demo data (edit `src/lib/shared/seed.ts`)
Make the seminar slot a good demo where policies disagree:
- Give the seminar bookings explicit `createdAt` times so FIFO differs from priority: Ravi (`b_seminar_w2`) asked first, then Aisha (`b_seminar_w1`).
- Add one more waitlisted request on the same slot from Tom Becker (`u_tom`, not verified) with id `b_seminar_w3`, added to `IDS.bookings` as `seminarWait3`, created after Aisha's. It shows the eligibility filter dropping someone.
- Expected result for the seminar slot (holder not included): CURRENT and LEAST_ACCESS pick Aisha, FIFO and RELIABILITY (tie, broken by FIFO) pick Ravi, LOTTERY depends on the seed, and Tom is not eligible.
- Give Ravi a past RETURNED seminar booking in the last 30 days (2 to 3 hours) so "Least access first" ranks Aisha above him for a reason that is visible.
- Keep every existing id and state unchanged.

## 4. Files

**Create**
- `src/features/b/allocation.ts`: pure engine, policies, lottery, explanation log.
- `src/features/b/simulator.ts`: database loaders (`findContestedSlots`, `buildCandidates`).
- `src/app/manager/fairness/page.tsx`: the dashboard (server component; GET form controls).

**Edit (small)**
- `src/app/layout.tsx`: add the "Fairness simulator" link to the staff `manage` list.
- `src/features/b/components/DecisionPanel.tsx`: staff-only link to the simulator.
- `src/app/manager/queue/page.tsx`: link to the simulator.
- `src/lib/shared/seed.ts`: demo data from 3.7.
- `src/app/start/page.tsx`: optional extra journey step "Act as Dr. Patel, open the fairness simulator".

**Do not touch:** `prisma/schema.prisma`, `scripts/`, `.env`, `src/lib/shared/*` other than `seed.ts`, `src/features/a/*`, `src/features/c/*`. Add no npm packages.

## 5. Acceptance checklist
- [ ] `npm run typecheck` and `npm run lint` pass.
- [ ] `/manager/fairness` opens for Dr. Sam Patel and Alex Admin; a USER is sent to `/start?denied=1` (that is what `requireUser` already does).
- [ ] The seminar slot tomorrow 10:00 shows all requests; Tom is "not eligible: account not verified".
- [ ] The `CURRENT` policy ranking matches the live waitlist order (`priorityScore desc, createdAt asc`).
- [ ] At least two policies pick different winners for the seminar slot.
- [ ] The same seed gives the same lottery result after a page reload; changing the seed can change it; the lottery numbers are shown.
- [ ] Every policy card has a readable "Why" explanation that names the deciding factor and any tie-break.
- [ ] Nothing in the database changes when using the page (no server actions, no writes).
- [ ] Links from the decision panel (staff only) and the manager queue open the right slot.
- [ ] Page works at 1100 px wide like the rest of the app and uses the existing card and chip styles.
