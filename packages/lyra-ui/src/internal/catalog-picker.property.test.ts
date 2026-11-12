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

it('preserves validated non-enumerable catalog identity fields alongside enumerable extension fields', () => {
  const text = fc.string({ minLength: 1 }).filter(value => value.trim().length > 0);
  fc.assert(fc.property(text, text, fc.string(), (id, label, description) => {
    const source = { id, label, description };
    Object.defineProperty(source, 'id', { enumerable: false });
    Object.defineProperty(source, 'label', { enumerable: false });
    const result = normalizeCatalog([source]);
    expect(result).to.deep.equal([{ id, label, description }]);
    expect(result[0] === source).to.equal(false); expect(Object.isFrozen(result[0])).to.equal(true);
  }), propertyRuns());
});
