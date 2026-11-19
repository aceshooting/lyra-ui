import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { labelWithVisibleText, normalizeLabel } from './accessible-name.js';

it('never yields an empty or untrimmed label', () => {
  fc.assert(fc.property(fc.anything(), (value) => {
    const label = normalizeLabel(value);
    if (label !== undefined) {
      expect(label.length).to.be.greaterThan(0);
      expect(label).to.equal(label.trim());
    }
  }), propertyRuns());
});

it('always keeps non-blank visible text inside the name', () => {
  fc.assert(fc.property(fc.string(), fc.option(fc.string(), { nil: undefined }), (visible, context) => {
    const name = labelWithVisibleText(visible, context);
    const text = visible.trim();
    if (text) expect(name.startsWith(text)).to.equal(true);
    expect(name).to.equal(name.trim());
  }), propertyRuns());
});
