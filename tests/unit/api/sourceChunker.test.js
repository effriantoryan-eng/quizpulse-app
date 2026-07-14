// Unit tests for api/shared/sourceChunker.js (v4.3.0 AI quiz generation).

const { chunkPages, chunkText, chunkPreview, MAX_CHUNK_CHARS, MAX_TOTAL_CHARS } = require('../../../api/shared/sourceChunker');

describe('chunkPages — PDF path', () => {
  test('one chunk per short page, page numbers 1-indexed', () => {
    const { chunks, pageCount } = chunkPages(['Page one text.', 'Page two text.']);
    expect(pageCount).toBe(2);
    expect(chunks).toEqual([
      { index: 0, page: 1, text: 'Page one text.' },
      { index: 1, page: 2, text: 'Page two text.' },
    ]);
  });

  test('an overlong page splits into multiple chunks sharing the same page number', () => {
    const longPage = 'A'.repeat(MAX_CHUNK_CHARS + 500);
    const { chunks } = chunkPages([longPage]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.page === 1)).toBe(true);
  });

  test('chunks never span two pages', () => {
    const { chunks } = chunkPages(['Short.', 'Another short page.']);
    const pagesSeen = new Set(chunks.map(c => c.page));
    expect(pagesSeen.size).toBe(2);
  });

  test('global char cap truncates and reports truncated:true', () => {
    const hugePage = 'B'.repeat(MAX_TOTAL_CHARS + 1000);
    const { truncated, chunks } = chunkPages([hugePage, 'small trailing page']);
    expect(truncated).toBe(true);
    const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
    expect(totalChars).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
  });

  test('empty pages array yields no chunks', () => {
    expect(chunkPages([]).chunks).toEqual([]);
  });
});

describe('chunkText — docx/txt path', () => {
  test('splits on paragraph boundaries, no page field', () => {
    const text = 'Para one.\n\nPara two.\n\nPara three.';
    const { chunks } = chunkText(text);
    expect(chunks.every(c => c.page === undefined)).toBe(true);
    expect(chunks[0].index).toBe(0);
  });

  test('groups short paragraphs into one chunk up to the char cap', () => {
    const text = Array.from({ length: 5 }, (_, i) => `Short paragraph ${i}.`).join('\n\n');
    const { chunks } = chunkText(text);
    expect(chunks.length).toBe(1);
  });

  test('a single huge paragraph is hard-sliced', () => {
    const text = 'C'.repeat(MAX_CHUNK_CHARS * 2.5);
    const { chunks } = chunkText(text);
    expect(chunks.length).toBe(3);
    expect(chunks.every(c => c.text.length <= MAX_CHUNK_CHARS)).toBe(true);
  });
});

describe('chunkPreview', () => {
  test('first ~6 words, ellipsis when truncated', () => {
    expect(chunkPreview('one two three four five six seven eight')).toBe('one two three four five six…');
  });

  test('short text has no ellipsis', () => {
    expect(chunkPreview('short text')).toBe('short text');
  });
});
