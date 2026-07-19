import { fixture, expect, html, elementUpdated, oneEvent } from '@open-wc/testing';
import './split.js';
import type { LyraSplit } from './split.js';
import { styles } from './split.styles.js';

function mockWidth(el: HTMLElement, width: number): void {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
}

function pointerDown(el: HTMLElement, pointerId: number, x: number) {
  el.dispatchEvent(new PointerEvent('pointerdown', { pointerId, clientX: x, bubbles: true }));
}
function pointerMove(pointerId: number, x: number) {
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: x }));
}

/** Spies on the real `ResizeObserver` constructor so a test can manually
 *  drive a component's collapse-state callback with a synthetic width,
 *  instead of depending on real (viewport/layout-dependent, flaky) browser
 *  resize timing -- same technique lite-chart.test.ts's reconnect test uses
 *  for its own ResizeObserver-driven assertions. Restore in a `finally`. */
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

/** Like `installResizeObserverSpy()`, but the observer is a stub that never observes anything, so
 *  the only measurements a component sees are the synthetic ones the test fires. The
 *  orientation-breakpoint tests need that isolation: they assert narrow states on a fixture the
 *  browser really lays out wide (and one of them changes the root font size mid-test), so every
 *  real delivery would contradict the synthetic one — making the assertions racy and flipping the
 *  layout axis back and forth often enough to trip Chromium's "ResizeObserver loop completed with
 *  undelivered notifications" error. Restore in a `finally`. */
function installStubResizeObserver(): { callbacks: ResizeObserverCallback[]; restore: () => void } {
  const callbacks: ResizeObserverCallback[] = [];
  const OriginalRO = window.ResizeObserver;
  class StubResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = StubResizeObserver;
  return {
    callbacks,
    restore: () => {
      (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = OriginalRO;
    },
  };
}

function fireCollapseResize(callback: ResizeObserverCallback, width: number): void {
  callback(
    [{ contentBoxSize: [{ inlineSize: width, blockSize: 0 }] } as unknown as ResizeObserverEntry],
    {} as ResizeObserver,
  );
}

it('splits children evenly by default', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div><div>C</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.sizes.length).to.equal(3);
  const sum = el.sizes.reduce((a, b) => a + b, 0);
  expect(Math.round(sum)).to.equal(100);
  expect(el.shadowRoot!.querySelectorAll('[part="divider"]').length).to.equal(2);
});

it('resizes via keyboard on a divider and emits lr-resize', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  expect(divider.getAttribute('role')).to.equal('separator');
  const before = el.sizes[0];
  let detail: { sizes: number[] } | undefined;
  el.addEventListener('lr-resize', (e) => (detail = (e as CustomEvent).detail));
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.greaterThan(before);
  expect(detail!.sizes[0]).to.equal(el.sizes[0]);
});

it('mirrors ArrowRight/ArrowLeft under dir="rtl", since panels reorder visually via flex order', async () => {
  const el = (await fixture(
    html`<lr-split dir="rtl"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  const before = el.sizes[0];

  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.lessThan(before);

  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(before);
});

it('does not swap ArrowUp/ArrowDown for vertical orientation under dir="rtl" (direction only affects the horizontal inline axis)', async () => {
  const el = (await fixture(
    html`<lr-split dir="rtl" orientation="vertical"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  const before = el.sizes[0];
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.greaterThan(before);
});

it('mirrors pointer-drag direction under dir="rtl" so it grows the panel under the pointer', async () => {
  const el = (await fixture(
    html`<lr-split dir="rtl"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  Object.defineProperty(base, 'clientWidth', { value: 200, configurable: true });
  divider.setPointerCapture = () => {};

  const before = el.sizes[0];
  divider.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }),
  );
  // Physically-rightward drag under RTL shrinks panel[0] (rendered on the
  // right via flex `order`), the mirror image of the LTR case.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 150 }));
  expect(el.sizes[0]).to.be.lessThan(before);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
});

it('clamps panel sizes to the configured minimum', async () => {
  const el = (await fixture(
    html`<lr-split min="20"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  el.sizes = [20, 80];
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(20);
});

it('rejects infeasible aggregate minimums, reports the issue, and keeps resizing usable', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div><div>C</div></lr-split>`,
  )) as LyraSplit;
  const invalid = oneEvent(el, 'lr-split-constraints-invalid');
  el.min = 40;
  const event = (await invalid) as CustomEvent<{
    reason: string;
    panelCount: number;
    minimumTotal: number;
    maximumTotal: number | null;
  }>;
  await elementUpdated(el);

  expect(event.detail.reason).to.equal('minimum-total');
  expect(event.detail.panelCount).to.equal(3);
  expect(event.detail.minimumTotal).to.equal(120);
  expect(event.detail.maximumTotal).to.equal(null);

  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  expect(divider.getAttribute('aria-valuemin')).to.equal('33');
  const before = el.sizes[0];
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.greaterThan(before);
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await expect(el).to.be.accessible();
});

it('persists sizes to localStorage when storageKey is set', async () => {
  const storageKey = 'test-split-' + Math.random();
  localStorage.clear();

  const el = (await fixture(
    html`<lr-split storage-key=${storageKey}><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  el.sizes = [25, 75];
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);

  const stored = localStorage.getItem(`lr-split:${storageKey}:2`);
  expect(stored).to.not.be.null;
  const parsed = JSON.parse(stored!);
  expect(parsed).to.be.an('array');
  expect(parsed.length).to.equal(2);
});

it('uses defaultSizes only for initialization, below valid persistence and above equal distribution', async () => {
  const firstVisitKey = 'test-split-default-first-' + Math.random();
  const firstVisit = (await fixture(
    html`<lr-split storage-key=${firstVisitKey} .defaultSizes=${[20, 80]}><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(firstVisit);
  expect(firstVisit.sizes).to.deep.equal([20, 80]);

  const restoredKey = 'test-split-default-restored-' + Math.random();
  localStorage.setItem(`lr-split:${restoredKey}:2`, JSON.stringify([35, 65]));
  const restored = (await fixture(
    html`<lr-split storage-key=${restoredKey} .defaultSizes=${[20, 80]}><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(restored);
  expect(restored.sizes).to.deep.equal([35, 65]);

  restored.defaultSizes = [10, 90];
  await elementUpdated(restored);
  expect(restored.sizes).to.deep.equal([35, 65]);
});

it('falls back from invalid persisted sizes to defaultSizes through the initialization path', async () => {
  const storageKey = 'test-split-default-invalid-' + Math.random();
  localStorage.setItem(`lr-split:${storageKey}:2`, JSON.stringify([5, 95]));
  const el = (await fixture(
    html`<lr-split storage-key=${storageKey} min="10" .defaultSizes=${[25, 75]}><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.sizes).to.deep.equal([25, 75]);
});

it('switches the resize axis from its own inline-size breakpoint and reports the effective orientation', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split orientation-breakpoint="500" narrow-orientation="vertical"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    expect(spy.callbacks.length).to.equal(1);

    fireCollapseResize(spy.callbacks[0], 320);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
    const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
    expect(divider.getAttribute('aria-orientation')).to.equal('horizontal');
    const before = el.sizes[0];
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await elementUpdated(el);
    expect(el.sizes[0]).to.be.greaterThan(before);

    const changed = oneEvent(el, 'lr-split-orientation-change');
    fireCollapseResize(spy.callbacks[0], 700);
    expect((await changed).detail).to.deep.equal({ orientation: 'horizontal' });
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('horizontal');
    expect(divider.getAttribute('aria-orientation')).to.equal('vertical');
  } finally {
    spy.restore();
  }
});

it('keeps the authored orientation and no effective marker when no breakpoint is configured', async () => {
  const el = (await fixture(
    html`<lr-split orientation="vertical"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.effectiveOrientation).to.equal('vertical');
  expect(el.hasAttribute('data-effective-orientation')).to.be.false;
});

it('accepts a rem orientation breakpoint, crossing at the same width as the equivalent px number', async () => {
  const spy = installStubResizeObserver();
  const previousRootFontSize = document.documentElement.style.fontSize;
  try {
    // 31.25rem at a 16px root is exactly the 500px the sibling test above uses.
    document.documentElement.style.fontSize = '16px';
    const el = (await fixture(
      html`<lr-split orientation-breakpoint="31.25rem" narrow-orientation="vertical"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    // The attribute is no longer coerced to a number, so the CSS length survives intact.
    expect(el.orientationBreakpoint).to.equal('31.25rem');
    expect(spy.callbacks.length).to.equal(1);

    fireCollapseResize(spy.callbacks[0], 501);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('horizontal');
    expect(el.getAttribute('data-effective-orientation')).to.equal('horizontal');

    fireCollapseResize(spy.callbacks[0], 499);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
  } finally {
    document.documentElement.style.fontSize = previousRootFontSize;
    spy.restore();
  }
});

it('keeps the bare-number orientation breakpoint working from both the attribute and the property', async () => {
  const spy = installStubResizeObserver();
  try {
    const el = (await fixture(
      html`<lr-split orientation-breakpoint="900" narrow-orientation="vertical"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    expect(spy.callbacks.length).to.equal(1);

    fireCollapseResize(spy.callbacks[0], 899);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    fireCollapseResize(spy.callbacks[0], 901);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('horizontal');

    // The same threshold assigned as a real number behaves identically.
    el.orientationBreakpoint = 900;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('horizontal');
    fireCollapseResize(spy.callbacks[0], 899);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
    fireCollapseResize(spy.callbacks[0], 901);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('horizontal');
  } finally {
    spy.restore();
  }
});

it('re-resolves a rem orientation breakpoint per measurement, so a root font-size change moves the crossing width', async () => {
  const spy = installStubResizeObserver();
  const previousRootFontSize = document.documentElement.style.fontSize;
  try {
    document.documentElement.style.fontSize = '16px';
    const el = (await fixture(
      html`<lr-split orientation-breakpoint="20rem" narrow-orientation="vertical"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);

    // 20rem === 320px here, so 400px is still above the breakpoint.
    fireCollapseResize(spy.callbacks[0], 400);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('horizontal');

    // 20rem === 640px now: the *same* measured width is suddenly below it.
    document.documentElement.style.fontSize = '32px';
    fireCollapseResize(spy.callbacks[0], 400);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
  } finally {
    document.documentElement.style.fontSize = previousRootFontSize;
    spy.restore();
  }
});

it('treats an unparseable orientation breakpoint as unset (no observation, no effective marker)', async () => {
  const spy = installStubResizeObserver();
  try {
    const el = (await fixture(
      html`<lr-split orientation-breakpoint="abc" narrow-orientation="vertical"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    // Gated on the *resolved* length, not on the raw property being non-null: an
    // unresolvable value must not arm the observer it could never cross.
    expect(spy.callbacks.length).to.equal(0);
    expect(el.effectiveOrientation).to.equal('horizontal');
    expect(el.hasAttribute('data-effective-orientation')).to.be.false;

    // A viewport unit is deliberately unresolvable too (it would mix reference boxes).
    el.orientationBreakpoint = '80vw';
    await elementUpdated(el);
    expect(spy.callbacks.length).to.equal(0);
    expect(el.hasAttribute('data-effective-orientation')).to.be.false;

    // ...but a resolvable value assigned later still arms it normally.
    el.orientationBreakpoint = '500px';
    await elementUpdated(el);
    expect(spy.callbacks.length).to.equal(1);
    fireCollapseResize(spy.callbacks[0], 320);
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
  } finally {
    spy.restore();
  }
});

it('supports vertical orientation with vertical arrow keys', async () => {
  const el = (await fixture(
    html`<lr-split orientation="vertical"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.orientation).to.equal('vertical');

  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  const before = el.sizes[0];
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.greaterThan(before);
});

it('applies flex styles and interleaving order to panels', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div><div>C</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  const [panelA, panelB, panelC] = [...el.children] as HTMLElement[];
  expect(panelA.style.flex).to.include('%');
  // Panels sit at even order values (0, 2, 4…); dividers (rendered in the
  // shadow root) take the odd slots (1, 3…) in between, so flexbox
  // interleaves panel/divider/panel/divider/panel visually.
  expect(panelA.style.order).to.equal('0');
  expect(panelB.style.order).to.equal('2');
  expect(panelC.style.order).to.equal('4');
});

it('widens the horizontal divider hit area with a ::before without changing its visible 3px width', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;

  expect(getComputedStyle(divider).position).to.equal('relative');
  expect(getComputedStyle(divider).width).to.equal('3px');

  const before = getComputedStyle(divider, '::before');
  expect(before.content).to.not.equal('none');
  expect(before.position).to.equal('absolute');
  // resize axis (inline, i.e. left/right in horizontal orientation) is widened...
  expect(parseFloat(before.left)).to.be.lessThan(0);
  expect(parseFloat(before.right)).to.be.lessThan(0);
  // ...but the cross axis (block, i.e. top/bottom) is left flush, matching the divider's own box
  expect(before.top).to.equal('0px');
  expect(before.bottom).to.equal('0px');
});

it('widens the vertical divider hit area along the block axis instead', async () => {
  const el = (await fixture(
    html`<lr-split orientation="vertical"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;

  expect(getComputedStyle(divider).height).to.equal('3px');

  const before = getComputedStyle(divider, '::before');
  expect(before.content).to.not.equal('none');
  expect(parseFloat(before.top)).to.be.lessThan(0);
  expect(parseFloat(before.bottom)).to.be.lessThan(0);
  expect(before.left).to.equal('0px');
  expect(before.right).to.equal('0px');
});

it('reconciles panelCount and sizes when a panel is added after connect (slotchange)', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.sizes.length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="divider"]').length).to.equal(1);

  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const slotChanged = oneEvent(slot, 'slotchange');
  const panelC = document.createElement('div');
  panelC.textContent = 'C';
  el.appendChild(panelC);
  await slotChanged;
  await elementUpdated(el);

  expect(el.sizes.length).to.equal(3);
  expect(el.shadowRoot!.querySelectorAll('[part="divider"]').length).to.equal(2);
});

it('reconciles panelCount and sizes when a panel is removed after connect (slotchange)', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div><div>C</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.sizes.length).to.equal(3);
  expect(el.shadowRoot!.querySelectorAll('[part="divider"]').length).to.equal(2);

  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const slotChanged = oneEvent(slot, 'slotchange');
  el.removeChild(el.lastElementChild!);
  await slotChanged;
  await elementUpdated(el);

  expect(el.sizes.length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="divider"]').length).to.equal(1);
});

it('computes aria-valuemax per divider from its two adjacent panels for 3+ panels', async () => {
  const el = (await fixture(
    html`<lr-split min="10"><div>A</div><div>B</div><div>C</div></lr-split>`,
  )) as LyraSplit;
  el.sizes = [50, 30, 20];
  await elementUpdated(el);
  const dividers = [...el.shadowRoot!.querySelectorAll('[part="divider"]')] as HTMLElement[];
  expect(dividers.length).to.equal(2);
  // divider 0 sits between panels 0 and 1: max = 50 + 30 - 10 = 70 (not 100 - 10 = 90)
  expect(dividers[0].getAttribute('aria-valuemax')).to.equal('70');
  // divider 1 sits between panels 1 and 2: max = 30 + 20 - 10 = 40 (not 90)
  expect(dividers[1].getAttribute('aria-valuemax')).to.equal('40');
});

it('does not throw when localStorage.getItem/setItem are unavailable (e.g. blocked or quota-exceeded)', async () => {
  const originalGetItem = localStorage.getItem;
  const originalSetItem = localStorage.setItem;
  localStorage.getItem = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  localStorage.setItem = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  try {
    const el = (await fixture(
      html`<lr-split storage-key="blocked-test"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await elementUpdated(el);
  } finally {
    localStorage.getItem = originalGetItem;
    localStorage.setItem = originalSetItem;
  }
});

it('lets a keyboard resize climb out of a sub-min starting size instead of getting stuck', async () => {
  const el = (await fixture(
    html`<lr-split min="10"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  // Simulates the equal-split-across-many-panels case (e.g. 20 panels at 5%
  // each with the default min=10): a panel starts below `min`.
  el.sizes = [5, 95];
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;

  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);
  // Clamps straight to `min` instead of leaving the panel stuck at 5+2=7.
  expect(el.sizes[0]).to.equal(10);

  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(12);
});

it('rejects a stale persisted layout that violates a since-raised min, falling back to an equal split', async () => {
  const storageKey = 'test-split-min-raise-' + Math.random();
  localStorage.setItem(`lr-split:${storageKey}:2`, JSON.stringify([5, 95]));

  const el = (await fixture(
    html`<lr-split storage-key=${storageKey} min="10"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  expect(el.sizes[0]).to.equal(50);
  expect(el.sizes[1]).to.equal(50);
});

it('preserves and restores custom panel proportions across an appended-then-removed panel', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div><div>C</div><div>D</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  el.sizes = [10, 40, 30, 20];
  await elementUpdated(el);

  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  let slotChanged = oneEvent(slot, 'slotchange');
  const panelE = document.createElement('div');
  panelE.textContent = 'E';
  el.appendChild(panelE);
  await slotChanged;
  await elementUpdated(el);

  expect(el.sizes.length).to.equal(5);
  const existingTotal = el.sizes.slice(0, 4).reduce((a, b) => a + b, 0);
  const ratios = el.sizes.slice(0, 4).map((s) => Math.round((s / existingTotal) * 1000));
  // Relative proportions of the original 4 panels are preserved (10:40:30:20),
  // not reset to a flat 20% each.
  expect(ratios).to.deep.equal([100, 400, 300, 200]);

  slotChanged = oneEvent(slot, 'slotchange');
  el.removeChild(panelE);
  await slotChanged;
  await elementUpdated(el);

  expect(el.sizes.length).to.equal(4);
  const original = [10, 40, 30, 20];
  el.sizes.forEach((s, i) => expect(s).to.be.closeTo(original[i], 0.001));
});

it('keeps two concurrent pointer drags on different dividers independent (scoped by pointerId)', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div><div>C</div><div>D</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  Object.defineProperty(base, 'clientWidth', { value: 400, configurable: true });
  const dividers = [...el.shadowRoot!.querySelectorAll('[part="divider"]')] as HTMLElement[];
  dividers.forEach((d) => (d.setPointerCapture = () => {}));

  dividers[0].dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }),
  );
  dividers[2].dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 300 }),
  );

  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 340 }));

  expect(el.sizes[0]).to.be.greaterThan(25);
  expect(el.sizes[2]).to.be.greaterThan(25);

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));
});

it('keeps sizes summing to 100 when two adjacent dividers are dragged concurrently', async () => {
  const el = (await fixture(
    html`<lr-split><div>a</div><div>b</div><div>c</div></lr-split>`,
  )) as LyraSplit;
  await el.updateComplete;
  const dividers = el.shadowRoot!.querySelectorAll('[part="divider"]') as NodeListOf<HTMLElement>;
  Object.defineProperty(el.shadowRoot!.querySelector('[part="base"]')!, 'clientWidth', { value: 300, configurable: true });
  (dividers[0] as unknown as { setPointerCapture(id: number): void }).setPointerCapture = () => {};
  (dividers[1] as unknown as { setPointerCapture(id: number): void }).setPointerCapture = () => {};
  pointerDown(dividers[0], 1, 100);
  pointerDown(dividers[1], 2, 200);
  pointerMove(1, 130); // drag divider 0 right, growing panel 1
  pointerMove(2, 170); // drag divider 1 left, also growing panel 1
  await el.updateComplete;
  const total = el.sizes.reduce((s, n) => s + n, 0);
  expect(total).to.be.closeTo(100, 0.5);
});

it('composes two adjacent concurrent drags correctly when each pointer fires multiple moves (not just one move per pointer)', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div><div>C</div></lr-split>`,
  )) as LyraSplit;
  el.sizes = [40, 30, 30];
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 200); // 1% == 2px, so requested deltas below are exact.
  const dividers = [...el.shadowRoot!.querySelectorAll('[part="divider"]')] as HTMLElement[];
  dividers.forEach((d) => (d.setPointerCapture = () => {}));

  // Pointer 1 drags divider 0 (the panel0/panel1 pair); pointer 2 drags
  // divider 1 (the panel1/panel2 pair) -- panel1 is the shared panel. Both
  // pointers start, then EACH fires two moves, interleaved, so pointer 1's
  // own second move writes to the shared panel1 in between pointer 2's two
  // moves -- exactly the sequence that contaminates pointer 2's `appliedDelta`
  // under the buggy "absolute since drag-start" formula (round 1's fix),
  // even though a single-move-per-pointer test never observes it.
  pointerDown(dividers[0], 1, 100);
  pointerDown(dividers[1], 2, 300);

  pointerMove(1, 108); // pointer 1 requests +4%
  pointerMove(2, 312); // pointer 2 requests +6%
  pointerMove(1, 114); // pointer 1 requests +7% total (a further +3% own increment)
  pointerMove(2, 322); // pointer 2 requests +11% total (a further +5% own increment)
  await el.updateComplete;

  // Nothing here saturates a bound, so the final sizes must equal simply
  // composing each pointer's own *total* requested delta independently onto
  // the starting sizes: panel0 only ever responds to pointer 1's requests
  // (40 + 7 = 47), panel2 only ever responds to pointer 2's requests
  // (30 - 11 = 19), and the shared panel1 absorbs both (30 - 7 + 11 = 34).
  // The buggy formula instead yields [47, 38, 15] here -- still summing to
  // 100 (so a "sums to 100" assertion alone would miss it), but wrong.
  expect(el.sizes[0]).to.be.closeTo(47, 1e-9);
  expect(el.sizes[1]).to.be.closeTo(34, 1e-9);
  expect(el.sizes[2]).to.be.closeTo(19, 1e-9);
  const total = el.sizes.reduce((s, n) => s + n, 0);
  expect(total).to.be.closeTo(100, 1e-9);

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));
});

it('returns to the exact starting sizes after a drag saturates a bound and then reverses back to the start position (no drift from the clamped-away delta)', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 100);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.setPointerCapture = () => {};

  divider.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }),
  );
  // Push panel[0] well past the pair's max (90, since panel[1]'s default
  // min=10 caps it) -- this saturates the clamp, discarding part of the
  // requested delta (requested +50, only +40 actually realized).
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 150 }));
  expect(el.sizes[0]).to.equal(90);

  // Reverse partway: still saturated, since the pointer hasn't crossed back
  // under the threshold that would un-clamp it.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 145 }));
  expect(el.sizes[0]).to.equal(90);

  // Return the pointer to its exact starting position: the panel must land
  // back on its exact starting size. A buggy `appliedDelta` that tracks the
  // raw requested delta (instead of what was actually realized post-clamp)
  // loses track of the clamped-away portion and drifts here instead.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(el.sizes[0]).to.equal(50);
  expect(el.sizes[1]).to.equal(50);

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
});

it('clears inline flex/order styles from a panel removed from the slot', async () => {
  const el = (await fixture(
    html`<lr-split><div id="p1">a</div><div id="p2">b</div></lr-split>`,
  )) as LyraSplit;
  await el.updateComplete;
  const p1 = el.querySelector('#p1') as HTMLElement;
  expect(p1.style.flex).to.not.equal('');
  // Removal only drives a re-render (and thus updated()'s cleanup pass) once
  // the light-DOM mutation's async `slotchange` fires and flips reactive
  // state (panelCount/sizes) -- awaiting `el.updateComplete` alone races
  // that, since it can resolve against an already-settled promise from the
  // *previous* render before slotchange has had a chance to queue the next
  // one. Same pattern the other slotchange-driven tests in this file use.
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const slotChanged = oneEvent(slot, 'slotchange');
  p1.remove();
  await slotChanged;
  await el.updateComplete;
  expect(p1.style.flex).to.equal('');
  expect(p1.style.order).to.equal('');
});

it('ignores a stray pointermove/pointerup/pointercancel after the element is disconnected mid-drag', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.setPointerCapture = () => {};
  divider.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }),
  );
  const sizesAtDisconnect = [...el.sizes];

  el.remove();

  expect(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 200 }));
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  }).to.not.throw();
  expect(el.sizes).to.deep.equal(sizesAtDisconnect);
});

it('persists sizes to localStorage on pointerup, not just via keyboard commit', async () => {
  const storageKey = 'test-split-pointer-persist-' + Math.random();
  localStorage.clear();

  const el = (await fixture(
    html`<lr-split storage-key=${storageKey}><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  Object.defineProperty(base, 'clientWidth', { value: 200, configurable: true });
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.setPointerCapture = () => {};

  divider.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140 }));
  expect(localStorage.getItem(`lr-split:${storageKey}:2`)).to.be.null;

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));

  const stored = localStorage.getItem(`lr-split:${storageKey}:2`);
  expect(stored).to.not.be.null;
  expect(JSON.parse(stored!)).to.deep.equal(el.sizes);
});

it('gives each divider a distinguishing accessible name', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div><div>C</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const dividers = [...el.shadowRoot!.querySelectorAll('[part="divider"]')] as HTMLElement[];
  const labels = dividers.map((d) => d.getAttribute('aria-label'));
  expect(labels.every((l) => !!l)).to.be.true;
  expect(new Set(labels).size).to.equal(labels.length);
});

it('renders a clamp()-based flex-basis for a panel with panelConstraints, leaving unconstrained panels bare-percent', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  // Pinned so this test's own 30% share (of a 500px container) stays inside
  // the constraint's [40px, 200px] bounds -- i.e. this panel is not actually
  // clamped this render, so there's nothing for panel B to absorb, and its
  // flex-basis stays bare-percent. Without pinning this, the container falls
  // back to the test runner's real (browser-default, environment-dependent)
  // width, which happens to be wide enough to clamp panel A and would then
  // legitimately trigger redistribution -- see the two tests below, which
  // cover the clamped and containerSize<=0 cases explicitly.
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 500);
  el.sizes = [30, 70];
  el.panelConstraints = [{ minPx: 40, maxPx: 200 }, null];
  await elementUpdated(el);
  const [panelA, panelB] = [...el.children] as HTMLElement[];
  expect(panelA.style.flex).to.equal('0 1 clamp(40px, 30%, 200px)');
  expect(panelB.style.flex).to.equal('0 1 70%');
});

it('redistributes an unconstrained sibling into space freed by a maxPx-clamped panel', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 1920);
  el.sizes = [50, 50];
  el.panelConstraints = [{ minPx: 150, maxPx: 440 }, null];
  await elementUpdated(el);
  const [panelA, panelB] = [...el.children] as HTMLElement[];
  expect(panelA.style.flex).to.equal('0 1 clamp(150px, 50%, 440px)');
  // Panel A's 50% share clamps down to (440/1920)*100%; panel B (no
  // constraint) absorbs exactly the freed difference. The browser
  // re-serializes the long repeating-decimal percent (same normalization the
  // sentinel-px test below already works around), so parse the numeric value
  // out and compare with a tolerance instead of asserting an exact string.
  const clampedPercent = (440 / 1920) * 100;
  const freedPercent = 50 - clampedPercent;
  const match = /^0 1 ([\d.]+)%$/.exec(panelB.style.flex);
  expect(match, `unexpected flex-basis shape: ${panelB.style.flex}`).to.not.equal(null);
  expect(Number(match![1])).to.be.closeTo(50 + freedPercent, 1e-3);
});

it('does not redistribute when the container is too narrow to measure (containerSize <= 0)', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  // Explicitly pinned to 0 -- an un-mocked fixture in this real-browser test
  // runner still reports a genuine nonzero layout width (the test page's
  // default viewport), which is itself a real, measured containerSize and so
  // would legitimately clamp+redistribute here (30% of it exceeds this
  // constraint's 200px maxPx). This test's actual subject is the
  // containerSize<=0 short-circuit, which requires mocking it directly.
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 0);
  el.sizes = [30, 70];
  el.panelConstraints = [{ minPx: 40, maxPx: 200 }, null];
  await elementUpdated(el);
  const [panelA, panelB] = [...el.children] as HTMLElement[];
  expect(panelA.style.flex).to.equal('0 1 clamp(40px, 30%, 200px)');
  expect(panelB.style.flex).to.equal('0 1 70%');
});

it('falls back to sentinel px bounds when a constraint only specifies one side', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  el.sizes = [30, 70];
  el.panelConstraints = [{ minPx: 40 }];
  await elementUpdated(el);
  const [panelA] = [...el.children] as HTMLElement[];
  // The browser may re-serialize a large px literal (e.g. `1000000px` ->
  // `1e+06px`) when normalizing the `flex` shorthand, so parse the numeric
  // value out instead of asserting an exact fallback string.
  const match = /^0 1 clamp\(40px, 30%, ([\d.e+]+)px\)$/.exec(panelA.style.flex);
  expect(match, `unexpected flex-basis shape: ${panelA.style.flex}`).to.not.equal(null);
  expect(Number(match![1])).to.equal(1_000_000);
});

it('stops a drag at a px-derived min bound instead of the plain percent min', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  // min=10 (default) would allow panel[0] down to 10%; the constraint's
  // 60px is 30% of a 200px container, well above that plain floor.
  el.panelConstraints = [{ minPx: 60 }];
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 200);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.setPointerCapture = () => {};

  divider.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: -1000 }));
  expect(el.sizes[0]).to.equal(30);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
});

it('stops a drag at a px-derived max bound on the dragged panel', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  el.panelConstraints = [{ maxPx: 60 }]; // 60px of a 200px container = 30%
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 200);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.setPointerCapture = () => {};

  divider.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 1000 }));
  expect(el.sizes[0]).to.equal(30);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
});

it('stops keyboard-driven resizing at a px-derived min bound instead of the plain percent min', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  el.panelConstraints = [{ minPx: 60 }];
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 200);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;

  for (let i = 0; i < 20; i++) {
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  }
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(30);
});

it('clamps pointer and keyboard resizing to percent-only panel bounds', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  el.panelConstraints = [{ minPercent: 30, maxPercent: 50 }, null];
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 400);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.setPointerCapture = () => {};

  divider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11, clientX: 200 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, clientX: -1000 }));
  expect(el.sizes[0]).to.equal(30);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11 }));

  for (let i = 0; i < 20; i++) {
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  }
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(50);
  expect((el.children[0] as HTMLElement).style.flex).to.include('clamp(30%, 50%, 50%)');
});

it('combines px and percent bounds using the stricter lower and upper limits', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  el.panelConstraints = [{ minPx: 280, minPercent: 20, maxPercent: 50 }, null];
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 800); // max(280px = 35%, 20%) => 35%; max => 50%
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  for (let i = 0; i < 20; i++) {
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  }
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(35);
  expect((el.children[0] as HTMLElement).style.flex).to.include('max(10%, 280px, 20%)');
});

it('reports an invalid percent range through lr-split-constraints-invalid', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  const invalid = oneEvent(el, 'lr-split-constraints-invalid');
  el.panelConstraints = [{ minPercent: 60, maxPercent: 40 }, null];
  expect((await invalid).detail.reason).to.equal('minimum-exceeds-maximum');
});

it('keeps a constrained panel pinned between its px bounds when the container is resized', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  el.panelConstraints = [{ minPx: 60 }];
  await elementUpdated(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;

  mockWidth(base, 200); // 60px -> 30% floor
  for (let i = 0; i < 20; i++) {
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  }
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(30);

  // Container grows: the same fixed 60px is now a smaller share, so the
  // percent floor drops with it — the panel stays pinned to 60px, not 30%.
  mockWidth(base, 600); // 60px -> 10% floor
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(28);
});

it('does not overflow its container by the dividers\' own width in the default (uncollapsed) state', async () => {
  const el = (await fixture(html`
    <lr-split>
      <div>A</div>
      <div>B</div>
      <div>C</div>
    </lr-split>
  `)) as LyraSplit;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  mockWidth(base, 900);
  await elementUpdated(el);
  const panels = [...el.children] as HTMLElement[];
  // flex-shrink (the second flex shorthand token) must be nonzero so the panels can absorb
  // the two dividers' combined width instead of the row overflowing by that fixed amount.
  for (const panel of panels) {
    const shrink = panel.style.flex.trim().split(/\s+/)[1];
    expect(shrink).to.not.equal('0');
  }
});

it('splits :hover and :focus-visible into separate divider rules with a token-driven outline', () => {
  const css = styles.cssText;

  // The two states must no longer share one selector list.
  expect(css).to.not.match(/\[part=['"]?divider['"]?]:hover\s*,\s*\[part=['"]?divider['"]?]:focus-visible/);

  const hoverBlock = /\[part=['"]?divider['"]?]:hover\s*{([^}]*)}/.exec(css);
  expect(hoverBlock, 'expected a standalone [part="divider"]:hover rule').to.not.equal(null);
  expect(hoverBlock![1]).to.include('background');

  const focusVisibleBlock = /\[part=['"]?divider['"]?]:focus-visible\s*{([^}]*)}/.exec(css);
  expect(focusVisibleBlock, 'expected a standalone [part="divider"]:focus-visible rule').to.not.equal(null);
  const focusBody = focusVisibleBlock![1];

  // No more `outline: none` on focus-visible...
  expect(focusBody).to.not.include('outline: none');
  // ...it now uses the exact shared focus-ring tokens, not hardcoded literals.
  expect(focusBody).to.include('var(--lr-focus-ring-width)');
  expect(focusBody).to.include('var(--lr-focus-ring-color)');
  expect(focusBody).to.include('outline-offset: var(--lr-focus-ring-offset)');
});

// -- Responsive collapse (collapse="start"/"end") -------------------------

it('defaults collapse to "none", leaving dividers/panels byte-for-byte unaffected (no data-collapse-state, no aria-disabled, tabindex="0")', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.collapse).to.equal('none');
  expect(el.hasAttribute('data-collapse-state')).to.be.false;
  const [panelA, panelB] = [...el.children] as HTMLElement[];
  expect(panelA.dataset.collapseState).to.equal(undefined);
  expect(panelB.dataset.collapseState).to.equal(undefined);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  expect(divider.hasAttribute('aria-disabled')).to.be.false;
  expect(divider.getAttribute('tabindex')).to.equal('0');
});

it('does not schedule a Lit update from the initial collapse observer setup', async () => {
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  globalWarnings?.forEach((warning) => {
    if (warning.includes('scheduled an update')) globalWarnings.delete(warning);
  });
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await el.updateComplete;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  } finally {
    console.warn = originalWarn;
  }
  expect(calls.flat().map(String).some((message) => message.includes('scheduled an update'))).to.be.false;
});

it('clamps the collapse="start" panel (index 0) to rail-width and marks it via dataset + host attribute once the container narrows into the rail range', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    expect(spy.callbacks.length).to.equal(1);

    fireCollapseResize(spy.callbacks[0], 500); // between floatBreakpoint(400) and railBreakpoint(640)
    await elementUpdated(el);

    const [panelA, panelB] = [...el.children] as HTMLElement[];
    expect(el.collapseState).to.equal('rail');
    expect(panelA.style.flex).to.equal('0 0 3.5rem');
    expect(panelA.dataset.collapseState).to.equal('rail');
    expect(panelB.dataset.collapseState).to.equal(undefined);
    // The other pane fills whatever room the rail-clamped pane no longer takes.
    expect(panelB.style.flex).to.include('1 0%');
    expect(el.getAttribute('data-collapse-state')).to.equal('rail');
  } finally {
    spy.restore();
  }
});

it("honors a sibling panel's own panelConstraints while its neighbor is rail-collapsed instead of growing it unclamped", async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    mockWidth(base, 500);
    el.panelConstraints = [null, { minPx: 40, maxPx: 120 }];
    await elementUpdated(el);
    expect(spy.callbacks.length).to.equal(1);

    fireCollapseResize(spy.callbacks[0], 500); // between floatBreakpoint(400) and railBreakpoint(640) -> rail
    await elementUpdated(el);

    const [panelA, panelB] = [...el.children] as HTMLElement[];
    expect(el.collapseState).to.equal('rail');
    expect(panelA.style.flex).to.equal('0 0 3.5rem');
    // Panel B still honors its own [40px, 120px] constraint instead of
    // growing unclamped to fill the space panel A's rail-collapse freed up.
    expect(panelB.style.flex).to.equal('0 1 clamp(40px, 50%, 120px)');
  } finally {
    spy.restore();
  }
});

it('resolves collapse="end" to the LAST panel, including for 3+ panels', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="end"><div>A</div><div>B</div><div>C</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 500);
    await elementUpdated(el);

    const [panelA, panelB, panelC] = [...el.children] as HTMLElement[];
    expect(panelA.dataset.collapseState).to.equal(undefined);
    expect(panelB.dataset.collapseState).to.equal(undefined);
    expect(panelC.dataset.collapseState).to.equal('rail');
    expect(panelC.style.flex).to.equal('0 0 3.5rem');
  } finally {
    spy.restore();
  }
});

it('resolves collapse="start"/"end" to the same physical panel indices (0 / last) under a simulated RTL host, since panel 0 already renders at the logical inline-start edge regardless of direction (same as the existing pointer-drag RTL behavior above)', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split dir="rtl" collapse="start"><div>A</div><div>B</div><div>C</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 500);
    await elementUpdated(el);
    const [panelA, , panelC] = [...el.children] as HTMLElement[];
    expect(panelA.dataset.collapseState).to.equal('rail');
    expect(panelC.dataset.collapseState).to.equal(undefined);
  } finally {
    spy.restore();
  }

  const spyEnd = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split dir="rtl" collapse="end"><div>A</div><div>B</div><div>C</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spyEnd.callbacks[0], 500);
    await elementUpdated(el);
    const [panelA, , panelC] = [...el.children] as HTMLElement[];
    expect(panelA.dataset.collapseState).to.equal(undefined);
    expect(panelC.dataset.collapseState).to.equal('rail');
  } finally {
    spyEnd.restore();
  }
});

it('transitions collapseState across both breakpoints (wide -> rail -> floating) as the container width crosses them', async () => {
  const spy = installResizeObserverSpy();
  try {
    // Fixed size: opening the floating drawer below must not perturb the
    // host's own measured box, which would otherwise let a REAL (unmocked)
    // ResizeObserver notification race the synthetic ones driving this test.
    const el = (await fixture(
      html`<lr-split collapse="start" style="inline-size: 300px; block-size: 200px"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);

    fireCollapseResize(spy.callbacks[0], 800); // >= railBreakpoint(640) -> wide
    await elementUpdated(el);
    expect(el.collapseState).to.equal('wide');
    expect(el.hasAttribute('data-collapse-state')).to.be.false;

    fireCollapseResize(spy.callbacks[0], 500); // floatBreakpoint(400) <= 500 < railBreakpoint(640) -> rail
    await elementUpdated(el);
    expect(el.collapseState).to.equal('rail');
    expect(el.getAttribute('data-collapse-state')).to.equal('rail');

    fireCollapseResize(spy.callbacks[0], 300); // < floatBreakpoint(400) -> floating
    await elementUpdated(el);
    expect(el.collapseState).to.equal('floating');
    expect(el.getAttribute('data-collapse-state')).to.equal('floating');

    // The 'floating' state is a hidden-by-default drawer (see split.ts's
    // class doc) -- `open` must be set to reveal the geometry asserted below,
    // mirroring how a consumer would actually see this overlay card.
    el.open = true;
    await elementUpdated(el);

    const [panelA, panelB] = [...el.children] as HTMLElement[];
    expect(panelA.style.position).to.equal('absolute');
    // The browser normalizes a bare `0` length to `0px` in CSSOM.
    expect(panelA.style.insetInlineStart).to.equal('0px');
    expect(panelA.style.insetBlock).to.equal('0px');
    // The other pane takes the full split width once the collapsing pane is
    // lifted out of the flex flow entirely.
    expect(panelB.style.flex).to.include('1 0%');

    fireCollapseResize(spy.callbacks[0], 800); // back to wide
    await elementUpdated(el);
    expect(el.collapseState).to.equal('wide');
    expect(panelA.style.position).to.equal('');
    expect(panelA.style.flex).to.include('%');
  } finally {
    spy.restore();
  }
});

it('fires lr-split-collapse-change only on an actual collapseState transition, not on every resize callback', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    // Establish a known baseline before attaching the listener, so this
    // assertion doesn't depend on whatever real width the fixture happened
    // to render at.
    fireCollapseResize(spy.callbacks[0], 800);
    await elementUpdated(el);

    const events: string[] = [];
    el.addEventListener('lr-split-collapse-change', (e) =>
      events.push((e as CustomEvent<{ state: string }>).detail.state),
    );

    fireCollapseResize(spy.callbacks[0], 500); // wide -> rail: transition
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 550); // still rail: no transition
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // rail -> floating: transition
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 350); // still floating: no transition
    await elementUpdated(el);

    expect(events).to.deep.equal(['rail', 'floating']);
  } finally {
    spy.restore();
  }
});

it('disables dragging (pointer and keyboard) on the divider adjacent to the collapsed pane', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    await elementUpdated(el);

    const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
    expect(divider.getAttribute('aria-disabled')).to.equal('true');
    expect(divider.getAttribute('tabindex')).to.equal('-1');

    const before = [...el.sizes];
    divider.setPointerCapture = () => {};
    divider.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }),
    );
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 150 }));
    expect(el.sizes).to.deep.equal(before);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));

    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await elementUpdated(el);
    expect(el.sizes).to.deep.equal(before);
  } finally {
    spy.restore();
  }
});

it('leaves a non-adjacent divider fully draggable while a different pane is collapsed (3-panel case)', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div><div>C</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating; panel 0 ("start") collapses
    await elementUpdated(el);

    const dividers = [...el.shadowRoot!.querySelectorAll('[part="divider"]')] as HTMLElement[];
    // divider[0] sits between panel0/panel1 -- adjacent to the collapsed panel0.
    expect(dividers[0].getAttribute('aria-disabled')).to.equal('true');
    // divider[1] sits between panel1/panel2 -- not adjacent, stays enabled.
    expect(dividers[1].hasAttribute('aria-disabled')).to.be.false;

    const before = el.sizes[1];
    dividers[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await elementUpdated(el);
    expect(el.sizes[1]).to.be.greaterThan(before);
  } finally {
    spy.restore();
  }
});

it('reverts to plain wide/percent styling and clears data-collapse-state when collapse is switched back to "none" at runtime', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    await elementUpdated(el);
    expect(el.getAttribute('data-collapse-state')).to.equal('floating');

    el.collapse = 'none';
    await elementUpdated(el);

    expect(el.hasAttribute('data-collapse-state')).to.be.false;
    const [panelA] = [...el.children] as HTMLElement[];
    expect(panelA.dataset.collapseState).to.equal(undefined);
    expect(panelA.style.position).to.equal('');
    expect(panelA.style.flex).to.include('%');

    const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
    expect(divider.hasAttribute('aria-disabled')).to.be.false;
  } finally {
    spy.restore();
  }
});

it('resets collapseState to "wide" from willUpdate(), not updated(), so switching collapse back to "none" does not schedule a redundant extra render', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    await elementUpdated(el);
    expect(el.collapseState).to.equal('floating');

    el.collapse = 'none';
    // A property set from updated()/firstUpdated() (as opposed to
    // willUpdate()) leaves `isUpdatePending` true again the moment this
    // update's own updateComplete resolves, since Lit schedules the
    // follow-up update synchronously inside updated() but the follow-up
    // pass itself hasn't run yet -- exactly the condition Lit's own
    // dev-mode "scheduled an update ... after an update completed" warning
    // checks for. Resetting `collapseState` in willUpdate() instead means
    // it's folded into *this* render pass, so no second update is pending
    // once this one finishes.
    await el.updateComplete;
    expect(el.collapseState).to.equal('wide');
    expect((el as unknown as { isUpdatePending: boolean }).isUpdatePending).to.be.false;
  } finally {
    spy.restore();
  }
});

it('reconciles a directly-assigned sizes array of the wrong length from willUpdate(), not updated(), avoiding the same redundant-render pattern', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  // A consumer setting `sizes` directly to an array whose length doesn't
  // match panelCount (stale data, a race with a panel-count change, etc.)
  // makes `ensureSizes()` actually rewrite `sizes` from within the update
  // that observed the mismatch -- if that correction ran from updated()
  // instead of willUpdate() it would schedule a second update on top of the
  // one that just finished (same class of bug as the collapseState reset
  // above).
  el.sizes = [10, 20, 30, 40];
  await el.updateComplete;

  expect(el.sizes.length).to.equal(2);
  const sum = el.sizes.reduce((a, b) => a + b, 0);
  expect(sum).to.be.closeTo(100, 1e-9);
  expect((el as unknown as { isUpdatePending: boolean }).isUpdatePending).to.be.false;
});

it('anchors the floating overlay to inset-inline-end for collapse="end" (vs. inset-inline-start for collapse="start")', async () => {
  const spy = installResizeObserverSpy();
  try {
    // See the fixed-size comment on the "wide -> rail -> floating" test above.
    const el = (await fixture(
      html`<lr-split collapse="end" style="inline-size: 300px; block-size: 200px"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    // Reveal the hidden-by-default drawer (see split.ts's class doc) so its
    // geometry below is actually applied.
    el.open = true;
    await elementUpdated(el);

    const [panelA, panelB] = [...el.children] as HTMLElement[];
    expect(panelA.style.position).to.equal('');
    expect(panelB.style.position).to.equal('absolute');
    expect(panelB.style.insetInlineEnd).to.equal('0px');
    expect(panelB.style.insetInlineStart).to.equal('');
  } finally {
    spy.restore();
  }
});

it('honors a custom rail-width for the rail state', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start" rail-width="4rem"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 500);
    await elementUpdated(el);
    const [panelA] = [...el.children] as HTMLElement[];
    expect(panelA.style.flex).to.equal('0 0 4rem');
  } finally {
    spy.restore();
  }
});

it('honors custom rail-breakpoint/float-breakpoint attributes', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split
        collapse="start"
        rail-breakpoint="900"
        float-breakpoint="600"
      ><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    expect(el.railBreakpoint).to.equal(900);
    expect(el.floatBreakpoint).to.equal(600);

    fireCollapseResize(spy.callbacks[0], 700); // between 600 and 900 -> rail
    await elementUpdated(el);
    expect(el.getAttribute('data-collapse-state')).to.equal('rail');
  } finally {
    spy.restore();
  }
});

// -- numeric guard regressions (min / railBreakpoint / floatBreakpoint) ----

it('sanitizes a NaN min to its own declared default instead of letting NaN reach the percent-bounds clamp', async () => {
  const el = (await fixture(
    html`<lr-split min="NaN"><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  el.sizes = [50, 50];
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  // A NaN min must fall back to the property's own declared default (10), not propagate NaN through
  // aria-valuemin/percentBounds.
  expect(divider.getAttribute('aria-valuemin')).to.equal('10');
});

it('clamps a negative min to 0 rather than a nonsensical negative floor', async () => {
  const el = (await fixture(
    html`<lr-split><div>A</div><div>B</div></lr-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  el.sizes = [1, 99];
  await elementUpdated(el);
  (el as unknown as { min: number }).min = -20;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  expect(divider.getAttribute('aria-valuemin')).to.equal('0');

  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.at.least(0);
});

it('honors custom rail-breakpoint/float-breakpoint attributes with an invalid/inverted pair sanitized', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split
        collapse="start"
        rail-breakpoint="NaN"
        float-breakpoint="600"
      ><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);

    // railBreakpoint falls back to its own 640 default, still above the valid floatBreakpoint(600).
    fireCollapseResize(spy.callbacks[0], 620); // between 600 (float) and the sanitized 640 (rail) default
    await elementUpdated(el);
    expect(el.getAttribute('data-collapse-state')).to.equal('rail');

    fireCollapseResize(spy.callbacks[0], 300); // below floatBreakpoint(600)
    await elementUpdated(el);
    expect(el.getAttribute('data-collapse-state')).to.equal('floating');
  } finally {
    spy.restore();
  }
});

it('never gets permanently stuck in floating for an inverted rail/float pair -- reaches wide at a large width', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split
        collapse="start"
        rail-breakpoint="100"
        float-breakpoint="600"
      ><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);

    // railBreakpoint(100) is below floatBreakpoint(600) -- the sanitized rail breakpoint is raised to
    // match floatBreakpoint(600) rather than staying inverted, so a comfortably wide container still
    // resolves to 'wide' (never stuck reporting 'floating'/'rail' regardless of width). 'wide' has no
    // `data-collapse-state` attribute at all (only a genuinely collapsed state sets one).
    fireCollapseResize(spy.callbacks[0], 2000);
    await elementUpdated(el);
    expect(el.collapseState).to.equal('wide');
    expect(el.hasAttribute('data-collapse-state')).to.be.false;
  } finally {
    spy.restore();
  }
});

// -- collapseState: forceable accessor (mirrors lr-app-rail's `mode`) ----

it('pins a forced collapseState across a subsequent resize, ignoring measurement until released', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 500); // rail baseline
    await elementUpdated(el);
    expect(el.collapseState).to.equal('rail');

    el.collapseState = 'wide'; // force, even though the container is still narrow
    await elementUpdated(el);
    expect(el.collapseState).to.equal('wide');

    fireCollapseResize(spy.callbacks[0], 300); // would normally -> floating
    await elementUpdated(el);
    expect(el.collapseState).to.equal('wide'); // still pinned
  } finally {
    spy.restore();
  }
});

it('releases a forced collapseState back to measurement-derived state via the "auto" sentinel', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 800); // wide baseline
    await elementUpdated(el);

    el.collapseState = 'floating'; // force
    await elementUpdated(el);
    expect(el.collapseState).to.equal('floating');

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    mockWidth(base, 800); // measures back to 'wide'
    el.collapseState = 'auto';
    await elementUpdated(el);
    expect(el.collapseState).to.equal('wide');

    // Automatic tracking resumed: a subsequent resize takes effect again.
    fireCollapseResize(spy.callbacks[0], 300);
    await elementUpdated(el);
    expect(el.collapseState).to.equal('floating');
  } finally {
    spy.restore();
  }
});

it('fires lr-split-collapse-change on a forced assignment and on release-to-auto, only when the effective state actually changes', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 800); // wide baseline
    await elementUpdated(el);

    const events: string[] = [];
    el.addEventListener('lr-split-collapse-change', (e) =>
      events.push((e as CustomEvent<{ state: string }>).detail.state),
    );

    el.collapseState = 'floating'; // forced assignment: transition, fires
    await elementUpdated(el);
    el.collapseState = 'floating'; // redundant reassignment: no transition, no event
    await elementUpdated(el);

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    mockWidth(base, 800); // measures to 'wide'
    el.collapseState = 'auto'; // release: transitions back to 'wide', fires
    await elementUpdated(el);
    el.collapseState = 'auto'; // already unforced and still measures to 'wide': no event
    await elementUpdated(el);

    expect(events).to.deep.equal(['floating', 'wide']);
  } finally {
    spy.restore();
  }
});

it('reflects collapseState to a collapse-state attribute', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 500); // rail
    await elementUpdated(el);
    expect(el.getAttribute('collapse-state')).to.equal('rail');

    el.collapseState = 'floating';
    await elementUpdated(el);
    expect(el.getAttribute('collapse-state')).to.equal('floating');
  } finally {
    spy.restore();
  }
});

// -- 'floating' hidden-by-default drawer (open) ----------------------------

it('defaults open to false: the floating pane renders nothing (hidden, out of the accessibility tree) until opened', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lr-split collapse="start"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    expect(el.open).to.be.false;

    fireCollapseResize(spy.callbacks[0], 300); // floating
    await elementUpdated(el);

    const [panelA] = [...el.children] as HTMLElement[];
    expect(panelA.hidden).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.equal(null);
  } finally {
    spy.restore();
  }
});

it('reveals the floating pane and renders a backdrop once open is set to true', async () => {
  const spy = installResizeObserverSpy();
  try {
    // Fixed size: unhiding the floating pane/inserting the backdrop must not
    // perturb the host's own measured box, which would otherwise let a REAL
    // (unmocked) ResizeObserver notification race the synthetic one below.
    const el = (await fixture(
      html`<lr-split collapse="start" style="inline-size: 300px; block-size: 200px"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    await elementUpdated(el);

    el.open = true;
    await elementUpdated(el);

    const [panelA] = [...el.children] as HTMLElement[];
    expect(panelA.hidden).to.be.false;
    expect(panelA.style.position).to.equal('absolute');
    expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.not.equal(null);
  } finally {
    spy.restore();
  }
});

it('moves focus into the floating pane when opened', async () => {
  const spy = installResizeObserverSpy();
  try {
    // See the fixed-size comment on the previous test.
    const el = (await fixture(
      html`<lr-split collapse="start" style="inline-size: 300px; block-size: 200px"><div><button>first</button><button>second</button></div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    await elementUpdated(el);
    const first = el.querySelector('button') as HTMLButtonElement;

    el.open = true;
    await elementUpdated(el);

    expect(document.activeElement).to.equal(first);
  } finally {
    spy.restore();
  }
});

it('traps Tab focus within the floating pane while open, wrapping last->first and first->last', async () => {
  const spy = installResizeObserverSpy();
  try {
    // See the fixed-size comment above.
    const el = (await fixture(
      html`<lr-split collapse="start" style="inline-size: 300px; block-size: 200px"><div><button>first</button><button>last</button></div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    el.open = true;
    await elementUpdated(el);

    const [first, last] = [...el.querySelectorAll('button')] as HTMLButtonElement[];
    last.focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
    expect(document.activeElement).to.equal(first);

    const tabBackward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    expect(document.activeElement).to.equal(last);
  } finally {
    spy.restore();
  }
});

it('closes the floating drawer on Escape', async () => {
  const spy = installResizeObserverSpy();
  try {
    // See the fixed-size comment above.
    const el = (await fixture(
      html`<lr-split collapse="start" style="inline-size: 300px; block-size: 200px"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    el.open = true;
    await elementUpdated(el);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await elementUpdated(el);
    expect(el.open).to.be.false;
  } finally {
    spy.restore();
  }
});

it('closes the floating drawer on backdrop click', async () => {
  const spy = installResizeObserverSpy();
  try {
    // See the fixed-size comment above.
    const el = (await fixture(
      html`<lr-split collapse="start" style="inline-size: 300px; block-size: 200px"><div>A</div><div>B</div></lr-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
    el.open = true;
    await elementUpdated(el);

    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    await elementUpdated(el);
    expect(el.open).to.be.false;
  } finally {
    spy.restore();
  }
});

describe('dividerLabel', () => {
  it('overrides the divider aria-label template when set', async () => {
    const el = (await fixture(html`
      <lr-split>
        <div>a</div>
        <div>b</div>
      </lr-split>
    `)) as LyraSplit;
    el.dividerLabel = (index: number, panelCount: number) => `Diviseur ${index + 1} sur ${panelCount - 1}`;
    await el.updateComplete;
    const divider = el.shadowRoot!.querySelector('[part="divider"]')!;
    expect(divider.getAttribute('aria-label')).to.equal('Diviseur 1 sur 1');
  });

  it('falls back to the built-in English template when unset (regression)', async () => {
    const el = (await fixture(html`
      <lr-split>
        <div>a</div>
        <div>b</div>
      </lr-split>
    `)) as LyraSplit;
    await el.updateComplete;
    const divider = el.shadowRoot!.querySelector('[part="divider"]')!;
    expect(divider.getAttribute('aria-label')).to.equal('Resize divider between panel 1 and panel 2');
  });
});

describe('orientationBreakpointBasis', () => {
  it('defaults to "container", leaving committed behavior unchanged', async () => {
    const el = (await fixture(html`<lr-split><div>a</div><div>b</div></lr-split>`)) as LyraSplit;
    expect(el.orientationBreakpointBasis).to.equal('container');
    expect(el.effectiveOrientation).to.equal('horizontal');
    expect(el.hasAttribute('data-effective-orientation')).to.be.false;
  });

  it('reflects the basis to an attribute', async () => {
    const el = (await fixture(html`
      <lr-split orientation-breakpoint="1px" orientation-breakpoint-basis="viewport">
        <div>a</div><div>b</div>
      </lr-split>
    `)) as LyraSplit;
    await elementUpdated(el);
    expect(el.getAttribute('orientation-breakpoint-basis')).to.equal('viewport');
  });

  it('goes narrow under basis="viewport" when an absurdly large breakpoint always matches', async () => {
    const el = (await fixture(html`
      <lr-split orientation-breakpoint="99999px" orientation-breakpoint-basis="viewport">
        <div>a</div><div>b</div>
      </lr-split>
    `)) as LyraSplit;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    expect(el.getAttribute('data-effective-orientation')).to.equal('vertical');
  });

  it('ignores the container width entirely under basis="viewport"', async () => {
    // The container is 120px wide, so a container-basis reading of a 1px breakpoint
    // would be "not below" anyway -- but a 99999px container-basis breakpoint WOULD be
    // below. Pairing a narrow container with a never-matching viewport query proves the
    // viewport path is the live one.
    const wrapper = (await fixture(html`
      <div style="inline-size: 120px">
        <lr-split orientation-breakpoint="1px" orientation-breakpoint-basis="viewport">
          <div>a</div><div>b</div>
        </lr-split>
      </div>
    `)) as HTMLElement;
    const split = wrapper.querySelector('lr-split') as LyraSplit;
    await elementUpdated(split);
    expect(split.effectiveOrientation).to.equal('horizontal');
  });

  it('re-queries matchMedia when the breakpoint changes at runtime', async () => {
    const el = (await fixture(html`
      <lr-split orientation-breakpoint="1px" orientation-breakpoint-basis="viewport">
        <div>a</div><div>b</div>
      </lr-split>
    `)) as LyraSplit;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('horizontal');
    el.orientationBreakpoint = '99999px';
    await elementUpdated(el);
    expect(el.effectiveOrientation, 'a stale MediaQueryList would leave this horizontal').to.equal('vertical');
  });

  it('switches observation strategy when the basis changes at runtime', async () => {
    const el = (await fixture(html`
      <lr-split orientation-breakpoint="99999px" orientation-breakpoint-basis="viewport">
        <div>a</div><div>b</div>
      </lr-split>
    `)) as LyraSplit;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('vertical');
    el.orientationBreakpointBasis = 'container';
    el.orientationBreakpoint = '1px';
    await elementUpdated(el);
    expect(el.effectiveOrientation, 'container basis must consult the measured width').to.equal('horizontal');
  });

  it('emits lr-split-orientation-change when a viewport-basis change flips the axis', async () => {
    const el = (await fixture(html`
      <lr-split orientation-breakpoint="1px" orientation-breakpoint-basis="viewport">
        <div>a</div><div>b</div>
      </lr-split>
    `)) as LyraSplit;
    await elementUpdated(el);
    setTimeout(() => {
      el.orientationBreakpoint = '99999px';
    });
    const event = await oneEvent(el, 'lr-split-orientation-change');
    expect(event.detail.orientation).to.equal('vertical');
  });

  it('treats an unresolvable breakpoint as unset under basis="viewport"', async () => {
    const el = (await fixture(html`
      <lr-split orientation-breakpoint="80vw" orientation-breakpoint-basis="viewport">
        <div>a</div><div>b</div>
      </lr-split>
    `)) as LyraSplit;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal('horizontal');
    expect(el.hasAttribute('data-effective-orientation')).to.be.false;
  });

  it('re-arms the media query after a disconnect/reconnect cycle', async () => {
    const el = (await fixture(html`
      <lr-split orientation-breakpoint="1px" orientation-breakpoint-basis="viewport">
        <div>a</div><div>b</div>
      </lr-split>
    `)) as LyraSplit;
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
      <lr-split orientation-breakpoint="99999px" orientation-breakpoint-basis="viewport">
        <div>a</div><div>b</div>
      </lr-split>
    `)) as LyraSplit;
    await elementUpdated(el);
    await expect(el).to.be.accessible();
  });

  it('does not emit lr-split-orientation-change on the initial render', async () => {
    // Lit's first `changed` map lists every set property, so a viewport breakpoint that
    // already matches at mount must not be announced as a transition -- the initial axis
    // is the starting state, not a change from anything.
    const el = document.createElement('lr-split') as LyraSplit;
    el.setAttribute('orientation-breakpoint', '99999px');
    el.setAttribute('orientation-breakpoint-basis', 'viewport');
    el.append(document.createElement('div'), document.createElement('div'));
    let emitted = 0;
    el.addEventListener('lr-split-orientation-change', () => {
      emitted += 1;
    });
    document.body.append(el);
    await elementUpdated(el);
    expect(el.effectiveOrientation, 'still starts narrow').to.equal('vertical');
    expect(emitted, 'initial render is not a transition').to.equal(0);
    el.remove();
  });
});
