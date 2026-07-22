// Shared approval-gate query — in-partition (join_requests pk /classId), reused by every
// student-facing endpoint that needs to verify "this device is approved for this class" before
// doing anything else. One copy avoids a 3rd/4th divergent version of this query (see the
// rateLimit-import regression in memory for what copy-paste drift costs this repo).
//
// Returns the approved join-request doc (carries teacherId) or null.
async function getApprovedJoinRequest(joinRequestsContainer, deviceId, classId) {
  const { resources } = await joinRequestsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.deviceId = @did AND c.classId = @cid AND c.status = "approved"',
      parameters: [
        { name: '@did', value: deviceId },
        { name: '@cid', value: classId },
      ],
    }, { partitionKey: classId })
    .fetchAll();
  return resources[0] || null;
}

module.exports = { getApprovedJoinRequest };
