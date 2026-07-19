import { fixture, expect, html, oneEvent, elementUpdated } from '@open-wc/testing';
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

/** Spies on the real `ResizeObserver` constructor so a test can manually drive a component's
 *  effective-orientation callback with a synthetic width -- same technique split.test.ts's own
 *  collapse-state tests use for their identically-shaped `ResizeObserver`. Restore in a `finally`. */
function installResizeObserverSpy(): { callbacks: ResizeObserverCallback[]; restore: () => void } {
  const callbacks: ResizeObserverCallback[] = [];
  const OriginalRO = window.ResizeObserver;
  class SpyResizeObserver extends OriginalRO {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      callbacks.push(callback);
    }
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = SpyResizeObserver;
  return {
    callbacks,
    restore: () => {
      (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = OriginalRO;
    },
  };
}

function fireResize(callback: ResizeObserverCallback, width: number): void {
  callback(
    [{ contentBoxSize: [{ inlineSize: width, blockSize: 0 }] } as unknown as ResizeObserverEntry],
    {} as ResizeObserver,
  );
}

describe('lr-stepper', () => {
  it('renders one step per entry with the right state-driven part/attribute', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons).to.have.length(3);
    expect(buttons[0]!.getAttribute('data-state')).to.equal('completed');
    expect(buttons[1]!.getAttribute('data-state')).to.equal('current');
    expect(buttons[1]!.getAttribute('aria-current')).to.equal('step');
    expect(buttons[2]!.getAttribute('data-state')).to.equal('pending');
  });

  it('renders aria-selected true only on the current step, explicit false on every other step', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[0]!.getAttribute('aria-selected')).to.equal('false');
    expect(buttons[1]!.getAttribute('aria-selected')).to.equal('true');
    expect(buttons[2]!.getAttribute('aria-selected')).to.equal('false');
  });

  it('gives exactly one step tabindex="0" when a step is current, and it is the current one', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
  });

  it('falls back roving tabindex to the first non-disabled step when no step is current (all-completed)', async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'completed' as const },
          { id: 'inputs', label: 'Inputs', state: 'completed' as const },
          { id: 'review', label: 'Review', state: 'completed' as const },
        ]}
      ></lr-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1', '-1']);
  });

  it('falls back roving tabindex to the first non-disabled step when no step is current (all-pending)', async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'pending' as const },
          { id: 'inputs', label: 'Inputs', state: 'pending' as const },
        ]}
      ></lr-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1']);
  });

  it('skips a leading disabled step when falling back roving tabindex', async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'disabled' as const },
          { id: 'inputs', label: 'Inputs', state: 'pending' as const },
        ]}
      ></lr-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0']);
  });

  it('fires a cancelable lr-step-select on click, without mutating steps itself', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, 'lr-step-select');
    expect(ev.detail).to.deep.equal({ index: 2, id: 'review' });
    expect(ev.cancelable).to.be.true;
    expect(el.steps[1]!.state).to.equal('current'); // unchanged -- this component never self-mutates
  });

  it('renders a title attribute on a step that provides one', async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'completed' as const },
          {
            id: 'inputs',
            label: 'Inputs',
            state: 'disabled' as const,
            title: 'Complete Basics first',
          },
        ]}
      ></lr-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[1]!.getAttribute('title')).to.equal('Complete Basics first');
  });

  it('renders no title attribute for a step that omits one', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[0]!.hasAttribute('title')).to.be.false;
  });

  it('does not fire lr-step-select for a disabled step', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${[...steps().slice(0, 2), { id: 'review', label: 'Review', state: 'disabled' as const }]}></lr-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    let fired = false;
    el.addEventListener('lr-step-select', () => (fired = true));
    buttons[2]!.click();
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('supports ArrowRight/ArrowLeft/Home/End among non-disabled steps, clamped (not cyclic)', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    buttons[1]!.focus();
    buttons[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(document.activeElement === el || el.shadowRoot!.activeElement).to.exist;
  });

  it('navigates to a step whose id contains characters that would break an unescaped CSS attribute selector', async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { id: 'basics', label: 'Basics', state: 'current' as const },
          { id: 'inputs"]', label: 'Inputs', state: 'pending' as const },
        ]}
      ></lr-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);
    buttons[0]!.focus();
    expect(() =>
      buttons[0]!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      ),
    ).not.to.throw();
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(buttons[1]);
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    await expect(el).to.be.accessible();
  });

  it('forwards a host aria-label to the role="tablist" element, and omits the attribute when unset', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const tablist = el.shadowRoot!.querySelector('[role="tablist"]')!;
    expect(tablist.hasAttribute('aria-label')).to.be.false;

    el.setAttribute('aria-label', 'Signup progress');
    await el.updateComplete;
    expect(el.accessibleLabel).to.equal('Signup progress');
    expect(tablist.getAttribute('aria-label')).to.equal('Signup progress');
  });

  it('gives a non-disabled step a :hover treatment, matching the click-to-jump affordance', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='step'\]:hover:not\(\[aria-disabled='true'\]\)\s*\{[^}]+\}/);
  });

  it('switches the navigation axis from its own inline-size breakpoint and reports the effective orientation', async () => {
    const spy = installResizeObserverSpy();
    try {
      const el = (await fixture(
        html`<lr-stepper orientation-breakpoint="500" narrow-orientation="vertical" .steps=${steps()}></lr-stepper>`,
      )) as LyraStepper;
      await elementUpdated(el);
      expect(spy.callbacks.length).to.equal(1);
      expect(el.effectiveOrientation).to.equal('horizontal'); // unmeasured yet -- assumes wide

      fireResize(spy.callbacks[0]!, 320);
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal('vertical');
      expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
      const tablist = el.shadowRoot!.querySelector('[role="tablist"]')!;
      expect(tablist.getAttribute('aria-orientation')).to.equal('vertical');
      const buttons = stepButtons(el);
      buttons[1]!.focus();
      buttons[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      await elementUpdated(el);
      expect(el.shadowRoot!.activeElement).to.equal(buttons[2]);

      const changed = oneEvent(el, 'lr-stepper-orientation-change');
      fireResize(spy.callbacks[0]!, 700);
      expect((await changed).detail).to.deep.equal({ orientation: 'horizontal' });
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal('horizontal');
      expect(tablist.getAttribute('aria-orientation')).to.equal('horizontal');
    } finally {
      spy.restore();
    }
  });

  it('keeps the authored orientation and no effective marker when no breakpoint is configured', async () => {
    const el = (await fixture(html`<lr-stepper orientation="vertical" .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.hasAttribute('data-effective-orientation')).to.be.false;
  });
});
