// Unit tests for name list sanitization logic.
// These mirror the server-side logic in api/namelist.js:
// trim entries, remove blanks, deduplicate, enforce max 50.

const NAME_LIST_MAX = 50;
const STUDENT_NAME_MAX = 80;

function sanitizeNameList(input) {
  if (!Array.isArray(input)) throw new Error('nameList must be an array of strings');
  const cleaned = [...new Set(
    input
      .filter(n => typeof n === 'string')
      .map(n => n.trim())
      .filter(n => n.length > 0),
  )];
  for (const entry of cleaned) {
    if (entry.length > STUDENT_NAME_MAX) throw new Error(`Each name must be ${STUDENT_NAME_MAX} characters or fewer`);
  }
  if (cleaned.length > NAME_LIST_MAX) throw new Error(`Name list cannot exceed ${NAME_LIST_MAX} entries`);
  return cleaned;
}

describe('nameList sanitization', () => {
  test('trims whitespace from each entry', () => {
    expect(sanitizeNameList(['  Alice  ', ' Bob\t'])).toEqual(['Alice', 'Bob']);
  });

  test('removes blank entries', () => {
    expect(sanitizeNameList(['Alice', '', '   ', 'Bob'])).toEqual(['Alice', 'Bob']);
  });

  test('deduplicates entries (case-sensitive)', () => {
    expect(sanitizeNameList(['Alice', 'Alice', 'alice'])).toEqual(['Alice', 'alice']);
  });

  test('deduplicates after trimming', () => {
    expect(sanitizeNameList(['Alice ', ' Alice'])).toEqual(['Alice']);
  });

  test('throws when any entry exceeds STUDENT_NAME_MAX', () => {
    const longName = 'A'.repeat(STUDENT_NAME_MAX + 1);
    expect(() => sanitizeNameList([longName])).toThrow(/characters or fewer/);
  });

  test('allows entry at exactly STUDENT_NAME_MAX', () => {
    const maxName = 'A'.repeat(STUDENT_NAME_MAX);
    expect(sanitizeNameList([maxName])).toEqual([maxName]);
  });

  test('throws when cleaned list exceeds NAME_LIST_MAX', () => {
    const names = Array.from({ length: NAME_LIST_MAX + 1 }, (_, i) => `Student ${i + 1}`);
    expect(() => sanitizeNameList(names)).toThrow(/exceed/);
  });

  test('allows exactly NAME_LIST_MAX entries', () => {
    const names = Array.from({ length: NAME_LIST_MAX }, (_, i) => `Student ${i + 1}`);
    expect(sanitizeNameList(names)).toHaveLength(NAME_LIST_MAX);
  });

  test('throws when input is not an array', () => {
    expect(() => sanitizeNameList('Alice\nBob')).toThrow(/array/);
  });

  test('filters out non-string elements silently', () => {
    expect(sanitizeNameList(['Alice', 42, null, 'Bob'])).toEqual(['Alice', 'Bob']);
  });
});
