import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { forcedColorsPart } from './forced-colors.styles.js';
import { activeFill, hoverFill } from './interactive-control.styles.js';

const identifier = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/);

it('keeps the base verbatim inside the hover and press mixes and uses the matching step', () => {
  fc.assert(fc.property(identifier, (token) => {
    const base = `var(--${token})`;
    expect(hoverFill(base).cssText).to.contain(`${base},`);
    expect(hoverFill(base).cssText).to.contain('var(--lr-color-mix-hover)');
    expect(activeFill(base).cssText).to.contain('var(--lr-color-mix-active)');
    expect(activeFill(base).cssText).not.to.contain('mix-hover');
  }), propertyRuns());
});

it('wraps the part selector in a single forced-colors media rule', () => {
  fc.assert(fc.property(identifier, (token) => {
    const text = forcedColorsPart(`[part='${token}']`).cssText;
    expect(text).to.contain('@media (forced-colors: active)');
    expect(text).to.contain(`[part='${token}'] {`);
    expect(text.match(/@media/g)!.length).to.equal(1);
  }), propertyRuns());
});
