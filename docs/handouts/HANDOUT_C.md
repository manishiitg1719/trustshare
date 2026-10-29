# TrustShare handout: Part C, usage, accountability and history

You build what happens after a booking is approved: picking the item up, recording its condition, giving it back, and dealing with anything that goes wrong, with a human always making the final call. You also build the history that proves every step happened, and the demo clock that lets judges see overdue returns and no-shows without waiting hours.

Lifecycle steps you own: **7 (check-in with condition)**, **8 (return with condition)**, **9 (delay, damage or conflict handled)** and **10 (full history)**.

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

You own the files listed under Part C in `OWNERS.md`. Replace the stubs `UsagePanel` and `HistoryTimeline`, keeping their names and props. They appear on Part B's booking page (`/bookings/[id]`), which already exists in the starter kit, so you can build and test there from the start.

### C1. Check-in (`UsagePanel` when APPROVED, and `/checkin/[code]`)
- Allowed for the booking's user from 15 minutes before start until the no-show deadline (`start + FAIRNESS.NO_SHOW_GRACE_MINUTES`), using `now()`.
- **Check-in code**: show the booking's `checkInCode` as a QR code (any small QR library, for example `qrcode`) and as a short typed code (first 6 characters). `/checkin/[code]` opens the check-in form directly, so scanning a QR sticker on the device works.
- For `requiresSupervisor` resources, the assigned supervisor (`booking.supervisorId`) must confirm the check-in, either signed in as themselves or by selecting their name and ticking "I am present".
- Form: every item from `resource.checklist` as OK or Problem with an optional note, general notes, and up to 4 photos (use `fileToDataUrl`).
- Saves a ConditionReport (phase CHECK_IN), then `transitionBooking` to CHECKED_IN with `checkedInAt: now()` and action `CHECKED_IN`. If any item is marked Problem, also create an Incident (type DAMAGE, reporter = user, "Found at check-in") so the user is not blamed later.

### C2. Return (`UsagePanel` when CHECKED_IN or OVERDUE)
- Same checklist and photos, phase RETURN, then RETURNED with `returnedAt: now()` and action `RETURNED`. Put "N checklist items failed" in the reason.
- If any item changed from OK at check-in to Problem at return, prompt the user to describe what happened and create an Incident (DAMAGE).
- If the return happens after `end`, create an Incident (DELAY) automatically if one does not exist.

### C3. Before and after comparison (`UsagePanel` when RETURNED or later)
- Side by side: check-in on the left, return on the right, item by item, with changed items highlighted, and photos next to each other.
- This is the evidence screen for disputes, so make it clear.

### C4. Closing and disputes
- A manager or the owner reviews each RETURNED booking: **Close** (no issues, `BOOKING_CLOSED`) or **Raise an issue** (opens an incident).
- The user can **dispute** a damage finding: RETURNED to DISPUTED (`BOOKING_DISPUTED`) with their explanation.
- A manager resolves a dispute after viewing the comparison: DISPUTED to CLOSED with a resolution note; any linked penalty is confirmed or overturned at the same time.

### C5. Incidents (`/incidents/new`, `/manager/incidents`, `/incidents/[id]`)
- Anyone involved can report one for a booking or a resource: type (DAMAGE, DELAY, NO_SHOW, MISUSE, SAFETY, OTHER), severity, description, photos. Audit `INCIDENT_REPORTED` and notify staff (`INCIDENT`).
- `/manager/incidents`: OPEN incidents sorted **risk-first** (severity HIGH first, then resources with HIGH risk level, then oldest).
- Incident page: the booking, both condition reports, photos, the user's history, and actions with a required note:
  - **Resolve** or **Dismiss** (`INCIDENT_RESOLVED`, `INCIDENT_DISMISSED`).
  - **Propose a penalty** (see C6).
  - **Mark resource out of service**: sets Resource.status to OUT_OF_SERVICE (`RESOURCE_OUT_OF_SERVICE`), cancels every upcoming APPROVED, REQUESTED and WAITLISTED booking of it with the reason "Resource out of service after incident", and notifies each user (`RESOURCE_OUT_OF_SERVICE`) with a link to `/resources?type=<same type>` to find an alternative. **Put back in service** (`RESOURCE_RESTORED`).
- **AI summary (optional, last)**: a button that drafts a 2-line summary and suggested severity, stored in `aiSummary` and always labelled "AI suggestion, human decision required". If you skip the AI call, a template summary built from the checklist is fine.

### C6. Penalties and appeals (`/penalties`, `/manager/penalties`)
- Penalties are only ever **proposed** automatically. A human confirms them.
- Proposed automatically by the scheduler (C8): WARNING for a late return; WARNING for a no-show; a SUSPENSION of 7 days for a second no-show within 30 days.
- A manager can also propose one from an incident: WARNING, SUSPENSION (days), or QUOTA_REDUCTION (hours).
- `/manager/penalties`: PROPOSED and APPEALED penalties. **Confirm** (sets `startsAt = now()`, `endsAt` for suspensions, `PENALTY_CONFIRMED`) or **Dismiss** (`PENALTY_DISMISSED`); for APPEALED, **Uphold** (back to CONFIRMED) or **Overturn** (`PENALTY_OVERTURNED`). Note required each time.
- `/penalties`: the user's own penalties with reasons, and an **Appeal** button with a text box (`PENALTY_APPEALED`).
- Notify the user at each step (`PENALTY`). A confirmed suspension automatically blocks bookings because `checkEligibility` reads it.

### C7. History (`HistoryTimeline`, `/history`)
- `HistoryTimeline` is a vertical timeline: time, actor (or "System"), a plain-English sentence for the action ("Dr. Sam Patel approved the request"), the reason, and an icon or colour per kind of action. Show condition reports and incidents inline where they happened.
- It must work for `bookingId` (one booking), `resourceId` (everything about a resource) and `userId` (everything a user did).
- Privacy: a USER sees only timelines of their own bookings. Owners see their resources. MANAGER and ADMIN see everything. Check this in the component.
- `/history`: the signed-in user's full history; staff can choose a user or resource.
- Add a "This history cannot be edited" note (the database blocks edits).

### C8. Demo clock and scheduler (`/admin/clock`, `src/features/c/scheduler.ts`)
- `/admin/clock` (ADMIN, and MANAGER for convenience): shows `now()`, buttons for +15 minutes, +1 hour, +1 day and Reset to real time. Each calls `advanceClock` (or `resetClock`), writes `CLOCK_ADVANCED`, then runs `runScheduler()`.
- `runScheduler()` (safe to run many times; never creates the same thing twice):
  - **Reminders**: APPROVED bookings starting within `REMINDER_MINUTES_BEFORE` that have no REMINDER notification yet (look for a Notification with kind REMINDER and link `/bookings/<id>`): notify (`REMINDER`).
  - **No-shows**: APPROVED bookings where `start + NO_SHOW_GRACE_MINUTES` has passed and nobody checked in: NO_SHOW (`MARKED_NO_SHOW`), propose a penalty, notify, and call Part B's `promoteWaitlist(resourceId, null)`.
  - **Overdue**: CHECKED_IN bookings whose `end` has passed: OVERDUE (`MARKED_OVERDUE`), create a DELAY incident, propose a WARNING, notify the user and staff (`OVERDUE`).
  - **Credential expiry**: VERIFIED credentials expiring within 14 days: notify the user once (`CREDENTIAL`).
- Also run `runScheduler()` at the top of the manager pages you own, so state is fresh even without pressing the clock.
- Show a small banner "Demo clock: +1 day" on your pages when the offset is not zero.

## 6. Done checklist
- [ ] Ravi can return the in-use 3D printer (`b_active`) with a checklist and photos, and sees before and after side by side.
- [ ] A new approved booking can be checked in with the QR link or the typed code, with a condition record.
- [ ] The laser cutter check-in needs the supervisor's confirmation.
- [ ] Sam can handle the soldering damage (`i_damage`): view evidence, propose a penalty, mark the station out of service, and the upcoming bookings are cancelled with notifications.
- [ ] Ravi can dispute, and Sam can resolve the dispute.
- [ ] Lena's overdue oscilloscope (`b_overdue`) can be returned late; the proposed warning (`p_overdue`) can be confirmed or dismissed by Sam, and appealed by Lena.
- [ ] Advancing the clock by 1 day turns tomorrow's unattended approved bookings into no-shows and promotes the waitlist.
- [ ] No penalty is ever confirmed without a human.
- [ ] Every booking shows a complete history; a USER cannot see someone else's.
- [ ] Every action writes an audit entry and a notification.
- [ ] `npm run typecheck` and `npm run lint` pass.

## 7. Suggested order
1. Hours 0 to 2: setup, read the shared code, especially `bookingState.ts` and `clock.ts`.
2. Hours 2 to 10: check-in and return with checklists and photos, before and after view.
3. Hours 10 to 16: `HistoryTimeline` and `/history`.
4. Hours 16 to 24: incidents, out of service, closing bookings, disputes.
5. Hours 24 to 30: penalties and appeals, demo clock and scheduler.
6. Hours 30 to 32: QR code, AI summary if time allows, polish.
7. Then hand over to Mamba.
