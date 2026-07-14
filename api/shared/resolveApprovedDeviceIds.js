// Resolves the union of approved student device UUIDs across a set of classIds — the same
// roster-resolution technique api/analytics.js uses (demo classes read demoStudents, real
// classes query join_requests filtered by `classId IN (...)`, which Cosmos routes per-partition
// since classId is join_requests' partition key — never a cross-partition scan on deviceId).
//
// ponytail: this duplicates analytics.js's query shape rather than importing a fully shared
// module — analytics.js's version also returns per-class breakdown + studentName, which the
// v4.4.0 traffic funnel doesn't need (it only wants a flat "is this device approved anywhere
// on this quiz" set). Fold the two into one shared module if a third caller needs the same
// per-class roster shape.

async function resolveApprovedDeviceIds(classIds, { classesContainer, joinRequestsContainer }) {
  const deviceIds = new Set();
  if (!classIds || classIds.length === 0) return deviceIds;

  const classIdParams = classIds.map((cid, i) => ({ name: `@cid${i}`, value: cid }));
  const classIdList = classIdParams.map(p => p.name).join(', ');

  const { resources: cls } = await classesContainer.items.query({
    query: `SELECT c.id, c.isDemo, c.demoStudents FROM c WHERE c.id IN (${classIdList})`,
    parameters: classIdParams,
  }).fetchAll();

  const demoClasses = cls.filter(c => c.isDemo === true && Array.isArray(c.demoStudents));
  const realClassIds = cls
    .filter(c => !(c.isDemo === true && Array.isArray(c.demoStudents)))
    .map(c => c.id);

  for (const demoClass of demoClasses) {
    for (const student of demoClass.demoStudents) deviceIds.add(student.studentId);
  }

  if (realClassIds.length > 0) {
    const realIdParams = realClassIds.map((cid, i) => ({ name: `@rcid${i}`, value: cid }));
    const realIdList = realIdParams.map(p => p.name).join(', ');
    const { resources } = await joinRequestsContainer.items.query({
      query: `SELECT c.deviceId FROM c WHERE c.status = "approved" AND c.classId IN (${realIdList})`,
      parameters: realIdParams,
    }).fetchAll();
    for (const row of resources) deviceIds.add(row.deviceId);
  }

  return deviceIds;
}

module.exports = { resolveApprovedDeviceIds };
