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

it('applies a container contextual default only below every authored value', async () => {
  const wrapper = await fixture(html`
    <div>
      <div id="row" style="--_lr-positioning-strategy-default: fixed"><span id="plain"></span></div>
      <div style="--lr-positioning-strategy: absolute">
        <div style="--_lr-positioning-strategy-default: fixed"><span id="authored"></span></div>
      </div>
      <div style="--_lr-positioning-strategy-default: sideways"><span id="invalid"></span></div>
    </div>
  `);
  const plain = wrapper.querySelector('#plain')!;
  expect(resolveEffectivePositioningStrategy(plain, undefined, 'absolute')).to.equal('fixed');
  expect(resolveEffectivePositioningStrategy(plain, 'absolute', 'absolute')).to.equal('absolute');
  expect(resolveEffectivePositioningStrategy(wrapper.querySelector('#authored')!, undefined, 'fixed')).to.equal('absolute');
  expect(resolveEffectivePositioningStrategy(wrapper.querySelector('#invalid')!, undefined, 'absolute')).to.equal('absolute');
});
