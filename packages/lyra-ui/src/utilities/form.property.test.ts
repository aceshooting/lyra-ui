import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { serialize, serializeFormData } from './form.js';

describe('serializeFormData properties', () => {
  it('keeps every value in order, arrays only for repeated keys', () => {
    fc.assert(fc.property(
      fc.array(fc.tuple(fc.constantFrom('a', 'b', 'c', '__proto__', 'constructor'), fc.string()), { maxLength: 20 }),
      (entries) => {
        const formData = new FormData();
        for (const [key, value] of entries) formData.append(key, value);
        const result = serializeFormData(formData);
        const keys = new Set(entries.map(([key]) => key));
        expect(Object.keys(result).sort()).to.deep.equal([...keys].sort());
        for (const key of keys) {
          const expected = entries.filter(([k]) => k === key).map(([, v]) => v);
          const actual = result[key];
          if (expected.length === 1) expect(actual).to.equal(expected[0]);
          else expect(actual).to.deep.equal(expected);
        }
        expect(Object.getPrototypeOf(result)).to.equal(null);
      },
    ), propertyRuns());
  });

  it('serializes a real form, collapsing repeated names to arrays', () => {
    const form = document.createElement('form');
    form.innerHTML = '<input name="a" value="1"><input name="a" value="2"><input name="b" value="x"><input name="c" disabled value="no">';
    expect(serialize(form)).to.deep.equal({ a: ['1', '2'], b: 'x' });
  });
});
