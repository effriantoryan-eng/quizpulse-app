// Single shared daily-quota helper for v4.3.0 AI generation (uploads, generations, regenerations)
// — per CEO review addendum §3.9/§5.4, ALL daily/count quotas route through this one file rather
// than being copy-pasted per endpoint (this codebase has been bitten twice by copy-pasted
// rate-limit plumbing diverging — see the rateLimit-import regression in memory). In-memory
// rateLimit() is never used for daily windows: it resets on Consumption-plan instance recycle,
// which a daily quota can't tolerate.

// Counts docs created since the start of the current UTC day in a teacher-partitioned container
// (source_materials, quiz_drafts) — the "uploads/generations counted from source/draft docs"
// half of §5.4.
async function countCreatedToday(container, teacherId) {
  const startOfDayIso = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const { resources } = await container.items.query({
    query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.createdAt >= @start',
    parameters: [{ name: '@tid', value: teacherId }, { name: '@start', value: startOfDayIso }],
  }).fetchAll();
  return resources[0] || 0;
}

// Regenerations: an atomic Cosmos PATCH `incr` on a date-keyed field on the teacher doc itself
// (`quotaRegen_{yyyymmdd}`) — no new container, per §5.4. Cosmos's `incr` op creates the field at
// 0 before adding if it doesn't exist yet, so no separate initialisation write is needed.
//
// ponytail: the read-then-patch here isn't atomic against a concurrent regenerate from the same
// teacher (two simultaneous requests could both pass the check before either increments) — an
// acceptable soft overage for a per-teacher daily cap, same tolerance the rest of this codebase
// applies to advisory counters. Upgrade to a stored-procedure CAS if abuse is ever observed.
function todayDateKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// Generic attempt-based quota: increments BEFORE the caller's paid attempt runs, not after a
// successful create — a doc-count quota (countCreatedToday) only counts what got PERSISTED, so a
// provider call that fails (502/503) is invisible to it and a retry loop can burn unlimited paid
// spend without ever tripping the cap. Same atomic-incr-on-teacher-doc mechanism as the
// regeneration quota below; `checkAndIncrRegenQuota` is now a thin wrapper over this.
async function checkAndIncrQuota(teachersContainer, teacherId, fieldPrefix, max) {
  const field = `${fieldPrefix}_${todayDateKey()}`;
  let teacherDoc = null;
  try {
    const { resource } = await teachersContainer.item(teacherId, teacherId).read();
    teacherDoc = resource || null;
  } catch (err) {
    if (err.code !== 404) throw err;
  }
  const current = (teacherDoc && teacherDoc[field]) || 0;
  if (current >= max) return false;

  // patch requires an existing document — a teacher doc can be legitimately absent (e.g. a
  // pre-onboarding account in a test/dev context). Advisory counter: tolerate a missing doc by
  // simply not tracking the count rather than failing the caller's whole request, same
  // non-fatal-counter convention as confidenceResponseCount elsewhere in this codebase.
  try {
    await teachersContainer.item(teacherId, teacherId).patch([{ op: 'incr', path: `/${field}`, value: 1 }]);
  } catch (err) {
    if (err.code !== 404) throw err;
  }
  return true;
}

function checkAndIncrRegenQuota(teachersContainer, teacherId, max) {
  return checkAndIncrQuota(teachersContainer, teacherId, 'quotaRegen', max);
}

module.exports = { countCreatedToday, checkAndIncrQuota, checkAndIncrRegenQuota, todayDateKey };
