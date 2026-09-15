import { fixture, expect, html } from '@open-wc/testing';
import { resolveEffectivePositioningStrategy } from './positioning-strategy.js';

it('falls back to the caller-supplied default when nothing else applies', async () => {
  const el = await fixture(html`<div></div>`);
  expect(resolveEffectivePositioningStrategy(el, undefined, 'absolute')).to.equal('absolute');
  expect(resolveEffectivePositioningStrategy(el, undefined, 'fixed')).to.equal('fixed');
});

it('lets an explicit value win over everything else, including an ancestor override', async () => {
  const wrapper = await fixture(
    html`<div style="--lr-positioning-strategy: fixed"><span></span></div>`,
  );
  const child = wrapper.querySelector('span')!;
  expect(resolveEffectivePositioningStrategy(child, 'absolute', 'fixed')).to.equal('absolute');
});

it('inherits the custom property from an ancestor when no explicit value is set', async () => {
  const wrapper = await fixture(
    html`<div style="--lr-positioning-strategy: fixed"><span></span></div>`,
  );
  const child = wrapper.querySelector('span')!;
  expect(resolveEffectivePositioningStrategy(child, undefined, 'absolute')).to.equal('fixed');
});

it('reads the property directly on the element itself, not only from an ancestor', async () => {
  const el = await fixture(html`<div style="--lr-positioning-strategy: absolute"></div>`);
  expect(resolveEffectivePositioningStrategy(el, undefined, 'fixed')).to.equal('absolute');
});

it('ignores an unrecognized custom-property value and falls back', async () => {
  const el = await fixture(html`<div style="--lr-positioning-strategy: sticky"></div>`);
  expect(resolveEffectivePositioningStrategy(el, undefined, 'absolute')).to.equal('absolute');
});

it('never changes behaviour for an element with no ancestor override and no explicit value', async () => {
  const wrapper = await fixture(html`<div><span></span></div>`);
  const child = wrapper.querySelector('span')!;
  expect(resolveEffectivePositioningStrategy(child, undefined, 'absolute')).to.equal('absolute');
  expect(resolveEffectivePositioningStrategy(child, undefined, 'fixed')).to.equal('fixed');
});
