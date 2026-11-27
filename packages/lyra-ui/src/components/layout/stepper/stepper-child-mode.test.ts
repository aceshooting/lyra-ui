import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraStepper, LyraStepChangeDetail } from './stepper.class.js';
import type { LyraStep } from './step.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { sinkTexts } from '../../../../test/announcements.js';
import '../../lr-stepper.js';
import '../../lr-step.js';

const three = (clickable = false) => html`
  <lr-stepper label="Checkout" ?clickable=${clickable}>
    <lr-step name="cart">Cart</lr-step>
    <lr-step name="shipping">Shipping<span slot="description">Where to?</span></lr-step>
    <lr-step name="pay">Payment</lr-step>
  </lr-stepper>
`;

const stepsOf = (el: Element): LyraStep[] => [...el.querySelectorAll<LyraStep>('lr-step')];
const activeNames = (el: Element): string[] => stepsOf(el).filter((s) => s.active).map((s) => s.name);
const key = (target: EventTarget, name: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true }));
};
const status = (step: LyraStep): string =>
  step.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim();

describe('lr-stepper child mode', () => {
  it('numbers its lr-step children and marks the first as current', async () => {
    const el = await fixture<LyraStepper>(three());
    await el.updateComplete;
    await waitUntil(() => stepsOf(el)[0]!.position === 1);
    const steps = stepsOf(el);
    expect(steps.map((s) => s.position)).to.deep.equal([1, 2, 3]);
    expect(activeNames(el)).to.deep.equal(['cart']);
    expect(steps[0]!.getAttribute('role')).to.equal('listitem');
    expect(steps[0]!.getAttribute('aria-current')).to.equal('step');
    expect(steps[1]!.hasAttribute('aria-current')).to.equal(false);
    const base = el.shadowRoot!.querySelector('[part~="base"]')!;
    expect(base.getAttribute('role')).to.equal('list');
    expect(el.shadowRoot!.querySelector('[part="stepper"]')!.getAttribute('role')).to.equal('group');
    expect(el.shadowRoot!.querySelector('[part="stepper"]')!.getAttribute('aria-label')).to.equal('Checkout');
    expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Step 1 of 3');
    expect(el.shadowRoot!.querySelector('slot')).to.not.equal(null);
    expect(el.shadowRoot!.querySelector('[part="step"]') === null).to.equal(true);
  });

  it('uses a navigation landmark while clickable, and a localized default name', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper clickable><lr-step name="a">A</lr-step><lr-step name="b">B</lr-step></lr-stepper>
    `);
    const wrapper = el.shadowRoot!.querySelector('[part="stepper"]')!;
    expect(wrapper.localName).to.equal('nav');
    expect(wrapper.getAttribute('aria-label')).to.equal('Steps');
  });

  it('follows `active`, falls back to the first step for an unknown name', async () => {
    const el = await fixture<LyraStepper>(three());
    el.active = 'shipping';
    await el.updateComplete;
    expect(activeNames(el)).to.deep.equal(['shipping']);
    expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Step 2 of 3');
    el.active = 'nope';
    await el.updateComplete;
    expect(activeNames(el)).to.deep.equal(['cart']);
  });

  it('picks up children added and removed after the first render', async () => {
    const el = await fixture<LyraStepper>(three());
    const added = document.createElement('lr-step') as LyraStep;
    added.name = 'done';
    added.textContent = 'Done';
    el.append(added);
    await waitUntil(() => added.position === 4);
    expect(added.last).to.equal(true);
    stepsOf(el)[0]!.remove();
    await waitUntil(() => added.position === 3);
    expect(stepsOf(el)[0]!.first).to.equal(true);
  });

  it('skips native-hidden children for keyboard and programmatic navigation', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper clickable linear>
      <lr-step name="a" completed>A</lr-step><lr-step name="b" hidden>B</lr-step>
      <lr-step name="c">C</lr-step>
    </lr-stepper>`);
    const [a, b, c] = stepsOf(el) as [LyraStep, LyraStep, LyraStep];
    await Promise.all([a.updateComplete, b.updateComplete, c.updateComplete]);
    const button = (step: LyraStep) => step.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
    expect(c.position).to.equal(2);
    expect(c.locked).to.equal(false);
    await focusByKeyboard(button(a));
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => document.activeElement === c);
    el.goTo('b');
    expect(el.active).to.equal('');
    el.next();
    expect(el.active).to.equal('c');
    el.previous();
    expect(el.active).to.equal('a');
    expect(b.hasAttribute('hidden')).to.equal(true);
  });

  it('reconciles a focused child that becomes hidden and restores it when shown', async () => {
    const el = await fixture<LyraStepper>(three(true));
    el.active = 'shipping';
    await el.updateComplete;
    const [cart, shipping, pay] = stepsOf(el) as [LyraStep, LyraStep, LyraStep];
    const button = (step: LyraStep) => step.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
    await focusByKeyboard(button(shipping));
    shipping.hidden = true;
    await waitUntil(() => document.activeElement === cart && button(cart).tabIndex === 0);
    expect(activeNames(el)).to.deep.equal(['cart']);
    expect(button(shipping).tabIndex).to.equal(-1);
    expect(pay.position).to.equal(2);
    expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Step 1 of 2');
    shipping.hidden = false;
    await waitUntil(() => button(shipping).tabIndex === 0);
    expect(activeNames(el)).to.deep.equal(['shipping']);
    expect(pay.position).to.equal(3);
    expect(document.activeElement === cart).to.equal(true);
  });

  it('keeps an empty child strip until a step is shown again', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper active="a" clickable>
      <lr-step name="a" hidden>A</lr-step><lr-step name="b" hidden>B</lr-step>
    </lr-stepper>`);
    const [a, b] = stepsOf(el) as [LyraStep, LyraStep];
    expect(el.shadowRoot!.querySelectorAll('[part~="steps"] slot').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="summary"]').length).to.equal(0);
    el.next();
    expect(el.active).to.equal('a');
    b.hidden = false;
    await waitUntil(() => b.active && b.tabStop);
    expect(b.position).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Step 1 of 1');
    a.hidden = false;
    await waitUntil(() => a.active && a.tabStop && !b.active && !b.tabStop);
    expect(b.position).to.equal(2);
  });

  it('abandons a step change if the request listener hides its destination', async () => {
    const el = await fixture<LyraStepper>(three());
    const [, shipping] = stepsOf(el);
    let changes = 0;
    el.addEventListener('lr-before-step-change', () => { shipping!.hidden = true; }, { once: true });
    el.addEventListener('lr-step-change', () => { changes++; });
    el.next();
    await el.updateComplete;
    expect(el.active).to.equal('');
    expect(changes).to.equal(0);
    el.next();
    await waitUntil(() => changes === 1);
    expect(el.active).to.equal('pay');
  });

  it('renders status text and markers for each step state', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper active="b">
        <lr-step name="a" completed>A</lr-step>
        <lr-step name="b">B</lr-step>
        <lr-step name="c">C</lr-step>
        <lr-step name="d" loading>D</lr-step>
        <lr-step name="e" disabled>E</lr-step>
      </lr-stepper>
    `);
    await waitUntil(() => stepsOf(el)[4]!.position === 5);
    const [a, b, c, d, e] = stepsOf(el) as [LyraStep, LyraStep, LyraStep, LyraStep, LyraStep];
    await Promise.all(stepsOf(el).map((s) => s.updateComplete));
    expect(status(a)).to.equal('Completed');
    expect(a.shadowRoot!.querySelector('[part="marker"] .check')).to.not.equal(null);
    expect(status(b)).to.equal('');
    expect(b.shadowRoot!.querySelector('[part="marker"]')!.textContent!.trim()).to.equal('2');
    expect(status(c)).to.equal('Not started');
    expect(status(d)).to.equal('Loading');
    expect(d.shadowRoot!.querySelector('[part="spinner"]')).to.not.equal(null);
    expect(d.getAttribute('aria-busy')).to.equal('true');
    expect(status(e)).to.equal('Unavailable');
  });

  it('renders icon and description slots', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper>
        <lr-step name="a"><span slot="icon" id="glyph">*</span>A<span slot="description">About A</span></lr-step>
      </lr-stepper>
    `);
    const step = stepsOf(el)[0]!;
    await step.updateComplete;
    const icon = step.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="icon"]')!;
    expect(icon.assignedElements().map((n) => n.id)).to.deep.equal(['glyph']);
    expect(step.shadowRoot!.querySelector('[part="description"]')!.hasAttribute('hidden')).to.equal(false);
  });

  describe('navigation', () => {
    it('goTo, next and previous change the step and emit before/after events', async () => {
      const el = await fixture<LyraStepper>(three());
      const before: LyraStepChangeDetail[] = [];
      const after: LyraStepChangeDetail[] = [];
      el.addEventListener('lr-before-step-change', (e) => before.push((e as CustomEvent<LyraStepChangeDetail>).detail));
      el.addEventListener('lr-step-change', (e) => after.push((e as CustomEvent<LyraStepChangeDetail>).detail));
      el.next();
      await waitUntil(() => after.length === 1);
      expect(el.active).to.equal('shipping');
      expect(before[0]!.name).to.equal('shipping');
      expect(before[0]!.previousName).to.equal('cart');
      expect(before[0]!.step === stepsOf(el)[1]).to.equal(true);
      expect(before[0]!.previousStep === stepsOf(el)[0]).to.equal(true);
      el.goTo('pay');
      await waitUntil(() => after.length === 2);
      expect(activeNames(el)).to.deep.equal(['pay']);
      el.next();
      expect(el.active).to.equal('pay');
      el.previous();
      await waitUntil(() => after.length === 3);
      expect(el.active).to.equal('shipping');
      el.goTo('missing');
      el.goTo('shipping');
      expect(after).to.have.length(3);
    });

    it('lets lr-before-step-change veto the move', async () => {
      const el = await fixture<LyraStepper>(three());
      let changed = 0;
      el.addEventListener('lr-before-step-change', (e) => e.preventDefault());
      el.addEventListener('lr-step-change', () => (changed += 1));
      el.goTo('shipping');
      await el.updateComplete;
      expect(el.active).to.equal('');
      expect(activeNames(el)).to.deep.equal(['cart']);
      expect(changed).to.equal(0);
    });

    it('announces the new position politely', async () => {
      const el = await fixture<LyraStepper>(three());
      el.goTo('shipping');
      await waitUntil(() => sinkTexts('polite').includes('Step 2 of 3'));
    });

    it('does not reach disabled steps', async () => {
      const el = await fixture<LyraStepper>(html`
        <lr-stepper><lr-step name="a">A</lr-step><lr-step name="b" disabled>B</lr-step></lr-stepper>
      `);
      el.next();
      await el.updateComplete;
      expect(el.active).to.equal('');
    });
  });

  describe('linear', () => {
    it('locks every step past the first incomplete one and blocks goTo', async () => {
      const el = await fixture<LyraStepper>(html`
        <lr-stepper linear>
          <lr-step name="a" completed>A</lr-step>
          <lr-step name="b">B</lr-step>
          <lr-step name="c">C</lr-step>
        </lr-stepper>
      `);
      await waitUntil(() => stepsOf(el)[2]!.position === 3);
      const [a, b, c] = stepsOf(el) as [LyraStep, LyraStep, LyraStep];
      expect([a.locked, b.locked, c.locked]).to.deep.equal([false, false, true]);
      await c.updateComplete;
      expect(status(c)).to.equal('Locked');
      el.goTo('c');
      expect(el.active).to.equal('');
      el.goTo('b');
      await waitUntil(() => el.active === 'b');
      b.completed = true;
      await waitUntil(() => !c.locked);
      el.next();
      await waitUntil(() => el.active === 'c');
    });
  });

  describe('clickable', () => {
    it('renders buttons with one roving tab stop and jumps on click', async () => {
      const el = await fixture<LyraStepper>(three(true));
      await waitUntil(() => stepsOf(el)[2]!.position === 3);
      await Promise.all(stepsOf(el).map((s) => s.updateComplete));
      const buttons = stepsOf(el).map((s) => s.shadowRoot!.querySelector<HTMLButtonElement>('[part="button"]')!);
      expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);
      expect(buttons[0]!.getAttribute('aria-current')).to.equal('step');
      expect(stepsOf(el)[0]!.hasAttribute('aria-current')).to.equal(false);
      buttons[2]!.click();
      await waitUntil(() => el.active === 'pay');
      await Promise.all(stepsOf(el).map((s) => s.updateComplete));
      expect(buttons[2]!.getAttribute('aria-current')).to.equal('step');
      expect(buttons.map((b) => b.tabIndex)).to.deep.equal([-1, -1, 0]);
    });

    it('does nothing on click when not clickable', async () => {
      const el = await fixture<LyraStepper>(three());
      stepsOf(el)[2]!.click();
      await el.updateComplete;
      expect(el.active).to.equal('');
    });

    it('disables locked and disabled step buttons', async () => {
      const el = await fixture<LyraStepper>(html`
        <lr-stepper clickable linear>
          <lr-step name="a">A</lr-step><lr-step name="b">B</lr-step><lr-step name="c" disabled>C</lr-step>
        </lr-stepper>
      `);
      await waitUntil(() => stepsOf(el)[2]!.position === 3);
      await Promise.all(stepsOf(el).map((s) => s.updateComplete));
      const disabled = stepsOf(el).map((s) => s.shadowRoot!.querySelector<HTMLButtonElement>('[part="button"]')!.disabled);
      expect(disabled).to.deep.equal([false, true, true]);
    });

    it('moves focus with arrow keys, swapping them under RTL, and Home/End', async () => {
      for (const dir of ['ltr', 'rtl'] as const) {
        const el = await fixture<LyraStepper>(
          html`<div dir=${dir}>
            <lr-stepper clickable>
              <lr-step name="a">A</lr-step><lr-step name="b">B</lr-step><lr-step name="c">C</lr-step>
            </lr-stepper>
          </div>`
        ).then((wrap) => wrap.querySelector<LyraStepper>('lr-stepper')!);
        await waitUntil(() => stepsOf(el)[2]!.position === 3);
        await Promise.all(stepsOf(el).map((s) => s.updateComplete));
        const [a, b, c] = stepsOf(el) as [LyraStep, LyraStep, LyraStep];
        await focusByKeyboard(a);
        expect(el.matches(':focus-within')).to.equal(true);
        key(a.shadowRoot!.querySelector('[part="button"]')!, dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
        expect(document.activeElement === b, `${dir} forward`).to.equal(true);
        key(b.shadowRoot!.querySelector('[part="button"]')!, dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
        expect(document.activeElement === a, `${dir} back`).to.equal(true);
        key(a.shadowRoot!.querySelector('[part="button"]')!, 'End');
        expect(document.activeElement === c, `${dir} end`).to.equal(true);
        key(c.shadowRoot!.querySelector('[part="button"]')!, 'Home');
        expect(document.activeElement === a, `${dir} home`).to.equal(true);
        // Clamped at the ends.
        key(a.shadowRoot!.querySelector('[part="button"]')!, dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
        expect(document.activeElement === a).to.equal(true);
      }
    });
  });

  describe('data-stepper invokers', () => {
    it('drives the stepper named by id from anywhere on the page', async () => {
      const wrap = await fixture<HTMLElement>(html`
        <div>
          <button id="n" data-stepper="next flow">Next</button>
          <button id="p" data-stepper="previous flow">Back</button>
          <button id="g" data-stepper="goto flow pay">Pay</button>
          <lr-stepper id="flow">
            <lr-step name="cart">Cart</lr-step><lr-step name="shipping">Shipping</lr-step><lr-step name="pay">Pay</lr-step>
          </lr-stepper>
        </div>
      `);
      const el = wrap.querySelector<LyraStepper>('lr-stepper')!;
      await waitUntil(() => stepsOf(el)[2]!.position === 3);
      wrap.querySelector<HTMLElement>('#n')!.click();
      await waitUntil(() => el.active === 'shipping');
      wrap.querySelector<HTMLElement>('#g')!.click();
      await waitUntil(() => el.active === 'pay');
      wrap.querySelector<HTMLElement>('#p')!.click();
      await waitUntil(() => el.active === 'shipping');
    });

    it('resolves an invoker inside the stepper without an id, and ignores unknown commands', async () => {
      const el = await fixture<LyraStepper>(html`
        <lr-stepper>
          <lr-step name="a">A<button id="in" data-stepper="next">Go</button><button id="bad" data-stepper="explode x">X</button></lr-step>
          <lr-step name="b">B</lr-step>
        </lr-stepper>
      `);
      el.querySelector<HTMLElement>('#bad')!.click();
      await el.updateComplete;
      expect(el.active).to.equal('');
      el.querySelector<HTMLElement>('#in')!.click();
      await waitUntil(() => el.active === 'b');
    });
  });

  describe('orientation', () => {
    it('stacks an auto stepper that is too narrow and rows it when wide', async () => {
      const wrap = await fixture<HTMLElement>(html`
        <div style="inline-size: 160px">
          <lr-stepper orientation="auto" style="font-size: 16px">
            <lr-step name="a">A</lr-step><lr-step name="b">B</lr-step><lr-step name="c">C</lr-step>
          </lr-stepper>
        </div>
      `);
      const el = wrap.querySelector<LyraStepper>('lr-stepper')!;
      await waitUntil(() => el.getAttribute('data-effective-orientation') === 'vertical');
      expect(el.effectiveOrientation).to.equal('vertical');
      await waitUntil(() => stepsOf(el).every((s) => s.vertical));
      wrap.style.inlineSize = '900px';
      await waitUntil(() => el.getAttribute('data-effective-orientation') === 'horizontal');
      await waitUntil(() => stepsOf(el).every((s) => !s.vertical));
    });

    it('keeps an explicit orientation untouched by width', async () => {
      const el = await fixture<LyraStepper>(html`
        <lr-stepper orientation="vertical"><lr-step name="a">A</lr-step><lr-step name="b">B</lr-step></lr-stepper>
      `);
      expect(el.hasAttribute('data-effective-orientation')).to.equal(false);
      expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).flexDirection).to.equal('column');
    });

    it('uses Up/Down while stacked', async () => {
      const el = await fixture<LyraStepper>(html`
        <lr-stepper clickable orientation="vertical"><lr-step name="a">A</lr-step><lr-step name="b">B</lr-step></lr-stepper>
      `);
      await waitUntil(() => stepsOf(el)[1]!.position === 2);
      await Promise.all(stepsOf(el).map((s) => s.updateComplete));
      const [a, b] = stepsOf(el) as [LyraStep, LyraStep];
      await focusByKeyboard(a);
      key(a.shadowRoot!.querySelector('[part="button"]')!, 'ArrowDown');
      expect(document.activeElement === b).to.equal(true);
    });
  });

  describe('motion', () => {
    it('animates the attention marker, and stops under reduced motion', async () => {
      const el = await fixture<LyraStepper>(html`
        <lr-stepper><lr-step name="a" attention="pulse">A</lr-step><lr-step name="b" attention="bounce">B</lr-step></lr-stepper>
      `);
      const [a, b] = stepsOf(el) as [LyraStep, LyraStep];
      await Promise.all([a.updateComplete, b.updateComplete]);
      const animation = (s: LyraStep) => getComputedStyle(s.shadowRoot!.querySelector('[part="marker"]')!).animationName;
      await setReducedMotion('no-preference');
      expect(animation(a)).to.equal('lr-step-pulse');
      expect(animation(b)).to.equal('lr-step-bounce');
      await setReducedMotion('reduce');
      try {
        expect(animation(a)).to.equal('none');
        expect(animation(b)).to.equal('none');
      } finally {
        await setReducedMotion('no-preference');
      }
    });
  });

  describe('accessibility', () => {
    it('is accessible as a labelled group', async () => {
      const el = await fixture<LyraStepper>(three());
      await Promise.all(stepsOf(el).map((s) => s.updateComplete));
      await expect(el).to.be.accessible();
    });

    it('is accessible as a clickable navigation with a completed, a loading and a locked step', async () => {
      const el = await fixture<LyraStepper>(html`
        <lr-stepper clickable linear label="Setup">
          <lr-step name="a" completed variant="success">A</lr-step>
          <lr-step name="b" loading>B<span slot="description">Working</span></lr-step>
          <lr-step name="c">C</lr-step>
        </lr-stepper>
      `);
      await waitUntil(() => stepsOf(el)[2]!.position === 3);
      await Promise.all(stepsOf(el).map((s) => s.updateComplete));
      await expect(el).to.be.accessible();
    });
  });
});

describe('lr-stepper data-driven mode alongside child mode', () => {
  it('keeps the steps array rendering exactly as before', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper
        .steps=${[
          { stepId: 'a', label: 'A', state: 'completed' },
          { stepId: 'b', label: 'B', state: 'current' },
        ]}
      ></lr-stepper>
    `);
    const parts = [...el.shadowRoot!.querySelectorAll('[part="step"]')];
    expect(parts).to.have.length(2);
    expect(el.shadowRoot!.querySelector('slot') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="stepper"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('role')).to.equal('list');
    let selected = 0;
    el.addEventListener('lr-step-select', () => (selected += 1));
    (parts[0] as HTMLElement).click();
    expect(selected).to.equal(1);
    expect(el.hasAttribute('data-effective-orientation')).to.equal(false);
  });

  it('prefers the steps array over lr-step children', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper .steps=${[{ stepId: 'a', label: 'A', state: 'current' }]}>
        <lr-step name="x">X</lr-step>
      </lr-stepper>
    `);
    expect(el.shadowRoot!.querySelectorAll('[part="step"]')).to.have.length(1);
    expect(el.shadowRoot!.querySelector('slot') === null).to.equal(true);
    el.goTo('x');
    expect(el.active).to.equal('');
  });

  it('switches into child mode when the array is emptied', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper .steps=${[{ stepId: 'a', label: 'A', state: 'current' }]}>
        <lr-step name="x">X</lr-step><lr-step name="y">Y</lr-step>
      </lr-stepper>
    `);
    el.steps = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('slot')).to.not.equal(null);
    await waitUntil(() => stepsOf(el)[1]!.position === 2);
  });

  it('supports orientation="auto" in data-driven mode', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div style="inline-size: 200px">
        <lr-stepper
          orientation="auto"
          .steps=${[
            { stepId: 'a', label: 'A', state: 'current' },
            { stepId: 'b', label: 'B', state: 'pending' },
            { stepId: 'c', label: 'C', state: 'pending' },
          ]}
        ></lr-stepper>
      </div>
    `);
    const el = wrap.querySelector<LyraStepper>('lr-stepper')!;
    await waitUntil(() => el.effectiveOrientation === 'vertical');
  });
});

describe('lr-step custom states', () => {
  it('publishes active, completed, loading, disabled, locked and clickable as :state()', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper linear clickable>
        <lr-step name="a" completed>A</lr-step>
        <lr-step name="b" loading>B</lr-step>
        <lr-step name="c">C</lr-step>
        <lr-step name="d" disabled>D</lr-step>
      </lr-stepper>
    `);
    const [a, b, c, d] = stepsOf(el);
    await waitUntil(() => a!.position === 1);
    await Promise.all(stepsOf(el).map((step) => step.updateComplete));
    const states = (step: LyraStep): string[] =>
      ['active', 'completed', 'loading', 'disabled', 'locked', 'clickable'].filter((name) => step.matches(`:state(${name})`));
    expect(states(a!)).to.deep.equal(['active', 'completed', 'clickable']);
    expect(states(b!)).to.deep.equal(['loading', 'clickable']);
    expect(states(c!)).to.deep.equal(['locked', 'clickable']);
    expect(states(d!)).to.deep.equal(['disabled', 'locked', 'clickable']);
    el.clickable = false;
    b!.loading = false;
    await el.updateComplete;
    await Promise.all(stepsOf(el).map((step) => step.updateComplete));
    expect(states(a!)).to.deep.equal(['active', 'completed']);
    expect(states(b!)).to.deep.equal([]);
  });

  it('publishes author-defined custom-states names and follows changes', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper>
        <lr-step name="a" custom-states="error  retried error">A</lr-step>
        <lr-step name="b">B</lr-step>
      </lr-stepper>
    `);
    const [a, b] = stepsOf(el);
    await Promise.all(stepsOf(el).map((step) => step.updateComplete));
    expect(a!.matches(':state(error)')).to.equal(true);
    expect(a!.matches(':state(retried)')).to.equal(true);
    expect(b!.matches(':state(error)')).to.equal(false);
    // Styling through the state reaches the marker part.
    const style = document.createElement('style');
    style.textContent = 'lr-step:state(error)::part(marker) { outline: 3px solid rgb(255, 0, 0); }';
    document.head.append(style);
    try {
      expect(getComputedStyle(a!.shadowRoot!.querySelector('[part="marker"]')!).outlineColor).to.equal('rgb(255, 0, 0)');
      expect(getComputedStyle(b!.shadowRoot!.querySelector('[part="marker"]')!).outlineStyle).to.equal('none');
    } finally {
      style.remove();
    }
    const before = status(a!);
    a!.customStates = 'retried';
    await a!.updateComplete;
    expect(a!.matches(':state(error)')).to.equal(false);
    expect(a!.matches(':state(retried)')).to.equal(true);
    expect(status(a!)).to.equal(before);
    a!.removeAttribute('custom-states');
    a!.customStates = '';
    await a!.updateComplete;
    expect(a!.matches(':state(retried)')).to.equal(false);
  });

  it('ignores built-in, invalid and excess custom-states names', async () => {
    const many = Array.from({ length: 40 }, (_, i) => `s${i}`).join(' ');
    const el = await fixture<LyraStepper>(html`
      <lr-stepper>
        <lr-step name="a" custom-states="completed 9lives -1x ${'x'.repeat(65)} ok">A</lr-step>
        <lr-step name="b" custom-states=${many}>B</lr-step>
      </lr-stepper>
    `);
    const [a, b] = stepsOf(el);
    await Promise.all(stepsOf(el).map((step) => step.updateComplete));
    expect(a!.matches(':state(ok)')).to.equal(true);
    // A built-in name in the list neither adds the state nor removes the step's own value.
    expect(a!.matches(':state(completed)')).to.equal(false);
    a!.completed = true;
    a!.customStates = 'ok';
    await a!.updateComplete;
    expect(a!.matches(':state(completed)')).to.equal(true);
    expect(b!.matches(':state(s31)')).to.equal(true);
    expect(b!.matches(':state(s32)')).to.equal(false);
  });

  it('keeps custom-states unset by default', async () => {
    const el = await fixture<LyraStep>(html`<lr-step name="solo">Solo</lr-step>`);
    expect(el.customStates).to.equal('');
    expect(el.hasAttribute('custom-states')).to.equal(false);
  });
});

describe('lr-stepper upstream-compatible surface', () => {
  const stepperStates = (el: LyraStepper): string[] =>
    ['completed', 'loading', 'stacked'].filter((name) => el.matches(`:state(${name})`));

  it('publishes completed, loading and stacked as :state() and follows child changes', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper>
        <lr-step name="a" completed>A</lr-step>
        <lr-step name="b" completed loading>B</lr-step>
      </lr-stepper>
    `);
    await el.updateComplete;
    expect(stepperStates(el)).to.deep.equal(['completed', 'loading']);
    const b = stepsOf(el)[1]!;
    b.loading = false;
    b.completed = false;
    await waitUntil(() => stepperStates(el).length === 0);
    el.orientation = 'vertical';
    await el.updateComplete;
    expect(stepperStates(el)).to.deep.equal(['stacked']);
  });

  it('reports completed in data mode only when every item is completed', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper
      .steps=${[
        { stepId: 'a', label: 'A', state: 'completed' },
        { stepId: 'b', label: 'B', state: 'current' },
      ]}
    ></lr-stepper>`);
    expect(el.matches(':state(completed)')).to.equal(false);
    el.steps = [
      { stepId: 'a', label: 'A', state: 'completed' },
      { stepId: 'b', label: 'B', state: 'completed' },
    ];
    await el.updateComplete;
    expect(el.matches(':state(completed)')).to.equal(true);
    expect(el.matches(':state(loading)')).to.equal(false);
  });

  it('exposes the step list as both base and steps parts', async () => {
    const el = await fixture<LyraStepper>(three());
    const list = el.shadowRoot!.querySelector('[part~="steps"]')!;
    expect(list.getAttribute('role')).to.equal('list');
    expect(list.getAttribute('part')!.split(' ')).to.include('base');
  });

  it('reads the unprefixed custom properties, which win over the --lr-stepper-* tokens', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper orientation="vertical" style="--lr-stepper-marker-size: 20px; --marker-size: 30px; --lr-stepper-connector-width: 1px; --connector-width: 5px; --gap: 17px; --connector-color: rgb(1, 2, 3)">
        <lr-step name="a" completed style="--pulse-color: rgb(4, 5, 6); --connector-color-active: rgb(7, 8, 9)">A</lr-step>
        <lr-step name="b" attention="pulse">B</lr-step>
        <lr-step name="c">C</lr-step>
      </lr-stepper>
    `);
    const [a, b, c] = stepsOf(el);
    await Promise.all(stepsOf(el).map((step) => step.updateComplete));
    await waitUntil(() => b!.vertical);
    await b!.updateComplete;
    const marker = getComputedStyle(b!.shadowRoot!.querySelector('[part="marker"]')!);
    expect(marker.inlineSize).to.equal('30px');
    const connectors = (step: LyraStep) =>
      [...step.shadowRoot!.querySelectorAll<HTMLElement>('[part="connector"]')].map((node) => getComputedStyle(node));
    expect(connectors(b!)[0]!.inlineSize).to.equal('5px');
    expect(connectors(c!)[0]!.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(connectors(a!)[1]!.backgroundColor).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(b!.shadowRoot!.querySelector('[part="step"]')!).paddingBlockStart).to.equal('17px');
    a!.attention = 'pulse';
    await a!.updateComplete;
    expect(getComputedStyle(a!.shadowRoot!.querySelector('[part="marker"]')!).getPropertyValue('--_pulse').trim()).to.equal('rgb(4, 5, 6)');
  });

  it('keeps the --lr-stepper-* tokens when the unprefixed aliases are unset', async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper style="--lr-stepper-marker-size: 22px">
        <lr-step name="a">A</lr-step><lr-step name="b">B</lr-step>
      </lr-stepper>
    `);
    const [a] = stepsOf(el);
    await a!.updateComplete;
    expect(getComputedStyle(a!.shadowRoot!.querySelector('[part="marker"]')!).inlineSize).to.equal('22px');
  });

  it('emits change details carrying name, previousName, step and previousStep', async () => {
    const el = await fixture<LyraStepper>(three());
    await el.updateComplete;
    const seen: LyraStepChangeDetail[] = [];
    el.addEventListener('lr-step-change', (event) => seen.push((event as CustomEvent<LyraStepChangeDetail>).detail));
    el.goTo('pay');
    await waitUntil(() => seen.length === 1);
    const [cart, , pay] = stepsOf(el);
    expect(seen[0]!.name).to.equal('pay');
    expect(seen[0]!.previousName).to.equal('cart');
    expect(seen[0]!.step === pay).to.equal(true);
    expect(seen[0]!.previousStep === cart).to.equal(true);
  });
});
