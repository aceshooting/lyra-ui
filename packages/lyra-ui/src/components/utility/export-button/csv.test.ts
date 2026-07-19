import { expect } from '@open-wc/testing';
import { escapeCsvField, buildCsv } from './csv.js';

it('quotes fields containing commas, quotes, or newlines', () => {
  expect(escapeCsvField('a,b')).to.equal('"a,b"');
  expect(escapeCsvField('a"b')).to.equal('"a""b"');
  expect(escapeCsvField('a\nb')).to.equal('"a\nb"');
  expect(escapeCsvField('plain')).to.equal('plain');
});

it('quotes a field containing a lone CR with no LF', () => {
  expect(escapeCsvField('a\rb')).to.equal('"a\rb"');
});

it('coerces null/undefined to an empty, unquoted field', () => {
  expect(escapeCsvField(null)).to.equal('');
  expect(escapeCsvField(undefined)).to.equal('');
});

it('guards against CSV formula injection', () => {
  expect(escapeCsvField('=SUM(A1:A2)')).to.equal("'=SUM(A1:A2)");
  expect(escapeCsvField('+1')).to.equal("'+1");
  expect(escapeCsvField('@cmd')).to.equal("'@cmd");
});

it('guards against a leading tab or CR being read as formula syntax by some spreadsheet parsers', () => {
  expect(escapeCsvField('\tcmd')).to.equal("'\tcmd");
  // The leading-CR guard fires first (prefixing `'`), then the field still
  // needs quoting because it now contains a bare CR.
  expect(escapeCsvField('\rcmd')).to.equal('"\'\rcmd"');
});

it('does not guard a bare leading "-": negative numbers/currency are not formula syntax', () => {
  expect(escapeCsvField('-5')).to.equal('-5');
  expect(escapeCsvField('-$5.00')).to.equal('-$5.00');
  expect(escapeCsvField(-5)).to.equal('-5');
});

it('prefixes a leading line-feed the same as a leading carriage-return', () => {
  const result = escapeCsvField('\n=cmd|/c calc');
  expect(result.replace(/^"|"$/g, '')).to.match(/^'/);
});

it('builds a header + data CSV joined by CRLF', () => {
  const csv = buildCsv(
    [{ id: 'a', name: 'Alpha' }],
    [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
    ],
  );
  expect(csv).to.equal('ID,Name\r\na,Alpha');
});
