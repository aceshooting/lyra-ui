import { expect } from '@open-wc/testing';
import { escapeCsvField, buildCsv } from './csv.js';

it('quotes fields containing commas, quotes, or newlines', () => {
  expect(escapeCsvField('a,b')).to.equal('"a,b"');
  expect(escapeCsvField('a"b')).to.equal('"a""b"');
  expect(escapeCsvField('a\nb')).to.equal('"a\nb"');
  expect(escapeCsvField('plain')).to.equal('plain');
});

it('guards against CSV formula injection', () => {
  expect(escapeCsvField('=SUM(A1)')).to.equal("'=SUM(A1)");
  expect(escapeCsvField('+1')).to.equal("'+1");
  expect(escapeCsvField('-1')).to.equal("'-1");
  expect(escapeCsvField('@cmd')).to.equal("'@cmd");
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
