import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraStepper } from './stepper.js';
import './stepper.js';

function expectUnclippedOutline(step: HTMLButtonElement, track: HTMLElement): void {
  const style = getComputedStyle(step);
  const trackStyle = getComputedStyle(track);
  const width = Number.parseFloat(style.outlineWidth);
  const offset = Number.parseFloat(style.outlineOffset);
  expect(step.matches(':focus-visible'), 'the actual step owns keyboard focus styling').to.equal(true);
  expect(style.outlineStyle).to.equal('solid');
  expect(width, 'the rendered outline has nonzero paint width').to.be.greaterThan(0);
  expect(Number.isFinite(offset)).to.equal(true);

  const rect = step.getBoundingClientRect();
  const trackRect = track.getBoundingClientRect();
  const extent = Math.max(0, width + offset);
  const clipLeft = trackRect.left + track.clientLeft;
  const clipTop = trackRect.top + track.clientTop;
  const clipRight = clipLeft + track.clientWidth;
  const clipBottom = clipTop + track.clientHeight;
  expect(rect.width).to.be.greaterThan(0);
  expect(rect.height).to.be.greaterThan(0);
  expect(rect.right, 'the focused step is revealed inline').to.be.greaterThan(clipLeft);
  expect(rect.left, 'the focused step is revealed inline').to.be.lessThan(clipRight);

  // An outline is not included in getBoundingClientRect(). Its computed width and offset give
  // the outer paint bounds; overflow clipping must leave those bounds inside the track's client box.
  if (trackStyle.overflowY !== 'visible') {
    expect(rect.top - extent, 'the top outline lies inside the block clipping edge').to.be.at.least(clipTop - 0.5);
    expect(rect.bottom + extent, 'the bottom outline lies inside the block clipping edge').to.be.at.most(clipBottom + 0.5);
  }
  if (trackStyle.overflowX !== 'visible') {
    expect(rect.left - extent, 'the start outline lies inside the inline clipping edge').to.be.at.least(clipLeft - 0.5);
    expect(rect.right + extent, 'the end outline lies inside the inline clipping edge').to.be.at.most(clipRight + 0.5);
  }
}

for (const direction of ['ltr', 'rtl'] as const) {
  for (const inlineSize of [320, 720]) {
    for (const edge of ['first', 'last'] as const) {
      it(`keeps the ${edge} interactive step outline inside its clipping track at ${inlineSize}px in ${direction}`, async () => {
        const host = await fixture<LyraStepper>(html`<lr-stepper
          dir=${direction}
          aria-label="Setup steps"
          style=${`inline-size:${inlineSize}px`}
          .steps=${[
            { stepId: 'account', label: 'Account details', state: 'current' },
            { stepId: 'permissions', label: 'Review permissions', state: 'pending' },
            { stepId: 'confirmation', label: 'Confirm setup', state: 'pending' },
          ]}
        ></lr-stepper>`);
        await host.updateComplete;
        await twoFrames();
        const track = host.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
        const steps = Array.from(host.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="step"]'));
        expect(steps.length).to.equal(3);
        expect(track.getBoundingClientRect().width).to.be.closeTo(inlineSize, 1);
        if (inlineSize === 320) expect(track.scrollWidth - track.clientWidth).to.be.greaterThan(1);
        else expect(track.scrollWidth - track.clientWidth).to.be.at.most(1);

        await focusByKeyboard(steps[0]!);
        await sendKeys({ press: edge === 'first' ? 'Home' : 'End' });
        const target = edge === 'first' ? steps[0]! : steps[steps.length - 1]!;
        await waitUntil(() => host.shadowRoot!.activeElement === target, 'keyboard navigation reaches the edge step');
        await twoFrames();
        expectUnclippedOutline(target, track);
      });
    }
  }

  it(`keeps the vertical first-step outline visible without a clipping track in ${direction}`, async () => {
    const host = await fixture<LyraStepper>(html`<lr-stepper
      dir=${direction}
      orientation="vertical"
      aria-label="Setup steps"
      style="inline-size:320px"
      .steps=${[
        { stepId: 'account', label: 'Account details', state: 'current' },
        { stepId: 'confirmation', label: 'Confirm setup', state: 'pending' },
      ]}
    ></lr-stepper>`);
    await host.updateComplete;
    const track = host.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const first = host.shadowRoot!.querySelector<HTMLButtonElement>('[part="step"]')!;
    await focusByKeyboard(first);
    await twoFrames();
    expect(getComputedStyle(track).overflowY).to.equal('visible');
    expectUnclippedOutline(first, track);
  });
}
