import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { buildCsv, csvRow, escapeCsvField } from './csv.js';

describe('csv properties', () => {
  it('a text field never starts with a formula sigil unquoted and quoting is balanced', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const out = escapeCsvField(value);
        const bare = out.startsWith('"') ? out.slice(1, -1).replace(/""/g, '"') : out;
        expect(/^[\s=+\-@＝＋－＠]/u.test(bare) && !bare.startsWith("'")).to.equal(false);
        if (!out.startsWith('"')) expect(/[",\r\n]/.test(out)).to.equal(false);
      }),
      propertyRuns(),
    );
  });
  it('csvRow joins escaped fields and buildCsv rows match it', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 8 }), { minLength: 1, maxLength: 5 }), (values) => {
        expect(csvRow(values)).to.equal(values.map((v) => escapeCsvField(v)).join(','));
        const columns = values.map((_, i) => ({ key: String(i), label: 'h' + i }));
        const row = Object.fromEntries(values.map((v, i) => [String(i), v]));
        expect(buildCsv([row], columns).endsWith('\r\n' + csvRow(values))).to.equal(true);
      }),
      propertyRuns(),
    );
  });
});
