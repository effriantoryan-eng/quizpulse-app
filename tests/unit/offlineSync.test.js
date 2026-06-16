// Unit test for the Background Sync flush logic — mirrors flushPendingResponses() in
// public/sw.js, with an in-memory store standing in for IndexedDB and a mocked fetch.

function makeStore(initialItems) {
  let items = [...initialItems];
  return {
    getAll: async () => items,
    delete: async (id) => { items = items.filter(i => i.id !== id); },
    remaining: () => items,
  };
}

async function flushPendingResponses(store, fetchImpl) {
  const pending = await store.getAll();
  for (const item of pending) {
    try {
      const res = await fetchImpl('/api/responses', {
        method: 'POST',
        body: JSON.stringify({ quizId: item.quizId, studentId: item.studentId, answers: item.answers }),
      });
      if (res.ok || res.status === 409) {
        await store.delete(item.id);
      }
    } catch {
      // leave queued
    }
  }
}

describe('offline sync — flush pending responses', () => {
  test('removes a response from the queue once it submits successfully', async () => {
    const store = makeStore([{ id: 'p1', quizId: 'q1', studentId: 'd1', answers: [] }]);
    const fetchImpl = async () => ({ ok: true, status: 201 });

    await flushPendingResponses(store, fetchImpl);

    expect(store.remaining()).toHaveLength(0);
  });

  test('removes a response from the queue if the server reports it as a duplicate (409)', async () => {
    const store = makeStore([{ id: 'p1', quizId: 'q1', studentId: 'd1', answers: [] }]);
    const fetchImpl = async () => ({ ok: false, status: 409 });

    await flushPendingResponses(store, fetchImpl);

    expect(store.remaining()).toHaveLength(0);
  });

  test('keeps a response queued when the network is still unavailable', async () => {
    const store = makeStore([{ id: 'p1', quizId: 'q1', studentId: 'd1', answers: [] }]);
    const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };

    await flushPendingResponses(store, fetchImpl);

    expect(store.remaining()).toHaveLength(1);
  });

  test('flushes multiple queued responses independently', async () => {
    const store = makeStore([
      { id: 'p1', quizId: 'q1', studentId: 'd1', answers: [] },
      { id: 'p2', quizId: 'q1', studentId: 'd2', answers: [] },
    ]);
    let call = 0;
    const fetchImpl = async () => {
      call++;
      return call === 1 ? { ok: true, status: 201 } : { ok: false, status: 500 };
    };

    await flushPendingResponses(store, fetchImpl);

    const remaining = store.remaining();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('p2');
  });
});
