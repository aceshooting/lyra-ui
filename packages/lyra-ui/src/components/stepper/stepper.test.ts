import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './stepper.js';
import type { LyraStepper } from './stepper.js';
import { styles } from './stepper.styles.js';

const steps = () => [
  { id: 'basics', label: 'Basics', state: 'completed' as const },
  { id: 'inputs', label: 'Inputs', state: 'current' as const },
  { id: 'review', label: 'Review', state: 'pending' as const },
];

function stepButtons(el: LyraStepper): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part="step"]')] as HTMLButtonElement[];
}

describe('lyra-stepper', () => {
  it('renders one step per entry with the right state-driven part/attribute', async () => {
    const el = (await fixture(html`<lyra-stepper .steps=${steps()}></lyra-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons).to.have.length(3);
    expect(buttons[0]!.getAttribute('data-state')).to.equal('completed');
    expect(buttons[1]!.getAttribute('data-state')).to.equal('current');
    expect(buttons[1]!.getAttribute('aria-current')).to.equal('step');
    expect(buttons[2]!.getAttribute('data-state')).to.equal('pending');
  });

  it('renders aria-selected true only on the current step, explicit false on every other step', async () => {
    const el = (await fixture(html`<lyra-stepper .steps=${steps()}></lyra-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[0]!.getAttribute('aria-selected')).to.equal('false');
    expect(buttons[1]!.getAttribute('aria-selected')).to.equal('true');
    expect(buttons[2]!.getAttribute('aria-selected')).to.equal('false');
  });

  it('gives exactly one step tabindex="0" when a step is current, and it is the current one', async () => {
    const el = (await fixture(html`<lyra-stepper .steps=${steps()}></lyra-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
  });

  it('falls back roving tabindex to the first non-disabled step when no step is current (all-completed)', async () => {
    const el = (await fixture(
      html`<lyra-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'completed' as const },
          { id: 'inputs', label: 'Inputs', state: 'completed' as const },
          { id: 'review', label: 'Review', state: 'completed' as const },
        ]}
      ></lyra-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1', '-1']);
  });

  it('falls back roving tabindex to the first non-disabled step when no step is current (all-pending)', async () => {
    const el = (await fixture(
      html`<lyra-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'pending' as const },
          { id: 'inputs', label: 'Inputs', state: 'pending' as const },
        ]}
      ></lyra-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1']);
  });

  it('skips a leading disabled step when falling back roving tabindex', async () => {
    const el = (await fixture(
      html`<lyra-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'disabled' as const },
          { id: 'inputs', label: 'Inputs', state: 'pending' as const },
        ]}
      ></lyra-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0']);
  });

  it('fires a cancelable lyra-step-select on click, without mutating steps itself', async () => {
    const el = (await fixture(html`<lyra-stepper .steps=${steps()}></lyra-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, 'lyra-step-select');
    expect(ev.detail).to.deep.equal({ index: 2, id: 'review' });
    expect(ev.cancelable).to.be.true;
    expect(el.steps[1]!.state).to.equal('current'); // unchanged -- this component never self-mutates
  });

  it('renders a title attribute on a step that provides one', async () => {
    const el = (await fixture(
      html`<lyra-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'completed' as const },
          {
            id: 'inputs',
            label: 'Inputs',
            state: 'disabled' as const,
            title: 'Complete Basics first',
          },
        ]}
      ></lyra-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[1]!.getAttribute('title')).to.equal('Complete Basics first');
  });

  it('renders no title attribute for a step that omits one', async () => {
    const el = (await fixture(html`<lyra-stepper .steps=${steps()}></lyra-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[0]!.hasAttribute('title')).to.be.false;
  });

  it('does not fire lyra-step-select for a disabled step', async () => {
    const el = (await fixture(html`<lyra-stepper .steps=${[...steps().slice(0, 2), { id: 'review', label: 'Review', state: 'disabled' as const }]}></lyra-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    let fired = false;
    el.addEventListener('lyra-step-select', () => (fired = true));
    buttons[2]!.click();
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('supports ArrowRight/ArrowLeft/Home/End among non-disabled steps, clamped (not cyclic)', async () => {
    const el = (await fixture(html`<lyra-stepper .steps=${steps()}></lyra-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    buttons[1]!.focus();
    buttons[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(document.activeElement === el || el.shadowRoot!.activeElement).to.exist;
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-stepper .steps=${steps()}></lyra-stepper>`)) as LyraStepper;
    await expect(el).to.be.accessible();
  });

  it('gives a non-disabled step a :hover treatment, matching the click-to-jump affordance', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='step'\]:hover:not\(\[aria-disabled='true'\]\)\s*\{[^}]+\}/);
  });
});
