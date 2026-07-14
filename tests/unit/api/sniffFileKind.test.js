// Unit tests for api/shared/sniffFileKind.js, used by api/generationSources.js (v4.3.0).

const { sniffKind } = require('../../../api/shared/sniffFileKind');

describe('sniffKind', () => {
  test('detects PDF via magic bytes', () => {
    expect(sniffKind(Buffer.from('%PDF-1.7 rest of file'))).toBe('pdf');
  });

  test('detects docx via ZIP magic bytes', () => {
    expect(sniffKind(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toBe('docx');
  });

  test('falls back to txt for valid UTF-8 with no magic bytes', () => {
    expect(sniffKind(Buffer.from('Plain readable text content.', 'utf-8'))).toBe('txt');
  });

  test('returns null for invalid UTF-8 binary garbage', () => {
    const invalidUtf8 = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0xc0, 0xc1]);
    expect(sniffKind(invalidUtf8)).toBeNull();
  });
});
