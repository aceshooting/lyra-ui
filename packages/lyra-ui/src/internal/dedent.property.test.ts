import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { dedent, stripLeadingNewline } from './dedent.js';

describe('dedent properties', () => {
  it('removes exactly the shared indentation and is idempotent', () => {
    fc.assert(fc.property(
      fc.array(fc.stringMatching(/^[a-z(){};=]{1,8}( [a-z]{1,4})?$/), { minLength: 1, maxLength: 8 }),
      fc.integer({ min: 0, max: 6 }),
      fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 8, maxLength: 8 }),
      (bodies, base, extras) => {
        const lines = bodies.map((body, i) => ' '.repeat(base + (i === 0 ? 0 : extras[i]!)) + body);
        const source = `\n${lines.join('\n')}\n${' '.repeat(base)}`;
        const out = dedent(source);
        const expected = bodies.map((body, i) => ' '.repeat(i === 0 ? 0 : extras[i]!) + body).join('\n');
        expect(out).to.equal(expected);
        expect(dedent(out)).to.equal(out);
      },
    ), propertyRuns());
  });

  it('normalizes line endings and keeps blank interior lines empty', () => {
    expect(dedent('\r\n    a\r\n\r\n      b\r\n  ')).to.equal('a\n\n  b');
  });

  it('strips only one leading newline when asked to keep the text as written', () => {
    expect(stripLeadingNewline('\n\n  a\n')).to.equal('\n  a\n');
    expect(stripLeadingNewline('a')).to.equal('a');
  });
});
