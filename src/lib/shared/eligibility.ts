// SHARED CONTRACT. Do not edit in a part branch.
// Person-level eligibility for a resource. Part A shows it on the resource page; Part B runs it first in the booking engine.
import { db } from "./db";
import { now } from "./clock";
import type { EligibilityResult, RuleResult } from "./types";

export async function checkEligibility(userId: string, resourceId: string): Promise<EligibilityResult> {
  const at = await now();
  const [user, resource] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { credentials: true, penalties: { where: { status: "CONFIRMED", kind: "SUSPENSION" } } },
    }),
    db.resource.findUniqueOrThrow({ where: { id: resourceId }, include: { requirements: { include: { credential: true } } } }),
  ]);
  const checks: RuleResult[] = [];

  checks.push({
    rule: "account_verified",
    label: "Verified account",
    passed: user.verified,
    detail: user.verified ? "Your account is verified" : "Your account has not been verified yet",
    fix: user.verified ? undefined : "An admin verifies new accounts, usually within one working day",
    onFail: "REJECT",
  });

  checks.push({
    rule: "resource_active",
    label: "Resource available for booking",
    passed: resource.status === "ACTIVE",
    detail: resource.status === "ACTIVE" ? "In service" : resource.status === "OUT_OF_SERVICE" ? "Out of service" : "Archived",
    fix: resource.status === "ACTIVE" ? undefined : "Try a similar resource",
    onFail: "REJECT",
  });

  if (user.userType === "EXTERNAL") {
    checks.push({
      rule: "external_allowed",
      label: "Open to external users",
      passed: resource.externalAllowed,
      detail: resource.externalAllowed ? "External users may book this" : "Only department members may book this",
      onFail: "REJECT",
    });
  }

  for (const req of resource.requirements) {
    const held = user.credentials
      .filter((c) => c.credentialId === req.credentialId)
      .sort((a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0))[0];
    let passed = false;
    let detail = "Missing";
    if (held?.status === "VERIFIED") {
      if (held.expiresAt && held.expiresAt < at) detail = `Expired on ${held.expiresAt.toDateString()}`;
      else {
        passed = true;
        detail = held.expiresAt ? `Verified, expires ${held.expiresAt.toDateString()}` : "Verified";
      }
    } else if (held?.status === "PENDING") detail = "Submitted, waiting for verification";
    else if (held?.status === "REJECTED") detail = `Rejected${held.reviewNote ? `: ${held.reviewNote}` : ""}`;
    checks.push({
      rule: "credential",
      label: req.credential.name,
      passed,
      detail,
      fix: passed ? undefined : req.credential.nextSession ?? "Upload proof on your Credentials page",
      onFail: "REJECT",
    });
  }

  const activeSuspension = user.penalties.find((p) => (!p.startsAt || p.startsAt <= at) && (!p.endsAt || p.endsAt > at));
  checks.push({
    rule: "not_suspended",
    label: "No active suspension",
    passed: !activeSuspension,
    detail: activeSuspension
      ? `Suspended${activeSuspension.endsAt ? ` until ${activeSuspension.endsAt.toDateString()}` : ""}: ${activeSuspension.reason}`
      : "No suspension",
    fix: activeSuspension ? "You can appeal on your Penalties page" : undefined,
    onFail: "REJECT",
  });

  return { eligible: checks.every((c) => c.passed), checks };
}
