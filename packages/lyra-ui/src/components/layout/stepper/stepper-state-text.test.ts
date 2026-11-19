import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraStepper, LyraStepItem } from './stepper.class.js';
import './stepper.js';

const steps = (): LyraStepItem[] => [
  { stepId: 'basics', label: 'Basics', state: 'completed' },
  { stepId: 'inputs', label: 'Inputs', state: 'current' },
  { stepId: 'review', label: 'Review', state: 'pending', disabled: true },
  { stepId: 'oops', label: 'Oops', state: 'error' },
];

const stepNodes = (el: LyraStepper): HTMLElement[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="step"]')];
const hiddenText = (step: HTMLElement): string => step.querySelector('.visually-hidden')?.textContent ?? '';

describe('lr-stepper state text (non-colour cue)', () => {
  for (const readonly of [false, true]) {
    it(`exposes completed, error, pending and locked as text when readonly=${readonly}`, async () => {
      const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${steps()} ?readonly=${readonly}></lr-stepper>`);
      const [basics, inputs, review, oops] = stepNodes(el);
      expect(hiddenText(basics!)).to.equal('Completed');
      expect(hiddenText(inputs!)).to.equal('');
      expect(hiddenText(review!)).to.equal(readonly ? 'Not started' : 'Not started, Locked');
      expect(hiddenText(oops!)).to.equal('Error');
    });
  }

  it('lets a strings override reach the state text', async () => {
    const el = await fixture<LyraStepper>(
      html`<lr-stepper .steps=${steps()} .strings=${{ stepperStateError: 'Echec' }}></lr-stepper>`,
    );
    expect(hiddenText(stepNodes(el)[3]!)).to.equal('Echec');
  });

  it('separates combined step states using the effective locale', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper lang="ja"
      .strings=${{ stepperStatePending: '未開始', stepperStateLocked: 'ロック済み' }}
      .steps=${[steps()[2]!]}></lr-stepper>`);
    const expected = new Intl.ListFormat('ja', { type: 'unit' }).format(['未開始', 'ロック済み']);
    expect(hiddenText(stepNodes(el)[0]!)).to.equal(expected);
  });

  it('keeps the state text out of the visible layout box', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${steps()}></lr-stepper>`);
    const hidden = stepNodes(el)[0]!.querySelector('.visually-hidden') as HTMLElement;
    expect(getComputedStyle(hidden).position).to.equal('absolute');
    expect(hidden.getBoundingClientRect().width).to.be.at.most(1);
  });
});

describe('lr-stepper forced colors', () => {
  it('paints the current step with a system fill and outline that its siblings lack', async () => {
    try {
      await setForcedColors('active');
      const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${steps()}></lr-stepper>`);
      const [basics, inputs] = stepNodes(el);
      expect(getComputedStyle(inputs!).outlineStyle).to.equal('solid');
      expect(getComputedStyle(basics!).outlineStyle).to.equal('none');
      expect(getComputedStyle(inputs!).backgroundColor).not.to.equal(getComputedStyle(basics!).backgroundColor);
    } finally {
      await setForcedColors('none');
    }
  });
});

describe('lr-stepper focus repair', () => {
  it('does not drop focus to the body when a focused step turns read-only in an overflowing strip', async () => {
    const el = await fixture<LyraStepper>(
      html`<lr-stepper style="inline-size: 60px" .steps=${steps()}></lr-stepper>`,
    );
    await focusByKeyboard(stepNodes(el).find((step) => step.tabIndex === 0)!);
    el.readonly = true;
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(document.activeElement === document.body).to.equal(false);
    expect(document.activeElement === el).to.equal(true);
  });
});

describe('lr-stepper held activation key', () => {
  it('leaves composing and modified keys to the browser', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${steps()}></lr-stepper>`);
    const target = stepNodes(el).find(step => step.tabIndex === 0)!;
    await focusByKeyboard(target);
    let selections = 0;
    el.addEventListener('lr-step-select', () => { selections++; });
    for (const key of ['ArrowRight', 'Enter']) {
      for (const init of [{ keyCode: 229 }, { isComposing: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
        const event = new KeyboardEvent('keydown', { key, ...init, bubbles: true, composed: true, cancelable: true });
        target.dispatchEvent(event);
        expect(event.defaultPrevented).to.equal(false);
      }
    }
    expect(el.shadowRoot!.activeElement === target).to.equal(true);
    expect(selections).to.equal(0);
  });

  it('activates once for a held Enter', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${steps()}></lr-stepper>`);
    let selects = 0;
    el.addEventListener('lr-step-select', () => (selects += 1));
    const target = stepNodes(el).find((step) => step.tabIndex === 0)!;
    await focusByKeyboard(target);
    for (const repeat of [false, true, true]) {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat, bubbles: true, composed: true, cancelable: true }));
    }
    expect(selects).to.equal(1);
  });
});

describe('lr-stepper removed enum attributes', () => {
  it('restores the declared defaults when orientation attributes are removed', async () => {
    const el = await fixture<LyraStepper>(
      html`<lr-stepper orientation="vertical" narrow-orientation="horizontal" orientation-breakpoint-basis="viewport" .steps=${steps()}></lr-stepper>`,
    );
    el.removeAttribute('orientation');
    el.removeAttribute('narrow-orientation');
    el.removeAttribute('orientation-breakpoint-basis');
    await el.updateComplete;
    expect(el.orientation).to.equal('horizontal');
    expect(el.narrowOrientation).to.equal('vertical');
    expect(el.orientationBreakpointBasis).to.equal('container');
  });
});
