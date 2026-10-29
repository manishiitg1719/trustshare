// SHARED CONTRACT. Fictional demo data. Used by `npm run db:seed` and the Reset demo button.
// Every part relies on these ids and states, so change them only by agreement.
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { logAudit } from "./audit";
import { AuditAction } from "./types";

/** Fixed ids so pages, tests and the Judge Start Here guide can link to them. */
export const IDS = {
  users: {
    aisha: "u_aisha", // first-year student, no training
    ravi: "u_ravi", // final-year student, inducted, one expired credential
    lena: "u_lena", // external startup founder
    sam: "u_sam", // lab manager
    joan: "u_joan", // department owner
    alex: "u_alex", // admin
    tom: "u_tom", // new owner, not yet verified
  },
  creds: {
    laser: "c_laser",
    printer: "c_printer",
    electronics: "c_electronics",
    workshop: "c_workshop",
    camera: "c_camera",
  },
  resources: {
    laser: "r_laser",
    printer: "r_printer",
    camera: "r_camera",
    scope: "r_scope",
    solder: "r_solder",
    seminar: "r_seminar",
    meeting: "r_meeting",
    drill: "r_drill",
    bench: "r_bench",
    siggen: "r_siggen",
  },
  bookings: {
    active: "b_active", // CHECKED_IN now
    overdue: "b_overdue", // OVERDUE, penalty proposed
    damaged: "b_damaged", // RETURNED with an open damage report
    seminarApproved: "b_seminar_ok", // APPROVED, slot is full
    seminarWait1: "b_seminar_w1", // WAITLISTED #1
    seminarWait2: "b_seminar_w2", // WAITLISTED #2
    pendingReview: "b_pending", // REQUESTED, high-risk, waiting for a manager
    closed: "b_closed", // CLOSED, full history
  },
} as const;

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);
const monthsFromNow = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + m);
  return d;
};

const STANDARD_CHECKLIST = ["Powers on", "No visible damage", "All parts present", "Clean"];

export async function resetDemo(): Promise<void> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  }
  await seedDemo();
}

export async function seedDemo(): Promise<void> {
  const U = IDS.users;
  const C = IDS.creds;
  const R = IDS.resources;
  const B = IDS.bookings;

  await db.demoClock.create({ data: { id: 1, offsetMinutes: 0 } });

  await db.user.createMany({
    data: [
      { id: U.aisha, name: "Aisha Khan", email: "aisha@demo.edu", role: "USER", userType: "STUDENT", verified: true, persona: "First-year student. No training yet." },
      { id: U.ravi, name: "Ravi Mehta", email: "ravi@demo.edu", role: "USER", userType: "STUDENT", verified: true, persona: "Final-year student. Inducted on most equipment; workshop safety has expired." },
      { id: U.lena, name: "Lena Ortiz", email: "lena@startup.demo", role: "USER", userType: "EXTERNAL", verified: true, persona: "Founder of a nearby hardware startup (external user)." },
      { id: U.sam, name: "Dr. Sam Patel", email: "sam@demo.edu", role: "MANAGER", userType: "STAFF", verified: true, persona: "Lab manager. Reviews requests, returns and incidents." },
      { id: U.joan, name: "Prof. Joan Reyes", email: "joan@demo.edu", role: "OWNER", userType: "STAFF", verified: true, persona: "Department owner of the fab lab and equipment." },
      { id: U.alex, name: "Alex Admin", email: "admin@demo.edu", role: "ADMIN", userType: "STAFF", verified: true, persona: "Platform admin. Verifies users, owns the demo clock." },
      { id: U.tom, name: "Tom Becker", email: "tom@media.demo.edu", role: "OWNER", userType: "STAFF", verified: false, persona: "Media club lead who wants to list cameras. Not verified yet." },
    ],
  });

  await db.credential.createMany({
    data: [
      { id: C.laser, name: "Laser cutter induction", description: "Safe operation of the laser cutter, materials list, fire procedure.", validMonths: 12, nextSession: "Next induction: Tuesday 3pm, Fab Lab B12 (book with Dr. Patel)" },
      { id: C.printer, name: "3D printer basics", description: "Slicing, loading filament, bed levelling.", validMonths: 24, nextSession: "Online module (20 min), then upload your certificate" },
      { id: C.electronics, name: "Electronics lab safety", description: "ESD, mains safety and soldering fumes.", validMonths: 12, nextSession: "Next session: Thursday 11am, Electronics Lab E2" },
      { id: C.workshop, name: "Workshop power tools", description: "Drill press and bench tools under supervision.", validMonths: 6, nextSession: "Refresher every Friday 2pm, Workshop W1" },
      { id: C.camera, name: "Camera kit handling", description: "Care of lenses, batteries and memory cards.", validMonths: 24, nextSession: "Short video and quiz, then upload your certificate" },
    ],
  });

  const resources: Prisma.ResourceCreateManyInput[] = [
    { id: R.laser, photoUrl: "/resources/laser.jpg", name: "Laser cutter (60W)", type: "EQUIPMENT", description: "CO2 laser cutter for acrylic, plywood and card up to 6mm.", location: "Fab Lab B12", ownerId: U.joan, managerId: U.sam, riskLevel: "HIGH", requiresSupervisor: true, externalAllowed: true, usageRules: "Never leave the cutter running unattended. Approved materials only. Extraction on at all times.", maxHoursPerBooking: 2, monthlyHourQuota: 6, cooldownDays: 2, openHour: 10, closeHour: 17, checklist: ["Lens clean", "Bed clear of debris", "Extraction working", "No scorch marks"] },
    { id: R.printer, photoUrl: "/resources/printer.jpg", name: "3D printer (Prusa MK4)", type: "EQUIPMENT", description: "FDM printer, PLA and PETG, 25x21x22 cm build volume.", location: "Fab Lab B12", ownerId: U.joan, managerId: U.sam, riskLevel: "MEDIUM", maxHoursPerBooking: 6, monthlyHourQuota: 24, checklist: ["Bed clean", "Nozzle clear", "Filament loaded", "No visible damage"] },
    { id: R.camera, photoUrl: "/resources/camera.jpg", name: "DSLR camera kit", type: "DEVICE", description: "Canon EOS 90D, 18-135mm lens, tripod, 2 batteries, 64GB card.", location: "Media Store, Library L1", ownerId: U.joan, riskLevel: "LOW", maxHoursPerBooking: 24, monthlyHourQuota: 48, openHour: 9, closeHour: 18, checklist: ["Body undamaged", "Lens and caps present", "2 batteries", "Memory card", "Tripod"] },
    { id: R.scope, photoUrl: "/resources/scope.jpg", name: "Oscilloscope (Rigol 4-channel)", type: "DEVICE", description: "100MHz 4-channel digital oscilloscope with probes.", location: "Electronics Lab E2", ownerId: U.joan, managerId: U.sam, riskLevel: "LOW", maxHoursPerBooking: 4, monthlyHourQuota: 20, checklist: STANDARD_CHECKLIST },
    { id: R.solder, photoUrl: "/resources/solder.jpg", name: "Soldering station", type: "TOOL", description: "Temperature-controlled soldering station with fume extractor.", location: "Electronics Lab E2", ownerId: U.joan, managerId: U.sam, riskLevel: "MEDIUM", maxHoursPerBooking: 3, monthlyHourQuota: 15, checklist: ["Tip intact", "Fume extractor works", "Stand and sponge present", "Bench clean"] },
    { id: R.seminar, photoUrl: "/resources/seminar.jpg", name: "Seminar room A", type: "SPACE", description: "Seats 24, projector, whiteboard.", location: "Main building, 2nd floor", ownerId: U.joan, riskLevel: "LOW", maxHoursPerBooking: 3, monthlyHourQuota: 12, openHour: 8, closeHour: 20, checklist: ["Projector works", "Room tidy", "Whiteboard clean"] },
    { id: R.meeting, photoUrl: "/resources/meeting.jpg", name: "Meeting room 2", type: "SPACE", description: "Seats 6, screen with HDMI.", location: "Main building, ground floor", ownerId: U.joan, riskLevel: "LOW", maxHoursPerBooking: 2, monthlyHourQuota: 10, openHour: 8, closeHour: 20, openDays: [1, 2, 3, 4, 5, 6], checklist: ["Screen works", "Room tidy"] },
    { id: R.drill, photoUrl: "/resources/drill.jpg", name: "Bench drill press", type: "TOOL", description: "Floor-standing drill press, 16mm chuck.", location: "Workshop W1", ownerId: U.joan, managerId: U.sam, riskLevel: "HIGH", requiresSupervisor: true, externalAllowed: false, usageRules: "Eye protection required. No gloves near rotating parts.", maxHoursPerBooking: 2, monthlyHourQuota: 6, cooldownDays: 1, checklist: ["Guard fitted", "Chuck key returned", "Swarf cleaned", "No damage"] },
    { id: R.bench, photoUrl: "/resources/bench.jpg", name: "Fab lab workbench", type: "SPACE", description: "Large bench with hand tools and vice.", location: "Fab Lab B12", ownerId: U.joan, managerId: U.sam, riskLevel: "MEDIUM", maxHoursPerBooking: 4, monthlyHourQuota: 20, checklist: ["Tools returned", "Bench clean"] },
    { id: R.siggen, photoUrl: "/resources/siggen.jpg", name: "Signal generator", type: "DEVICE", description: "25MHz arbitrary waveform generator.", location: "Electronics Lab E2", ownerId: U.joan, riskLevel: "LOW", externalAllowed: false, maxHoursPerBooking: 4, monthlyHourQuota: 20, checklist: STANDARD_CHECKLIST },
  ];
  await db.resource.createMany({ data: resources });

  await db.resourceCredential.createMany({
    data: [
      { resourceId: R.laser, credentialId: C.laser },
      { resourceId: R.printer, credentialId: C.printer },
      { resourceId: R.camera, credentialId: C.camera },
      { resourceId: R.scope, credentialId: C.electronics },
      { resourceId: R.solder, credentialId: C.electronics },
      { resourceId: R.drill, credentialId: C.workshop },
      { resourceId: R.bench, credentialId: C.workshop },
      { resourceId: R.siggen, credentialId: C.electronics },
    ],
  });

  await db.userCredential.createMany({
    data: [
      { userId: U.ravi, credentialId: C.laser, status: "VERIFIED", issuedAt: monthsFromNow(-3), expiresAt: monthsFromNow(9), verifiedById: U.sam },
      { userId: U.ravi, credentialId: C.printer, status: "VERIFIED", issuedAt: monthsFromNow(-6), expiresAt: monthsFromNow(18), verifiedById: U.sam },
      { userId: U.ravi, credentialId: C.electronics, status: "VERIFIED", issuedAt: monthsFromNow(-2), expiresAt: monthsFromNow(10), verifiedById: U.sam },
      { userId: U.ravi, credentialId: C.workshop, status: "VERIFIED", issuedAt: monthsFromNow(-8), expiresAt: monthsFromNow(-2), verifiedById: U.sam }, // expired
      { userId: U.lena, credentialId: C.electronics, status: "VERIFIED", issuedAt: monthsFromNow(-1), expiresAt: monthsFromNow(11), verifiedById: U.sam },
      { userId: U.lena, credentialId: C.camera, status: "VERIFIED", issuedAt: monthsFromNow(-1), expiresAt: monthsFromNow(23), verifiedById: U.sam },
      { userId: U.aisha, credentialId: C.printer, status: "PENDING", evidence: "https://example.org/certificates/aisha-3d-printer-basics.pdf" },
    ],
  });

  const pass = (label: string, detail = "Passed") => ({ rule: "credential", label, passed: true, detail });
  const bookings: Prisma.BookingCreateManyInput[] = [
    { id: B.active, resourceId: R.printer, userId: U.ravi, start: hoursAgo(1), end: hoursFromNow(2), purpose: "Printing enclosure for final-year project", status: "CHECKED_IN", decidedById: null, decidedAt: hoursAgo(26), autoApproved: true, decisionReason: "All checks passed; medium-risk item approved automatically.", checkedInAt: hoursAgo(1), ruleResults: [pass("3D printer basics")] },
    { id: B.overdue, resourceId: R.scope, userId: U.lena, start: hoursAgo(6), end: hoursAgo(2), purpose: "Debugging motor controller prototype", status: "OVERDUE", decidedAt: hoursAgo(30), autoApproved: true, decisionReason: "All checks passed; low-risk item approved automatically.", checkedInAt: hoursAgo(6), ruleResults: [pass("Electronics lab safety")] },
    { id: B.damaged, resourceId: R.solder, userId: U.ravi, start: at(-1, 10), end: at(-1, 12), purpose: "Soldering sensor board", status: "RETURNED", decidedById: U.sam, decidedAt: at(-2, 9), decisionReason: "Approved.", checkedInAt: at(-1, 10, 5), returnedAt: at(-1, 11, 55), ruleResults: [pass("Electronics lab safety")] },
    { id: B.seminarApproved, resourceId: R.seminar, userId: U.lena, start: at(1, 10), end: at(1, 12), purpose: "Investor demo rehearsal", status: "APPROVED", decidedAt: at(0, 8), autoApproved: true, decisionReason: "All checks passed; low-risk space approved automatically." },
    { id: B.seminarWait1, resourceId: R.seminar, userId: U.aisha, start: at(1, 10), end: at(1, 12), purpose: "Study group for Circuits 101", status: "WAITLISTED", priorityScore: 2, decisionReason: "Slot already booked. You are #1 on the waitlist and will be promoted automatically if it frees up." },
    { id: B.seminarWait2, resourceId: R.seminar, userId: U.ravi, start: at(1, 10), end: at(1, 12), purpose: "Project team meeting", status: "WAITLISTED", priorityScore: 1, decisionReason: "Slot already booked. You are #2 on the waitlist." },
    { id: B.pendingReview, resourceId: R.laser, userId: U.ravi, start: at(2, 14), end: at(2, 16), purpose: "Cutting acrylic panels for robot chassis", status: "REQUESTED", decisionReason: "High-risk equipment: a manager must review this request and assign a supervisor.", ruleResults: [pass("Laser cutter induction")] },
    { id: B.closed, resourceId: R.meeting, userId: U.aisha, start: at(-3, 14), end: at(-3, 15), purpose: "Club planning meeting", status: "CLOSED", decidedAt: at(-4, 9), autoApproved: true, decisionReason: "All checks passed; low-risk space approved automatically.", checkedInAt: at(-3, 14, 2), returnedAt: at(-3, 14, 58) },
  ];
  await db.booking.createMany({ data: bookings });

  await db.conditionReport.createMany({
    data: [
      { bookingId: B.active, phase: "CHECK_IN", items: [{ item: "Bed clean", ok: true }, { item: "Nozzle clear", ok: true }, { item: "Filament loaded", ok: true }, { item: "No visible damage", ok: true }], createdById: U.ravi },
      { bookingId: B.overdue, phase: "CHECK_IN", items: STANDARD_CHECKLIST.map((item) => ({ item, ok: true })), createdById: U.lena },
      { bookingId: B.damaged, phase: "CHECK_IN", items: [{ item: "Tip intact", ok: true }, { item: "Fume extractor works", ok: true }, { item: "Stand and sponge present", ok: true }, { item: "Bench clean", ok: true }], photos: ["/demo/solder-before.jpg"], createdById: U.ravi },
      { bookingId: B.damaged, phase: "RETURN", items: [{ item: "Tip intact", ok: false, note: "Tip bent after dropping the iron" }, { item: "Fume extractor works", ok: true }, { item: "Stand and sponge present", ok: true }, { item: "Bench clean", ok: true }], notes: "Dropped the iron near the end; tip is bent. Sorry!", photos: ["/demo/solder-after.jpg"], createdById: U.ravi },
      { bookingId: B.closed, phase: "CHECK_IN", items: [{ item: "Screen works", ok: true }, { item: "Room tidy", ok: true }], createdById: U.aisha },
      { bookingId: B.closed, phase: "RETURN", items: [{ item: "Screen works", ok: true }, { item: "Room tidy", ok: true }], createdById: U.aisha },
    ],
  });

  await db.incident.create({
    data: { id: "i_damage", bookingId: B.damaged, resourceId: R.solder, reporterId: U.ravi, type: "DAMAGE", severity: "MEDIUM", description: "Soldering iron tip bent after being dropped. Station still heats.", status: "OPEN" },
  });
  await db.incident.create({
    data: { id: "i_overdue", bookingId: B.overdue, resourceId: R.scope, reporterId: U.sam, type: "DELAY", severity: "LOW", description: "Oscilloscope not returned by the end of the booking.", status: "OPEN" },
  });
  await db.penalty.create({
    data: { id: "p_overdue", userId: U.lena, incidentId: "i_overdue", kind: "WARNING", reason: "Late return of oscilloscope (proposed automatically, needs a manager to confirm).", status: "PROPOSED" },
  });

  // History so every seeded booking has a believable trail.
  const trail: [string, string | null, keyof typeof AuditAction, string, Date][] = [
    [B.closed, U.aisha, "BOOKING_REQUESTED", "Club planning meeting", at(-4, 8, 55)],
    [B.closed, null, "BOOKING_AUTO_APPROVED", "All checks passed; low-risk space", at(-4, 9)],
    [B.closed, U.aisha, "CHECKED_IN", "Condition recorded: all OK", at(-3, 14, 2)],
    [B.closed, U.aisha, "RETURNED", "Condition recorded: all OK", at(-3, 14, 58)],
    [B.closed, U.sam, "BOOKING_CLOSED", "Returned in good condition", at(-3, 16)],
    [B.active, U.ravi, "BOOKING_REQUESTED", "Printing enclosure", hoursAgo(26.1)],
    [B.active, null, "BOOKING_AUTO_APPROVED", "All checks passed; medium-risk item", hoursAgo(26)],
    [B.active, U.ravi, "CHECKED_IN", "Condition recorded: all OK", hoursAgo(1)],
    [B.overdue, U.lena, "BOOKING_REQUESTED", "Debugging motor controller", hoursAgo(30.1)],
    [B.overdue, null, "BOOKING_AUTO_APPROVED", "All checks passed; low-risk item", hoursAgo(30)],
    [B.overdue, U.lena, "CHECKED_IN", "Condition recorded: all OK", hoursAgo(6)],
    [B.overdue, null, "MARKED_OVERDUE", "Not returned by end time", hoursAgo(2)],
    [B.overdue, null, "PENALTY_PROPOSED", "Warning for late return (needs human confirmation)", hoursAgo(2)],
    [B.damaged, U.ravi, "BOOKING_REQUESTED", "Soldering sensor board", at(-2, 8, 30)],
    [B.damaged, U.sam, "BOOKING_APPROVED", "Approved", at(-2, 9)],
    [B.damaged, U.ravi, "CHECKED_IN", "Condition recorded: all OK", at(-1, 10, 5)],
    [B.damaged, U.ravi, "RETURNED", "1 checklist item failed: Tip intact", at(-1, 11, 55)],
    [B.damaged, U.ravi, "INCIDENT_REPORTED", "Damage: tip bent", at(-1, 11, 56)],
    [B.seminarApproved, U.lena, "BOOKING_REQUESTED", "Investor demo rehearsal", at(0, 7, 59)],
    [B.seminarApproved, null, "BOOKING_AUTO_APPROVED", "All checks passed; low-risk space", at(0, 8)],
    [B.seminarWait1, U.aisha, "BOOKING_REQUESTED", "Study group", at(0, 8, 10)],
    [B.seminarWait1, null, "BOOKING_WAITLISTED", "Slot taken; waitlist position 1", at(0, 8, 10)],
    [B.seminarWait2, U.ravi, "BOOKING_REQUESTED", "Project team meeting", at(0, 8, 20)],
    [B.seminarWait2, null, "BOOKING_WAITLISTED", "Slot taken; waitlist position 2", at(0, 8, 20)],
    [B.pendingReview, U.ravi, "BOOKING_REQUESTED", "Acrylic panels for robot chassis", hoursAgo(3)],
  ];
  const resourceOf = Object.fromEntries(bookings.map((b) => [b.id!, b.resourceId]));
  for (const [bookingId, actorId, action, reason, createdAt] of trail) {
    await db.auditLog.create({
      data: { actorId, action: AuditAction[action], entityType: "Booking", entityId: bookingId, bookingId, resourceId: resourceOf[bookingId], reason, createdAt },
    });
  }
  await logAudit({ actorId: null, action: AuditAction.DEMO_RESET, entityType: "System", entityId: "demo", reason: "Demo data loaded" });

  await db.notification.createMany({
    data: [
      { userId: U.sam, kind: "NEW_REQUEST", title: "New high-risk request", body: "Ravi Mehta requested the Laser cutter (60W).", link: `/bookings/${B.pendingReview}` },
      { userId: U.lena, kind: "OVERDUE", title: "Oscilloscope overdue", body: "Your booking ended 2 hours ago. Please return it to Electronics Lab E2.", link: `/bookings/${B.overdue}` },
      { userId: U.aisha, kind: "BOOKING_WAITLISTED", title: "You're #1 on the waitlist", body: "Seminar room A is booked tomorrow 10:00-12:00. We'll notify you if it frees up.", link: `/bookings/${B.seminarWait1}` },
    ],
  });
}
