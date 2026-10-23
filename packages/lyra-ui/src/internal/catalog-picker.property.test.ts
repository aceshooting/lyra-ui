import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { normalizeCatalog } from './catalog-picker.js';

it('normalizes plain string catalogs to first nonblank occurrences without mutating caller data', () => {
  const entry = fc.oneof(
    fc.constantFrom('', ' ', '\t', '\n', 'alpha', 'beta', ' alpha '),
    fc.string({ maxLength: 24 }),
  );
  fc.assert(fc.property(fc.array(entry, { maxLength: 128 }), catalog => {
    const before = catalog.slice();
    // Each candidate asks whether an earlier position already owns the exact id.
    // This oracle uses positional comparison rather than the normalizer's retained-id set.
    const expected = before
      .filter((id, index) => id.trim().length > 0 && before.indexOf(id) === index)
      .map(id => ({ id, label: id }));
    expect(normalizeCatalog(catalog)).to.deep.equal(expected);
    expect(catalog).to.deep.equal(before);
  }), propertyRuns());
});
