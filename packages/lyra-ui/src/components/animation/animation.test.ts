import { expect, fixture, html } from '@open-wc/testing';
import type { LyraAnimation } from './animation.js';
import './animation.js';

it('is accessible with a slotted animation target', async () => {
  const el = await fixture(html`
      <lyra-animation name="none" play iterations="1">
      <p>Animated content</p>
    </lyra-animation>
  `);
  await expect(el).to.be.accessible();
});

// Regression test: `Element.animate()` throws a synchronous TypeError for a non-finite/negative
// `duration`/`delay`/`endDelay`, and for a negative/non-finite `iterationStart` -- this used to
// crash createAnimation() (called from updated() on nearly every property change) instead of
// clamping to a sane value.
it('does not throw and still produces a real, clamped animation when timing properties are non-finite/out-of-range', async () => {
  const el = (await fixture(html`
    <lyra-animation
      name="fade-in"
      duration="NaN"
      delay="-50"
      end-delay="Infinity"
      iteration-start="-3"
      playback-rate="NaN"
      iterations="NaN"
    >
      <p>content</p>
    </lyra-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const target = el.querySelector('p')!;
  const animations = target.getAnimations();
  expect(animations.length).to.equal(1);

  const timing = animations[0].effect!.getComputedTiming();
  expect(timing.duration).to.equal(1000); // NaN -> falls back to the constructed default
  expect(timing.delay).to.equal(0); // -50 clamped to the non-negative floor
  expect(timing.endDelay).to.equal(0); // Infinity clamped (endDelay has no Infinity sentinel)
  expect(timing.iterationStart).to.equal(0); // -3 clamped to the non-negative floor
  expect(timing.iterations).to.equal(1); // NaN -> falls back to 1, not the Infinity default
});

it('keeps the documented Infinity default for iterations intact (a legitimate WAAPI sentinel)', async () => {
  const el = (await fixture(html`
    <lyra-animation name="fade-in">
      <p>content</p>
    </lyra-animation>
  `)) as LyraAnimation;
  await el.updateComplete;

  const target = el.querySelector('p')!;
  const timing = target.getAnimations()[0].effect!.getComputedTiming();
  expect(timing.iterations).to.equal(Infinity);
});
