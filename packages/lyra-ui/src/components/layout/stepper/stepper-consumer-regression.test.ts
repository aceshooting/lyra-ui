import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { twoFrames } from '../../../../test/frames.js';
import { expectOutlineInsideClip } from '../../../../test/focus-outline.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraStepper } from '../../lr-stepper.js';
import '../../lr-stepper.js';

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
        expectOutlineInsideClip(target, track);
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
    expectOutlineInsideClip(first, track);
  });
}
