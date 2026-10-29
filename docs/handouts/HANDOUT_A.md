# TrustShare handout: Part A, foundation, listings and discovery

You build the front door of TrustShare: everything a judge sees first, everything an owner uses to list a resource, and everything a user uses to find one and find out whether they are allowed to use it. You also own the admin pages and the notifications page.

Lifecycle steps you own: **1 (owner lists a resource)** and **2 (user discovers it and checks eligibility)**.

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

You own the files listed under Part A in `OWNERS.md`. The starter kit already has rough versions of the layout, `/start`, `/resources` and `/resources/[id]`. Replace them with the real thing.

### A1. Layout, navigation and role switcher (`src/app/layout.tsx`)
- Clean header with links that depend on the role (the starter shows which links each role gets).
- Role switcher that shows each persona's name, role and one-line persona.
- Replace the `NotificationBell` stub with an unread count and a link to `/notifications`.
- Skip-to-content link, visible focus outlines, readable contrast, works at 375px width.

### A2. Judge Start Here (`/start`)
- A short intro to TrustShare in two sentences.
- A numbered "try this journey" guide that walks a judge through all 10 lifecycle steps, with one button per step that switches to the right persona and opens the right page. Use the fixed ids in `IDS`. Suggested path:
  1. Act as Prof. Joan Reyes, create a new resource at `/owner/resources/new`.
  2. Act as Aisha, open the laser cutter and see the missing induction and its fix.
  3. Act as Ravi, request the oscilloscope or the new resource (Part B).
  4. Act as Dr. Patel, open `/manager/queue` and approve Ravi's laser request with a reason (Part B).
  5. Act as Ravi, open the printer booking `b_active` and return it with photos (Part C).
  6. Act as Dr. Patel, open `/manager/incidents` and handle the soldering damage (Part C).
  7. Open any booking's history (Part C).
- Persona cards (keep the starter's "Act as" buttons).
- The **Reset demo data** button (already wired to `resetDemoAction`).
- Show `?reset=1` as a "Demo data reset" message and `?denied=1` as "That page needs a different role".

### A3. Resource search (`/resources`)
- Cards with photo, name, type, location, risk level badge, "requires supervisor", required credentials.
- Filters in the URL query string so links are shareable: text search, type, location, risk level, "free on date" (no APPROVED, CHECKED_IN or OVERDUE booking overlapping that day's opening hours), and **"Only show what I can book"** (uses `checkEligibility`).
- Each card shows an eligibility chip for the signed-in user: "You can book this" or "Missing: Laser cutter induction".
- Hide ARCHIVED resources. Show OUT_OF_SERVICE ones with a clear label.

### A4. Resource detail (`/resources/[id]`)
- Description, location, photo, usage rules, risk level, supervisor requirement, opening hours and days, max hours per booking, monthly quota, cooldown, and the condition checklist items.
- **Eligibility panel**: run `checkEligibility` and list every check with a tick or cross, its `detail`, and its `fix` hint as a call to action (for credentials, link to `/credentials?request=<credentialId>`).
- **Availability for the next 7 days**: a simple grid of opening hours with booked slots greyed out (APPROVED, CHECKED_IN, OVERDUE), and how many people are waitlisted.
- `<BookButton resourceId>` from Part B. Show it only if the user is eligible; otherwise show "Fix the items above to book".
- For the owner or staff: an "Edit" link and the `<HistoryTimeline resourceId>` from Part C.

### A5. Owner listings (`/owner/resources`, `/owner/resources/new`, `/owner/resources/[id]/edit`)
- Owners see only their own resources; admins see all.
- Create and edit form with every Resource field: name, type, description, location, photo (upload with `fileToDataUrl`, or paste a URL), manager, risk level, requires supervisor, external allowed, usage rules, max hours per booking, monthly hour quota, cooldown days, opening hours, open days (checkboxes), condition checklist (add and remove lines), required credentials (multi-select).
- Validate on the server: closeHour > openHour, quotas at least 1, checklist at least one item.
- An unverified owner (Tom) cannot publish. Show "Your owner account is waiting for admin verification".
- Archive a resource (status ARCHIVED). Do not delete.
- Audit: `RESOURCE_CREATED`, `RESOURCE_UPDATED` (put the changed field names in `meta`).

### A6. Utilization dashboard (`/owner/dashboard`)
This is the feature that proves the "underused" part of the challenge, so make it clear.
- For each of the owner's resources over the last 30 days (use `now()`): booked hours vs open hours, idle percentage, number of bookings, no-shows, currently waitlisted requests, and open incidents.
- A headline per resource, e.g. "Laser cutter idle 74% of open hours, 3 eligible users waiting".
- A simple bar chart (plain divs with widths are fine).

### A7. Credentials passport (`/credentials`, `/manager/credentials`)
- `/credentials`: the user's credentials with status, issue date and expiry (show "expires in 12 days" warnings and "Expired" in red). List which resources each credential unlocks ("Train once, unlock many").
- Request a credential: pick the credential, upload evidence (image via `fileToDataUrl`, or a link), creates a PENDING UserCredential. Audit `CREDENTIAL_SUBMITTED`. Notify managers with `notifyResourceStaff` or by notifying every MANAGER.
- `/manager/credentials` (MANAGER, ADMIN): queue of PENDING submissions with the evidence shown. Verify (sets `issuedAt = now()`, `expiresAt = now() + validMonths`, `verifiedById`) or reject with a required note. Audit `CREDENTIAL_VERIFIED` or `CREDENTIAL_REJECTED`. Notify the user (`CREDENTIAL`).

### A8. Admin (`/admin`, `/admin/users`, `/admin/audit`, `/admin/emails`)
- `/admin`: links to every admin and manager page, plus counts (pending verifications, open incidents, overdue bookings).
- `/admin/users`: list users; verify a user or owner (audit `USER_VERIFIED`); change a role (audit `USER_ROLE_CHANGED` with old and new role in `meta`). An admin cannot remove their own admin role.
- `/admin/audit`: the whole AuditLog, newest first, filter by action, actor and date. Read-only. You may reuse Part C's `<HistoryTimeline>` or build a table.
- `/admin/emails`: the simulated email log (EmailLog), newest first. Label it "Simulated emails, nothing is actually sent".

### A9. Notifications (`/notifications`)
- The signed-in user's notifications, newest first, unread in bold, each linking to its `link`. "Mark all as read" sets `readAt`.

### A10. Privacy page (`/privacy`)
- What data TrustShare stores, who can see it (users see their own bookings; owners and managers see bookings of their resources; admins see everything), that photos are only visible to the booking's user and staff, that the demo uses fictional data, and that AI suggestions never decide anything. Link it in the footer.

## 6. Done checklist
- [ ] A judge can land on `/start`, understand the app in 30 seconds and follow the journey guide.
- [ ] Every role sees the right navigation, and a USER cannot open `/owner`, `/manager` or `/admin` pages.
- [ ] Joan can create a resource with credentials, quotas, opening hours and a checklist, and it appears in search.
- [ ] Tom (unverified) cannot publish until Alex verifies him.
- [ ] Aisha sees "Missing: Laser cutter induction" with the next-session hint on the laser cutter.
- [ ] Ravi sees "Workshop power tools: Expired" on the drill press.
- [ ] Lena (external) is told the drill press and signal generator are for department members only.
- [ ] "Only show what I can book" works for each persona.
- [ ] Aisha's pending 3D printer credential can be verified by Sam, and the printer then shows as bookable for her.
- [ ] Utilization dashboard shows real numbers from the seeded bookings.
- [ ] Notifications page and bell work. Simulated email log shows emails.
- [ ] Every create, update, verify and role change writes an audit entry.
- [ ] Reset demo data restores everything.
- [ ] `npm run typecheck` and `npm run lint` pass.

## 7. Suggested order
1. Hours 0 to 2: setup, read the shared code.
2. Hours 2 to 10: layout, `/start`, `/resources` with filters, `/resources/[id]` with the eligibility panel.
3. Hours 10 to 18: owner create and edit, credentials passport and manager verification.
4. Hours 18 to 26: admin pages, notifications, privacy page.
5. Hours 26 to 32: utilization dashboard, accessibility pass, phone-width pass, polish.
6. Then hand over to Mamba.
