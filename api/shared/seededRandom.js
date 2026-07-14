// Deterministic PRNG for the mock LLM provider (v4.3.0) — same sourceId must always produce the
// same draft. mulberry32, seeded from a simple string hash. Not cryptographic; not used for
// anything security-relevant, only for reproducible mock question selection/shuffling.

function hashString(str) {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns a seeded RNG function (returns floats in [0,1)) for a given seed string.
function seededRng(seedStr) {
  return mulberry32(hashString(String(seedStr)));
}

// Fisher-Yates shuffle using a seeded RNG — deterministic given the same rng state.
function seededShuffle(arr, rng) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

module.exports = { hashString, mulberry32, seededRng, seededShuffle };
