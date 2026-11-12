import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { resolveLocalizedParts, resolveLyraString, snapshotLyraLocaleStrings } from './localization-runtime.js';

it('rejects unknown plural categories without discarding neighboring string overrides', () => {
  const host = document.createElement('div');
  host.setAttribute('locale', 'en');
  fc.assert(fc.property(fc.string({ maxLength: 40 }), fc.string({ maxLength: 80 }), (suffix, label) => {
    const plural = { one: 'One item', other: 'Several items', [`unsupported-${suffix}`]: 'Invalid category' };
    const snapshot = snapshotLyraLocaleStrings({ items: plural, label });
    expect(Object.keys(snapshot)).to.deep.equal(['label']);
    expect(resolveLyraString(host, 'label', snapshot)).to.equal(label);
    expect(resolveLyraString(host, 'items', snapshot, 'Fallback items', { count: 2 })).to.equal('Fallback items');
    expect(Object.isFrozen(snapshot)).to.equal(true);
  }), propertyRuns());
});

it('preserves arbitrary UTF-16 text around repeated rich localized values', () => {
  const text = fc.array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 200 })
    .map(units => units.map(unit => String.fromCharCode(unit)).join(''));
  fc.assert(fc.property(text, text, text, (prefix, middle, suffix) => {
    const template = `${prefix}{value}${middle}{value}${suffix}`;
    const result = resolveLocalizedParts(template, marker => `${prefix}${marker}${middle}${marker}${suffix}`);
    expect(result).to.deep.equal([prefix, middle, suffix]);
  }), propertyRuns());
});
