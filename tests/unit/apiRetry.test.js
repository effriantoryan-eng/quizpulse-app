// Mirrors the GET retry loop in src/msalInstance.js's installAuthenticatedFetch. The source is an
// ESM module Jest's CJS runner can't require(), so the loop is mirrored here (same convention as
// homeCalendar.test.js). If the boundaries or the retriable-status set change there, change them
// here too. Guards: only idempotent GETs reach this loop, it's bounded at 3 attempts, and the
// final attempt returns whatever it gets (success OR the last 5xx) rather than looping forever.

const RETRIABLE = new Set([429, 500, 502, 503, 504]);

async function fetchWithRetry(doFetch) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    // real code sleeps with backoff between attempts; omitted here so the test is instant
    try {
      const res = await doFetch();
      if (attempt < 2 && RETRIABLE.has(res.status)) continue;
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt >= 2) throw err;
    }
  }
  throw lastErr; // unreachable
}

// doFetch that returns the given sequence of statuses (or throws for entries marked {throw:true}).
function scripted(steps) {
  let i = 0;
  const calls = () => i;
  const fn = async () => {
    const step = steps[Math.min(i, steps.length - 1)];
    i++;
    if (step && step.throw) throw new Error('network');
    return { status: step };
  };
  return { fn, calls };
}

test('returns immediately on first success — no retry', async () => {
  const { fn, calls } = scripted([200]);
  const res = await fetchWithRetry(fn);
  expect(res.status).toBe(200);
  expect(calls()).toBe(1);
});

test('retries a cold-start 503 then returns the eventual 200', async () => {
  const { fn, calls } = scripted([503, 200]);
  const res = await fetchWithRetry(fn);
  expect(res.status).toBe(200);
  expect(calls()).toBe(2);
});

test('gives up after 3 attempts and returns the final 503 (does not loop forever)', async () => {
  const { fn, calls } = scripted([503]);
  const res = await fetchWithRetry(fn);
  expect(res.status).toBe(503);
  expect(calls()).toBe(3);
});

test('does not retry a non-retriable status (404)', async () => {
  const { fn, calls } = scripted([404]);
  const res = await fetchWithRetry(fn);
  expect(res.status).toBe(404);
  expect(calls()).toBe(1);
});

test('retries a thrown network error then succeeds', async () => {
  const { fn, calls } = scripted([{ throw: true }, { throw: true }, 200]);
  const res = await fetchWithRetry(fn);
  expect(res.status).toBe(200);
  expect(calls()).toBe(3);
});

test('rethrows when the network error persists across all attempts', async () => {
  const { fn, calls } = scripted([{ throw: true }]);
  await expect(fetchWithRetry(fn)).rejects.toThrow('network');
  expect(calls()).toBe(3);
});
