import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraStepper, LyraStepItem } from './stepper.class.js';
import './stepper.js';

const validSteps: LyraStepItem[] = [
  { stepId: 'review', label: 'Review', state: 'current' },
  { stepId: 'submit', label: 'Submit', state: 'pending' },
];

const stepButtons = (el: LyraStepper): HTMLElement[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="step"]')];

function press(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('lr-stepper input normalization', () => {
  it('treats a non-array steps value as an empty list', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${validSteps}></lr-stepper>`);
    expect(stepButtons(el)).to.have.length(2);
    el.steps = { length: 1, 0: validSteps[0] } as unknown as LyraStepItem[];
    await el.updateComplete;
    expect(el.steps).to.have.length(0);
    expect(stepButtons(el)).to.have.length(0);
  });

  it('skips null and primitive entries while keeping valid neighbours', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper></lr-stepper>`);
    el.steps = [null, 'review', 3, validSteps[0], undefined, validSteps[1]] as unknown as LyraStepItem[];
    await el.updateComplete;
    expect(el.steps.map((step) => step.stepId)).to.deep.equal(['review', 'submit']);
    expect(stepButtons(el).map((step) => step.dataset['stepId'])).to.deep.equal(['review', 'submit']);
  });
});

describe('lr-stepper keyboard edges', () => {
  it('ignores navigation keys when every step is disabled', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper
      .steps=${validSteps.map((step) => ({ ...step, disabled: true }))}
    ></lr-stepper>`);
    const event = press(stepButtons(el)[0]!, 'ArrowRight');
    expect(event.defaultPrevented).to.equal(false);
  });

  it('leaves an unrelated key to the page', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${validSteps}></lr-stepper>`);
    const first = stepButtons(el)[0]!;
    first.focus();
    const event = press(first, 'x');
    expect(event.defaultPrevented).to.equal(false);
    expect(el.shadowRoot!.activeElement === first).to.equal(true);
  });
});

describe('lr-stepper reconnect', () => {
  it('re-measures its container on reconnect so a width change while detached flips orientation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size: 300px">
      <lr-stepper orientation-breakpoint="500" narrow-orientation="vertical" .steps=${validSteps}></lr-stepper>
    </div>`);
    const el = wrapper.querySelector<LyraStepper>('lr-stepper')!;
    await waitUntil(() => el.effectiveOrientation === 'vertical', 'a narrow container stacks the steps');
    el.remove();
    wrapper.style.inlineSize = '800px';
    wrapper.append(el);
    await waitUntil(() => el.effectiveOrientation === 'horizontal', 'the reconnected stepper observes its wider container');
    expect(el.getAttribute('orientation')).to.equal('horizontal');
  });
});
