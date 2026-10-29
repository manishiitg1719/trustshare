# TrustShare handout: Part B, booking engine, fairness and approvals

You build the brain of TrustShare: what happens when someone presses "Request booking". You decide, with clear rules, whether a request is approved automatically, sent to a manager, waitlisted or rejected, and you explain that decision in plain language. Fairness (stopping people from hogging machines) is mostly yours, and it is worth 10 of the 100 judging points.

Lifecycle steps you own: **3 (request)**, **4 (system checks the rules)**, **5 (manager review)** and **6 (approved, rejected or waitlisted)**. You also own cancellations and extensions.

## 1. The idea in one minute

TrustShare lets a college engineering department share its fab lab, camera kits, test equipment and rooms with its own students and nearby startups, without losing control of its property.

Ordinary booking systems only show free slots. TrustShare adds what owners actually worry about: who is allowed to use something (training and credentials), whether it needs a supervisor, fair limits so nobody hoards a machine, a condition record before and after every use, damage and late-return handling with a human in charge, and a permanent history of every decision.

The hackathon judges will try to complete this journey without help:

1. An owner lists a resource and sets its rules.
2. A user finds it and sees whether they are eligible, and how to fix it if not.
3. The user requests a booking.
4. The system checks the rules (credentials, clashes, quotas, cooldown, risk level).
5. A manager reviews it if needed.
6. It is approved, rejected or waitlisted, always with a reason.
7. The user checks in and records the condition.
8. The user returns it and records the condition again.
9. Any delay, damage or conflict is reported and handled by a human.
10. Both sides can see the full history.

## 2. How the work is split

| Part | Builder | Lifecycle steps | In short |
|---|---|---|---|
| A | Foundation, listings, discovery | 1, 2 | Layout, Judge Start Here, resource listing and editing, search, eligibility display, credentials, admin, notifications page, utilization dashboard |
| B | Booking engine, fairness, approvals | 3, 4, 5, 6 | Booking form, rule checks, fairness limits, auto-approve or review or waitlist, manager queue, "Why this decision?", cancellations, extensions, waitlist promotion |
| C | Usage, accountability, history | 7, 8, 9, 10 | Check-in and return with checklists and photos, before/after view, incidents, penalties and appeals, disputes, closing bookings, history timeline, demo clock and scheduler |

The three parts never call each other's code directly, except through the six stub components and functions listed in `OWNERS.md`. They meet in the database. Because everyone starts from the same schema and the same seed data, each part can be built and tested alone.

## 3. Shared contracts (identical in all three handouts)

These are already written in the starter kit. Use them, do not change them.

**Stack.** Next.js 15 App Router with server components and server actions, TypeScript, Tailwind, Prisma 6, PostgreSQL. No separate API server. Put server logic in `src/features/<your part>/actions.ts` (with `"use server"`) and queries in `src/features/<your part>/queries.ts`.

**Demo sign-in.** No passwords. The current user id lives in the `ts_user` cookie, set by the role switcher in the header or on `/start`. In a page or action, call `requireUser()` or `requireUser(["MANAGER", "ADMIN"])` from `@/lib/shared/auth`. Also available: `getCurrentUser()`, `canManageResource(user, resource)`, `isStaff(user)`.

**Roles.** `USER` books things. `OWNER` lists and controls their resources. `MANAGER` reviews requests, returns, incidents and penalties for any resource. `ADMIN` verifies users and owners and runs the demo clock. User types: `STUDENT`, `STAFF`, `EXTERNAL` (startups).

**Data model** (`prisma/schema.prisma`). User, Credential, UserCredential (PENDING, VERIFIED, REJECTED, with expiry), Resource (risk level, requires supervisor, external allowed, max hours per booking, monthly hour quota, cooldown days, opening hours and days, condition checklist, status), ResourceCredential (requirements), Booking, ExtensionRequest, ConditionReport (CHECK_IN or RETURN, one each per booking), Incident, Penalty, Notification, EmailLog, AuditLog, DemoClock.

**Booking states** (`src/lib/shared/bookingState.ts`). Change status only with `transitionBooking({ bookingId, to, actorId, action, reason, data })`. It rejects illegal moves and writes the audit entry in the same transaction.

| From | Allowed to |
|---|---|
| REQUESTED | APPROVED, REJECTED, WAITLISTED, CANCELLED |
| WAITLISTED | APPROVED, REJECTED, CANCELLED, REQUESTED |
| APPROVED | CHECKED_IN, CANCELLED, NO_SHOW, REQUESTED (approval revoked) |
| REJECTED | REQUESTED (appeal) |
| CHECKED_IN | RETURNED, OVERDUE |
| OVERDUE | RETURNED |
| RETURNED | CLOSED, DISPUTED |
| DISPUTED | CLOSED |
| CANCELLED, NO_SHOW, CLOSED | nothing (final) |

**Database guarantees** (`scripts/constraints.sql`). Two bookings of the same resource in APPROVED, CHECKED_IN or OVERDUE can never overlap (Postgres exclusion constraint; a violating write throws an error whose message contains `booking_no_overlap`, so catch it and check the message). `end` must be after `start`. AuditLog rows cannot be updated or deleted.

**Helpers** (`src/lib/shared/`).

- `now()` gives the current time including the demo clock offset. Never use `new Date()` for business rules.
- `logAudit({ actorId, action, entityType, entityId, bookingId?, resourceId?, reason?, meta? }, tx?)`. `actorId: null` means the system. Use only action names from `AuditAction` in `types.ts`.
- `notify({ userId, kind, title, body, link?, email? }, tx?)` writes an in-app notification and a simulated email. `notifyResourceStaff(resource, {...})` notifies the owner and manager.
- `checkEligibility(userId, resourceId)` returns `{ eligible, checks: RuleResult[] }` for person-level rules: verified account, resource in service, external allowed, each required credential (verified and not expired), no active suspension. Each failed check has a `fix` hint.
- `RuleResult = { rule, label, passed, detail, fix?, onFail? }`. Part B stores the full list on `Booking.ruleResults`, and every "why" screen reads from it.
- `FAIRNESS.MAX_ACTIVE_BOOKINGS = 3`, `NO_SHOW_GRACE_MINUTES = 30`, `REMINDER_MINUTES_BEFORE = 60`. `LIVE_STATUSES` and `ACTIVE_STATUSES` arrays.
- `fmtDateTime`, `fmtRange`, `STATUS_LABEL`, `<StatusBadge status>` so everyone shows dates and statuses the same way.
- `fileToDataUrl(file)` (client only) shrinks a photo to a small JPEG data URL. Photos are stored as data URLs in the database, so no file storage service is needed.
- `resetDemo()` wipes and reloads demo data. `IDS` in `seed.ts` has the fixed ids of every seeded user, resource and booking.

**Seeded demo data** (all fictional).

| Persona | id | What they show |
|---|---|---|
| Aisha Khan, first-year student | `u_aisha` | No training. Has a PENDING 3D printer credential. #1 on the seminar room waitlist. |
| Ravi Mehta, final-year student | `u_ravi` | Inducted on laser, printer, electronics. Workshop credential EXPIRED. Printer booking in use now. Laser request waiting for review. Returned a damaged soldering station. |
| Lena Ortiz, startup founder | `u_lena` | EXTERNAL user. Oscilloscope OVERDUE with a proposed warning. Seminar room approved tomorrow 10:00. |
| Dr. Sam Patel | `u_sam` | MANAGER. |
| Prof. Joan Reyes | `u_joan` | OWNER of all 10 resources. |
| Alex Admin | `u_alex` | ADMIN. |
| Tom Becker | `u_tom` | OWNER, not yet verified (for the admin verification demo). |

Resources: laser cutter (high risk, supervisor), 3D printer, DSLR kit, oscilloscope, soldering station, seminar room A, meeting room 2, drill press (high risk, supervisor, no externals), fab lab workbench, signal generator (no externals).

**UI conventions.** Tailwind only, no component library unless the team agrees. Every form control has a visible label. Every decision button asks for a reason. Use plain English. Pages must work at phone width.

## 4. Rules for everyone

- Work on your own branch (`part-a`, `part-b`, `part-c`) of the same starter repo, with your own database.
- Edit only the files listed for you in `OWNERS.md`. If you need a page that is not listed, create it under your own folder and tell Mamba.
- Never change `prisma/schema.prisma` or `src/lib/shared/`. If something is missing, ask Mamba, who will change it for all three at once.
- Never rename the stub exports or change their props.
- Run `npm run typecheck` and `npm run lint` before handing over. Both must pass.
- Commit at least every couple of hours.
- **Handover:** send Mamba your branch (or a zip of the repo without `node_modules` and `.env`), plus a short note: what works, what is unfinished, and anything you had to work around.

## 5. Your scope

You own the files listed under Part B in `OWNERS.md`. Replace the stubs `BookButton`, `DecisionPanel` and `promoteWaitlist` with the real thing, keeping their names and props. The starter kit has rough versions of `/bookings` and `/bookings/[id]`; replace them, but keep `<DecisionPanel>`, `<UsagePanel>` and `<HistoryTimeline>` mounted on the booking page.

### B1. The rule engine (`src/features/b/rules.ts`)
Write `evaluateBooking({ userId, resourceId, start, end, excludeBookingId? }): Promise<{ outcome: BookingOutcome; results: RuleResult[]; priorityScore: number }>`. It runs these checks in order and collects every result (do not stop at the first failure, so the user sees everything at once):

| # | Rule id | Check | If it fails |
|---|---|---|---|
| 1 | (all of `checkEligibility`) | Verified account, resource in service, external allowed, credentials, no suspension | REJECT |
| 2 | `in_future` | start is after `now()` | REJECT |
| 3 | `opening_hours` | start and end fall inside the resource's open hours on open days | REJECT |
| 4 | `max_duration` | length is at most `maxHoursPerBooking` | REJECT |
| 5 | `active_cap` | the user has fewer than `FAIRNESS.MAX_ACTIVE_BOOKINGS` bookings in `ACTIVE_STATUSES` | REJECT |
| 6 | `monthly_quota` | hours this calendar month on this resource (APPROVED, CHECKED_IN, OVERDUE, RETURNED, CLOSED) plus this request are at most `monthlyHourQuota`, minus any confirmed QUOTA_REDUCTION penalty | REJECT |
| 7 | `cooldown` | the user's last booking of this resource ended at least `cooldownDays` before this start | REJECT |
| 8 | `no_clash` | no booking in `LIVE_STATUSES` overlaps | WAITLIST |
| 9 | `risk_tier` | LOW passes. MEDIUM passes for STUDENT and STAFF. HIGH never auto-passes. Any EXTERNAL user on MEDIUM or HIGH goes to review. | REVIEW |
| 10 | `supervisor` | only when `requiresSupervisor`: always needs a manager to assign a supervisor | REVIEW |

Outcome: any REJECT failure gives REJECT. Otherwise any WAITLIST failure gives WAITLIST. Otherwise any REVIEW failure gives NEEDS_REVIEW. Otherwise AUTO_APPROVE.

Every result needs a human `detail` (e.g. "You have used 5 of 6 hours this month") and, when it fails, a `fix` (e.g. "Try a 1-hour slot, or wait until 1 Nov when your quota resets").

### B2. Priority formula (`src/features/b/priority.ts`)
One formula, written down, shown to users. Higher score goes first; ties go to the earlier request (FIFO).

`priorityScore = 2 if this is the user's first booking of this resource + 1 if the user has used under half their monthly quota on it − 1 for each no-show or confirmed penalty in the last 30 days`

Show this formula on the resource's waitlist view and in the "Why this decision?" panel. Store the score on `Booking.priorityScore`.

### B3. Booking request (`/resources/[id]/book`, `BookButton`)
- Form: date, start time, end time (15-minute steps, within opening hours), purpose (required, at least 10 characters).
- **Live pre-check**: as the user changes the time, call a server action that runs `evaluateBooking` and shows each rule with a tick or cross, so they see the result before submitting.
- **Alternative suggestions** when `no_clash` fails: the next three free slots of the same length on this resource within 7 days, and up to three similar resources (same type, user eligible) free at the requested time. Each is a one-click "Use this instead".
- Submit (`createBooking` server action):
  - Re-run `evaluateBooking` on the server. Never trust the client.
  - REJECT: do not create a booking; show the reasons. (Optional: create it as REJECTED so it appears in history.)
  - AUTO_APPROVE: create REQUESTED, then `transitionBooking` to APPROVED with action `BOOKING_AUTO_APPROVED`, actor `null`, `autoApproved: true`, reason "All checks passed; <risk> item approved automatically". If the database overlap constraint fires (two people booked at the same moment), catch it and put the booking on the waitlist instead.
  - NEEDS_REVIEW: create REQUESTED with reason "Needs a manager because …". Notify staff (`NEW_REQUEST`).
  - WAITLIST: create REQUESTED, then transition to WAITLISTED with the position in the reason.
  - Always write `BOOKING_REQUESTED` first, store `ruleResults`, and notify the user.

### B4. "Why this decision?" (`DecisionPanel`)
- Plain-language summary at the top: "Approved automatically because every check passed and this is a low-risk room", or "Waiting for a manager because the laser cutter is high-risk and needs a supervisor", or "You are #2 of 3 on the waitlist".
- Every stored rule result with tick or cross, detail and fix.
- Who decided, when, and their reason (or "Automatic, reviewable by a manager").
- For waitlisted bookings: live position, the priority formula, and the user's own score.
- Quota use bar: "5 of 6 hours used this month".

### B5. Manager review queue (`/manager/queue`)
- MANAGER and ADMIN only (owners see requests for their own resources).
- Tabs: Needs review (REQUESTED), Waitlists, Recent auto-approvals (last 7 days), Extension requests.
- Sort Needs review **risk-first** (HIGH, then MEDIUM, then LOW), then oldest first.
- Each row shows the user, their user type, their credentials, the rule results, any clash, and their recent history (no-shows, penalties).
- Actions, each requiring a reason of at least 5 characters:
  - **Approve**: for `requiresSupervisor` resources, a supervisor (a MANAGER or STAFF user) must be chosen. Re-check for clashes first.
  - **Reject**.
  - **Waitlist**.
  - **Revoke** an auto-approval (APPROVED to REQUESTED, action `BOOKING_APPROVAL_REVOKED`). This keeps automatic decisions reviewable by a human.
- Notify the user on every decision (`BOOKING_APPROVED`, `BOOKING_REJECTED`, `BOOKING_WAITLISTED`).

### B6. Waitlist promotion (`promoteWaitlist` in `src/features/b/waitlist.ts`)
- Find WAITLISTED bookings on this resource whose slot no longer clashes with anything live, highest `priorityScore` first, then oldest.
- Re-run `evaluateBooking` for each. Low-risk and passing: approve automatically (`BOOKING_PROMOTED`). High-risk: move to REQUESTED for review.
- Notify the promoted user (`BOOKING_PROMOTED`) and the others with their new position.
- Call it yourself after every cancellation and rejection. Part C calls it after no-shows.

### B7. My bookings, booking page, cancellations, extensions, appeals
- `/bookings`: the user's bookings grouped as Upcoming, Waitlisted, In use, Past. Staff get an "All bookings" filter.
- `/bookings/[id]`: who can see it is the booking's user, the resource owner, its manager, MANAGER and ADMIN. Keep the three mounted panels.
- **Cancel** (user, before start; staff any time with a reason): to CANCELLED, `BOOKING_CANCELLED`, notify, then `promoteWaitlist`.
- **Extension** (user, while APPROVED or CHECKED_IN): pick a new end time; check opening hours, max duration, quota and clash against the next booking. Create an ExtensionRequest (`EXTENSION_REQUESTED`). A manager approves (updates `end`; the overlap constraint protects you) or rejects with a note (`EXTENSION_APPROVED` or `EXTENSION_REJECTED`). Notify the user (`EXTENSION_DECIDED`).
- **Appeal** a rejection (user): a text box; REJECTED to REQUESTED with action `BOOKING_APPEALED` and the appeal text as the reason; it returns to the manager queue.

### B8. Tests (`src/features/b/rules.test.ts`, optional but valuable)
If time allows, add a few tests of `evaluateBooking` against the seeded data (for example with `tsx --test`): Aisha on the laser is rejected for the missing credential; a second seminar room request tomorrow 10:00 is waitlisted; Ravi's 3-hour laser request is rejected for max duration.

## 6. Done checklist
- [ ] Ravi books the oscilloscope for a free hour tomorrow and it is approved automatically, with reasons shown.
- [ ] Ravi requests the laser cutter: it goes to the manager queue with "high-risk, supervisor required".
- [ ] Sam approves it only after choosing a supervisor, with a reason. Ravi is notified.
- [ ] Anyone requesting the seminar room tomorrow 10:00 to 12:00 is waitlisted, sees their position and the formula, and gets three alternative slots.
- [ ] Lena cancels her seminar booking and Aisha (#1) is promoted and notified automatically.
- [ ] Aisha cannot book the laser cutter, and the form explains exactly why and how to fix it.
- [ ] A fourth active booking is refused with "3 active bookings maximum".
- [ ] Monthly quota and cooldown are enforced and explained.
- [ ] Two bookings for the same slot submitted at the same time never both become APPROVED.
- [ ] A manager can revoke an auto-approval, reject with a reason, and the user can appeal.
- [ ] Extensions work and respect the next booking.
- [ ] Every action writes an audit entry and a notification.
- [ ] `npm run typecheck` and `npm run lint` pass.

## 7. Suggested order
1. Hours 0 to 2: setup, read the shared code, especially `eligibility.ts` and `bookingState.ts`.
2. Hours 2 to 12: `evaluateBooking`, priority, `createBooking`, booking form with live pre-check.
3. Hours 12 to 20: manager queue and decisions, `DecisionPanel`.
4. Hours 20 to 26: waitlist promotion, cancellations, alternative suggestions.
5. Hours 26 to 32: extensions, appeals, `/bookings` page, tests, polish.
6. Then hand over to Mamba.
