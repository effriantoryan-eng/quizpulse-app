// Subscription-tier entitlements for QuizPulse.
//
// This is ORTHOGONAL to authz.js's `role` (owner/support/platform_admin = who may administer the
// platform). `tier` = what a paying teacher's subscription unlocks. Keep them separate — never
// overload one onto the other. Authorization asks "is this yours"; entitlement asks "is it in
// your plan".
//
// Tiers are ORDERED — a higher tier includes everything below it. `tier` lives on the teacher
// doc (set at onboarding, default 'free'); a legacy doc with no field reads as 'free'.
//
// No billing exists yet, on purpose: tier is set by hand (comp pilot teachers, invoice schools)
// until self-serve volume justifies wiring Stripe. requireTier is the single gate every future
// paid feature routes through — deciding the error shape/status here once, so no gate reinvents it.
// ponytail: manual tier assignment; a billing webhook flips this field when that day comes.

const TIERS = ['free', 'pro', 'school'];

// Normalises a teacher doc to a known tier. Unknown/absent value -> 'free' (fails closed:
// a mystery tier never unlocks a paid feature).
function tierOf(teacher) {
  const t = teacher && teacher.tier;
  return TIERS.includes(t) ? t : 'free';
}

// True when the teacher's tier is at least `minTier` in the TIERS order.
function hasTier(teacher, minTier) {
  return TIERS.indexOf(tierOf(teacher)) >= TIERS.indexOf(minTier);
}

// Thrown by requireTier when the teacher is below `minTier`. A handler catches it and responds
// with err.status + err.body — a machine-readable upgrade prompt the frontend keys on to swap the
// gated control for an upsell (same convention as stepUp's { reauthRequired: true }).
class TierError extends Error {
  constructor(requiredTier, currentTier) {
    super('Upgrade required');
    this.status = 402; // Payment Required
    this.body = { error: 'Upgrade required', upgradeRequired: true, requiredTier, currentTier };
  }
}

// Throws TierError unless the teacher is at or above `minTier`. Returns the teacher on success so
// call sites can chain. No endpoint calls this yet — it's the plumbing; gates come one at a time.
function requireTier(teacher, minTier) {
  if (!TIERS.includes(minTier)) throw new Error(`Unknown tier: ${minTier}`); // typo'd gate = paid feature given away free
  if (!hasTier(teacher, minTier)) throw new TierError(minTier, tierOf(teacher));
  return teacher;
}

module.exports = { TIERS, tierOf, hasTier, requireTier, TierError };
