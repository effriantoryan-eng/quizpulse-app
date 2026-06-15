const Fuse = require('fuse.js');

// Runs a fuse.js fuzzy match against a name list at threshold 0.4.
// Returns { matchedName, matchScore } where matchScore is similarity (0–1, 1 = perfect).
// If no match is found, matchedName is null and matchScore is 0.
function runFuzzyMatch(nameList, studentName) {
  if (!nameList || nameList.length === 0) return { matchedName: null, matchScore: 0 };
  const fuse = new Fuse(nameList, { includeScore: true, threshold: 0.4 });
  const results = fuse.search(studentName);
  if (results.length === 0) return { matchedName: null, matchScore: 0 };
  const best = results[0];
  return {
    matchedName: best.item,
    matchScore: parseFloat((1 - best.score).toFixed(4)),
  };
}

module.exports = { runFuzzyMatch };
