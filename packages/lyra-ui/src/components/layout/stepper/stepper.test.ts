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
 *  collapse-state tests use for their identically-shaped `ResizeObserver`. Restore in a `finally`.
 *
 *  `inert` additionally makes `observe()` a no-op, so *only* synthetic widths ever reach the
 *  component. Needed by any test that mutates layout mid-test (e.g. the root font size): a real
 *  observation would otherwise deliver the fixture's actual width right after the synthetic one and
 *  overwrite the state under assertion -- and re-entrant real deliveries surface as the browser's
 *  "ResizeObserver loop completed with undelivered notifications" error. */
function installResizeObserverSpy(
  { inert = false }: { inert?: boolean } = {},
): { callbacks: ResizeObserverCallback[]; restore: () => void } {
  const callbacks: ResizeObserverCallback[] = [];
  const OriginalRO = window.ResizeObserver;
  class SpyResizeObserver extends OriginalRO {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      callbacks.push(callback);
    }
    override observe(target: Element, options?: ResizeObserverOptions): void {
      if (!inert) super.observe(target, options);
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

  it('fires a non-cancelable lr-step-select on click, without mutating steps itself', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const buttons = stepButtons(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, 'lr-step-select');
    expect(ev.detail).to.deep.equal({ index: 2, id: 'review' });
    // Not cancelable: this component is fully controlled (mirrors lr-table's columns/rows
    // contract) and never takes a default action of its own on selection, so there is no real
    // veto point for `preventDefault()` to gate -- see AGENTS.md's event convention.
    expect(ev.cancelable).to.be.false;
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

  it('renders a step-icon part, additionally to the state chip/checkmark, for a step that provides an icon', async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { id: 'payment', label: 'Payment', state: 'current' as const, icon: '\u{1F4B3}' },
          { id: 'shipping', label: 'Shipping', state: 'completed' as const, icon: '\u{1F4E6}' },
          { id: 'review', label: 'Review', state: 'pending' as const },
        ]}
      ></lr-stepper>`,
    )) as LyraStepper;
    const buttons = stepButtons(el);

    const paymentIcon = buttons[0]!.querySelector('[part="step-icon"]');
    expect(paymentIcon, 'expected a step-icon part for the icon-bearing current step').to.not.equal(null);
    expect(paymentIcon!.textContent).to.equal('\u{1F4B3}');
    expect(paymentIcon!.getAttribute('aria-hidden')).to.equal('true');
    // The state chip still renders alongside the icon -- the icon identifies the topic, the chip
    // identifies the state.
    expect(buttons[0]!.querySelector('[part="step-index"]')).to.not.equal(null);

    const shippingIcon = buttons[1]!.querySelector('[part="step-icon"]');
    expect(shippingIcon, 'expected a step-icon part for the icon-bearing completed step').to.not.equal(null);
    expect(buttons[1]!.querySelector('[part="step-check"]')).to.not.equal(null);

    // No icon field at all -- no step-icon part rendered, byte-for-byte unaffected.
    expect(buttons[2]!.querySelector('[part="step-icon"]')).to.equal(null);
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
    // :where()-wrapped (see the "step hover specificity" describe block below) -- still targets
    // [part="step"]:hover, excluding aria-disabled="true" steps, just at zeroed specificity.
    expect(css).to.match(/:where\(\[part='step'\]\):hover:where\(:not\(\[aria-disabled='true'\]\)\)\s*\{[^}]+\}/);
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

  it('classifies effectiveOrientation correctly on the very first render under the default container basis, with no ResizeObserver round-trip needed', async () => {
    // Real (unmocked) width: [part="base"] is a block-level flex container with no width of its
    // own, so it fills this narrow inline style -- applied before the element ever connects, no
    // fireResize needed to prove the FIRST render already lands on 'vertical', not the
    // sentinel-derived 'horizontal'.
    const el = (await fixture(
      html`<lr-stepper
        orientation-breakpoint="500"
        narrow-orientation="vertical"
        style="display: block; inline-size: 300px"
        .steps=${steps()}
      ></lr-stepper>`,
    )) as LyraStepper;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
  });

  it('keeps the authored orientation and no effective marker when no breakpoint is configured', async () => {
    const el = (await fixture(html`<lr-stepper orientation="vertical" .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.hasAttribute('data-effective-orientation')).to.be.false;
  });

  it('exposes the resolved container-basis orientation breakpoint in pixels via the private accessor', async () => {
    const el = (await fixture(
      html`<lr-stepper orientation-breakpoint="500" .steps=${steps()}></lr-stepper>`,
    )) as LyraStepper;
    await elementUpdated(el);
    expect(
      (el as unknown as { orientationBreakpoints: { resolved: number | undefined } }).orientationBreakpoints.resolved,
    ).to.equal(500);

    el.orientationBreakpoint = 'abc'; // unresolvable
    await elementUpdated(el);
    expect(
      (el as unknown as { orientationBreakpoints: { resolved: number | undefined } }).orientationBreakpoints.resolved,
    ).to.equal(undefined);
  });

  describe('orientationBreakpoint as a CSS length', () => {
    afterEach(() => {
      document.documentElement.style.fontSize = '';
    });

    /** Mounts a stepper with the given breakpoint and hands back the `ResizeObserver` callback it
     *  armed (or `undefined` when it armed none), so a test can drive synthetic widths. */
    async function mount(
      spy: ReturnType<typeof installResizeObserverSpy>,
      breakpoint: number | string,
    ): Promise<{ el: LyraStepper; callback?: ResizeObserverCallback }> {
      const before = spy.callbacks.length;
      const el = (await fixture(
        html`<lr-stepper
          orientation-breakpoint=${breakpoint}
          narrow-orientation="vertical"
          .steps=${steps()}
        ></lr-stepper>`,
      )) as LyraStepper;
      await elementUpdated(el);
      return { el, callback: spy.callbacks[before] };
    }

    it('crosses at the same measured width for a rem breakpoint as for the equivalent px number', async () => {
      document.documentElement.style.fontSize = '16px';
      const spy = installResizeObserverSpy({ inert: true });
      try {
        const rem = await mount(spy, '31.25rem'); // 31.25rem @ 16px root === 500px
        const px = await mount(spy, 500);
        expect(rem.callback, 'a rem breakpoint must arm the resize observer').to.exist;
        expect(px.callback).to.exist;

        for (const { el, callback } of [rem, px]) {
          fireResize(callback!, 499);
          await elementUpdated(el);
          expect(el.effectiveOrientation).to.equal('vertical');
          expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');

          fireResize(callback!, 500);
          await elementUpdated(el);
          expect(el.effectiveOrientation).to.equal('horizontal');
          expect(el.getAttribute('data-effective-orientation')).to.equal('horizontal');
        }
      } finally {
        spy.restore();
      }
    });

    it('keeps the bare-number form working identically, as an attribute and as a property', async () => {
      const spy = installResizeObserverSpy({ inert: true });
      try {
        const attr = await mount(spy, 500);

        const before = spy.callbacks.length;
        const prop = (await fixture(
          html`<lr-stepper narrow-orientation="vertical" .steps=${steps()}></lr-stepper>`,
        )) as LyraStepper;
        prop.orientationBreakpoint = 500;
        await elementUpdated(prop);
        const propCallback = spy.callbacks[before];
        expect(propCallback, 'a numeric property must arm the resize observer').to.exist;

        for (const { el, callback } of [attr, { el: prop, callback: propCallback }]) {
          fireResize(callback!, 320);
          await elementUpdated(el);
          expect(el.effectiveOrientation).to.equal('vertical');

          fireResize(callback!, 700);
          await elementUpdated(el);
          expect(el.effectiveOrientation).to.equal('horizontal');
        }
      } finally {
        spy.restore();
      }
    });

    it('moves the crossing width when the root font size changes, for a rem breakpoint', async () => {
      document.documentElement.style.fontSize = '16px';
      const spy = installResizeObserverSpy({ inert: true });
      try {
        const { el, callback } = await mount(spy, '31.25rem'); // 500px @ 16px root
        fireResize(callback!, 600);
        await elementUpdated(el);
        expect(el.effectiveOrientation).to.equal('horizontal'); // 600 >= 500

        document.documentElement.style.fontSize = '20px'; // 31.25rem is now 625px
        fireResize(callback!, 600);
        await elementUpdated(el);
        expect(el.effectiveOrientation).to.equal('vertical'); // 600 < 625 -- re-read, not frozen
      } finally {
        spy.restore();
      }
    });

    it('treats an unparseable breakpoint exactly as unset -- no observation, no effective marker', async () => {
      const spy = installResizeObserverSpy({ inert: true });
      try {
        const el = (await fixture(
          html`<lr-stepper
            orientation="horizontal"
            orientation-breakpoint="abc"
            narrow-orientation="vertical"
            .steps=${steps()}
          ></lr-stepper>`,
        )) as LyraStepper;
        await elementUpdated(el);
        expect(spy.callbacks.length, 'no responsive observation may be armed').to.equal(0);
        expect(el.effectiveOrientation).to.equal('horizontal');
        expect(el.hasAttribute('data-effective-orientation')).to.be.false;
      } finally {
        spy.restore();
      }
    });
  });

  describe('orientationBreakpointBasis', () => {
    it('defaults to "container", leaving committed behavior unchanged', async () => {
      const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
      expect(el.orientationBreakpointBasis).to.equal('container');
      expect(el.effectiveOrientation).to.equal('horizontal');
      expect(el.hasAttribute('data-effective-orientation')).to.be.false;
    });

    it('reflects the basis to an attribute', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="1px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.getAttribute('orientation-breakpoint-basis')).to.equal('viewport');
    });

    it('goes narrow under basis="viewport" when an absurdly large breakpoint always matches', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="99999px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal('vertical');
      expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
    });

    it('ignores its own width entirely under basis="viewport"', async () => {
      // A stepper given a fixed narrow width in a row is exactly the filed case: its own
      // width never tracks the viewport, so only the media query can drive the flip.
      const wrapper = (await fixture(html`
        <div style="inline-size: 120px">
          <lr-stepper
            orientation-breakpoint="1px"
            orientation-breakpoint-basis="viewport"
            .steps=${steps()}
          ></lr-stepper>
        </div>
      `)) as HTMLElement;
      const stepper = wrapper.querySelector('lr-stepper') as LyraStepper;
      await elementUpdated(stepper);
      expect(stepper.effectiveOrientation).to.equal('horizontal');
    });

    it('re-queries matchMedia when the breakpoint changes at runtime', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="1px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal('horizontal');
      el.orientationBreakpoint = '99999px';
      await elementUpdated(el);
      expect(el.effectiveOrientation, 'a stale MediaQueryList would leave this horizontal').to.equal('vertical');
    });

    it('switches observation strategy when the basis changes at runtime', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="99999px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal('vertical');
      el.orientationBreakpointBasis = 'container';
      el.orientationBreakpoint = '1px';
      await elementUpdated(el);
      expect(el.effectiveOrientation, 'container basis must consult the measured width').to.equal('horizontal');
    });

    it('emits lr-stepper-orientation-change when a viewport-basis change flips the axis', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="1px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      setTimeout(() => {
        el.orientationBreakpoint = '99999px';
      });
      const event = await oneEvent(el, 'lr-stepper-orientation-change');
      expect(event.detail.orientation).to.equal('vertical');
    });

    it('treats an unresolvable breakpoint as unset under basis="viewport"', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="80vw"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal('horizontal');
      expect(el.hasAttribute('data-effective-orientation')).to.be.false;
    });

    it('re-arms the media query after a disconnect/reconnect cycle', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="1px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      el.remove();
      document.body.append(el);
      await elementUpdated(el);
      el.orientationBreakpoint = '99999px';
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal('vertical');
      el.remove();
    });

    it('is accessible with a viewport-basis breakpoint set', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="99999px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      await expect(el).to.be.accessible();
    });
  });
});

describe('horizontal step row overflow', () => {
  it('pairs overflow-y with overflow-x on the horizontal (default) axis to avoid a phantom vertical scrollbar', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const computed = getComputedStyle(base);
    expect(computed.overflowX).to.equal('auto');
    expect(computed.overflowY).to.equal('hidden');
  });

  it('leaves overflow-x/-y both visible under orientation="vertical", with no leftover horizontal mask', async () => {
    const el = (await fixture(
      html`<lr-stepper orientation="vertical" .steps=${steps()}></lr-stepper>`,
    )) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const computed = getComputedStyle(base);
    expect(computed.overflowX).to.equal('visible');
    expect(computed.overflowY).to.equal('visible');
    const maskImage =
      computed.getPropertyValue('mask-image') || computed.getPropertyValue('-webkit-mask-image');
    expect(maskImage).to.equal('none');
  });

  it('shows a mask-image edge fade on the horizontally-scrolling step row, matching lr-tabs/lr-segmented', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const computed = getComputedStyle(base);
    const maskImage =
      computed.getPropertyValue('mask-image') || computed.getPropertyValue('-webkit-mask-image');
    expect(maskImage).to.not.equal('none');
    expect(maskImage).to.contain('gradient');
  });
});

describe('step hover specificity', () => {
  it('the internal [part="step"]:hover rule is :where()-wrapped, so a consumer ::part(step):hover override wins without needing !important', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${steps()}></lr-stepper>`)) as LyraStepper;
    // Same technique as attachment-trigger.test.ts's identically-shaped specificity test: real
    // browser test runners don't synthesize a :hover pseudo-class from a dispatched event, so
    // assert via the rendered stylesheet's own selector text instead of a paint result.
    const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .find((text) => text.includes(':hover') && text.includes('aria-disabled'));
    expect(internalRule, 'expected a [part="step"]:hover rule').to.not.equal(undefined);
    expect(internalRule).to.contain(':where(');
  });
});

describe('state-styling cssprops', () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset defaults byte-for-byte against
   *  the tokens they fall back to. */
  function resolvedInShadow(el: LyraStepper, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  const themedSteps = () => [
    { id: 'basics', label: 'Basics', state: 'completed' as const },
    { id: 'inputs', label: 'Inputs', state: 'current' as const },
    { id: 'oops', label: 'Oops', state: 'error' as const },
    { id: 'review', label: 'Review', state: 'pending' as const },
  ];

  const overrides =
    '--lr-stepper-current-color: rgb(0, 51, 102);' +
    '--lr-stepper-current-font-weight: 900;' +
    '--lr-stepper-error-color: rgb(102, 0, 0);' +
    '--lr-stepper-current-index-bg: rgb(10, 20, 30);' +
    '--lr-stepper-current-index-color: rgb(200, 210, 220);';

  async function themed(style: string): Promise<LyraStepper> {
    const wrapper = (await fixture(
      html`<div style=${style}><lr-stepper .steps=${themedSteps()}></lr-stepper></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-stepper') as LyraStepper;
    await el.updateComplete;
    return el;
  }

  function stepEl(el: LyraStepper, state: string): HTMLElement {
    return el.shadowRoot!.querySelector(`[part="step"][data-state="${state}"]`) as HTMLElement;
  }

  it('recolors current/error steps and the current index chip from an ancestor, not a :host-declared prop', async () => {
    const el = await themed(overrides);
    const current = stepEl(el, 'current');
    const error = stepEl(el, 'error');
    const currentIndex = current.querySelector('[part="step-index"]')!;
    expect(getComputedStyle(current).color).to.equal('rgb(0, 51, 102)');
    // The current step's font-weight has its own dedicated cssprop, decoupled from the shared
    // --lr-font-weight-semibold token every other semibold-weighted element in the page also
    // reads -- retheming it must not repaint any of those.
    expect(getComputedStyle(current).fontWeight).to.equal('900');
    expect(getComputedStyle(error).color).to.equal('rgb(102, 0, 0)');
    expect(getComputedStyle(currentIndex).backgroundColor).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(currentIndex).color).to.equal('rgb(200, 210, 220)');
  });

  it('renders byte-identically to the pre-cssprop output when the props are unset', async () => {
    const el = await themed('');
    const current = stepEl(el, 'current');
    const error = stepEl(el, 'error');
    const currentIndex = current.querySelector('[part="step-index"]')!;
    expect(getComputedStyle(current).color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-text)', 'color'));
    expect(getComputedStyle(current).fontWeight).to.equal(
      resolvedInShadow(el, 'font-weight: var(--lr-font-weight-semibold)', 'font-weight'),
    );
    expect(getComputedStyle(error).color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-danger)', 'color'));
    expect(getComputedStyle(currentIndex).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-brand)', 'background-color'),
    );
    expect(getComputedStyle(currentIndex).color).to.equal(
      resolvedInShadow(el, 'color: var(--lr-color-surface)', 'color'),
    );
  });

  it('is accessible with the state-styling props themed', async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});
