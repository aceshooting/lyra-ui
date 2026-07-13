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

function fireCollapseResize(callback: ResizeObserverCallback, width: number): void {
  callback(
    [{ contentBoxSize: [{ inlineSize: width, blockSize: 0 }] } as unknown as ResizeObserverEntry],
    {} as ResizeObserver,
  );
}

it('splits children evenly by default', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div><div>C</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  expect(el.sizes.length).to.equal(3);
  const sum = el.sizes.reduce((a, b) => a + b, 0);
  expect(Math.round(sum)).to.equal(100);
  expect(el.shadowRoot!.querySelectorAll('[part="divider"]').length).to.equal(2);
});

it('resizes via keyboard on a divider and emits lyra-resize', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  expect(divider.getAttribute('role')).to.equal('separator');
  const before = el.sizes[0];
  let detail: { sizes: number[] } | undefined;
  el.addEventListener('lyra-resize', (e) => (detail = (e as CustomEvent).detail));
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.be.greaterThan(before);
  expect(detail!.sizes[0]).to.equal(el.sizes[0]);
});

it('mirrors ArrowRight/ArrowLeft under dir="rtl", since panels reorder visually via flex order', async () => {
  const el = (await fixture(
    html`<lyra-split dir="rtl"><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split dir="rtl" orientation="vertical"><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split dir="rtl"><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split min="20"><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  el.sizes = [20, 80];
  await elementUpdated(el);
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await elementUpdated(el);
  expect(el.sizes[0]).to.equal(20);
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await expect(el).to.be.accessible();
});

it('persists sizes to localStorage when storageKey is set', async () => {
  const storageKey = 'test-split-' + Math.random();
  localStorage.clear();

  const el = (await fixture(
    html`<lyra-split storage-key=${storageKey}><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  el.sizes = [25, 75];
  const divider = el.shadowRoot!.querySelector('[part="divider"]') as HTMLElement;
  divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);

  const stored = localStorage.getItem(`lyra-split:${storageKey}:2`);
  expect(stored).to.not.be.null;
  const parsed = JSON.parse(stored!);
  expect(parsed).to.be.an('array');
  expect(parsed.length).to.equal(2);
});

it('supports vertical orientation with vertical arrow keys', async () => {
  const el = (await fixture(
    html`<lyra-split orientation="vertical"><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div><div>C</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split orientation="vertical"><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div><div>C</div></lyra-split>`,
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
    html`<lyra-split min="10"><div>A</div><div>B</div><div>C</div></lyra-split>`,
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
      html`<lyra-split storage-key="blocked-test"><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split min="10"><div>A</div><div>B</div></lyra-split>`,
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
  localStorage.setItem(`lyra-split:${storageKey}:2`, JSON.stringify([5, 95]));

  const el = (await fixture(
    html`<lyra-split storage-key=${storageKey} min="10"><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);

  expect(el.sizes[0]).to.equal(50);
  expect(el.sizes[1]).to.equal(50);
});

it('preserves and restores custom panel proportions across an appended-then-removed panel', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div><div>C</div><div>D</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div><div>C</div><div>D</div></lyra-split>`,
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
    html`<lyra-split><div>a</div><div>b</div><div>c</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div><div>C</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split><div id="p1">a</div><div id="p2">b</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split storage-key=${storageKey}><div>A</div><div>B</div></lyra-split>`,
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
  expect(localStorage.getItem(`lyra-split:${storageKey}:2`)).to.be.null;

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));

  const stored = localStorage.getItem(`lyra-split:${storageKey}:2`);
  expect(stored).to.not.be.null;
  expect(JSON.parse(stored!)).to.deep.equal(el.sizes);
});

it('gives each divider a distinguishing accessible name', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div><div>C</div></lyra-split>`,
  )) as LyraSplit;
  await elementUpdated(el);
  const dividers = [...el.shadowRoot!.querySelectorAll('[part="divider"]')] as HTMLElement[];
  const labels = dividers.map((d) => d.getAttribute('aria-label'));
  expect(labels.every((l) => !!l)).to.be.true;
  expect(new Set(labels).size).to.equal(labels.length);
});

it('renders a clamp()-based flex-basis for a panel with panelConstraints, leaving unconstrained panels bare-percent', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  el.sizes = [30, 70];
  el.panelConstraints = [{ minPx: 40, maxPx: 200 }, null];
  await elementUpdated(el);
  const [panelA, panelB] = [...el.children] as HTMLElement[];
  expect(panelA.style.flex).to.equal('0 0 clamp(40px, 30%, 200px)');
  expect(panelB.style.flex).to.equal('0 0 70%');
});

it('falls back to sentinel px bounds when a constraint only specifies one side', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
  )) as LyraSplit;
  el.sizes = [30, 70];
  el.panelConstraints = [{ minPx: 40 }];
  await elementUpdated(el);
  const [panelA] = [...el.children] as HTMLElement[];
  // The browser may re-serialize a large px literal (e.g. `1000000px` ->
  // `1e+06px`) when normalizing the `flex` shorthand, so parse the numeric
  // value out instead of asserting an exact fallback string.
  const match = /^0 0 clamp\(40px, 30%, ([\d.e+]+)px\)$/.exec(panelA.style.flex);
  expect(match, `unexpected flex-basis shape: ${panelA.style.flex}`).to.not.equal(null);
  expect(Number(match![1])).to.equal(1_000_000);
});

it('stops a drag at a px-derived min bound instead of the plain percent min', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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

it('keeps a constrained panel pinned between its px bounds when the container is resized', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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
  expect(focusBody).to.include('var(--lyra-focus-ring-width)');
  expect(focusBody).to.include('var(--lyra-focus-ring-color)');
  expect(focusBody).to.include('outline-offset: var(--lyra-focus-ring-offset)');
});

// -- Responsive collapse (collapse="start"/"end") -------------------------

it('defaults collapse to "none", leaving dividers/panels byte-for-byte unaffected (no data-collapse-state, no aria-disabled, tabindex="0")', async () => {
  const el = (await fixture(
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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

it('clamps the collapse="start" panel (index 0) to rail-width and marks it via dataset + host attribute once the container narrows into the rail range', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lyra-split collapse="start"><div>A</div><div>B</div></lyra-split>`,
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

it('resolves collapse="end" to the LAST panel, including for 3+ panels', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lyra-split collapse="end"><div>A</div><div>B</div><div>C</div></lyra-split>`,
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
      html`<lyra-split dir="rtl" collapse="start"><div>A</div><div>B</div><div>C</div></lyra-split>`,
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
      html`<lyra-split dir="rtl" collapse="end"><div>A</div><div>B</div><div>C</div></lyra-split>`,
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
    const el = (await fixture(
      html`<lyra-split collapse="start"><div>A</div><div>B</div></lyra-split>`,
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

it('fires lyra-split-collapse-change only on an actual collapseState transition, not on every resize callback', async () => {
  const spy = installResizeObserverSpy();
  try {
    const el = (await fixture(
      html`<lyra-split collapse="start"><div>A</div><div>B</div></lyra-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    // Establish a known baseline before attaching the listener, so this
    // assertion doesn't depend on whatever real width the fixture happened
    // to render at.
    fireCollapseResize(spy.callbacks[0], 800);
    await elementUpdated(el);

    const events: string[] = [];
    el.addEventListener('lyra-split-collapse-change', (e) =>
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
      html`<lyra-split collapse="start"><div>A</div><div>B</div></lyra-split>`,
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
      html`<lyra-split collapse="start"><div>A</div><div>B</div><div>C</div></lyra-split>`,
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
      html`<lyra-split collapse="start"><div>A</div><div>B</div></lyra-split>`,
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
      html`<lyra-split collapse="start"><div>A</div><div>B</div></lyra-split>`,
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
    html`<lyra-split><div>A</div><div>B</div></lyra-split>`,
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
    const el = (await fixture(
      html`<lyra-split collapse="end"><div>A</div><div>B</div></lyra-split>`,
    )) as LyraSplit;
    await elementUpdated(el);
    fireCollapseResize(spy.callbacks[0], 300); // floating
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
      html`<lyra-split collapse="start" rail-width="4rem"><div>A</div><div>B</div></lyra-split>`,
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
      html`<lyra-split
        collapse="start"
        rail-breakpoint="900"
        float-breakpoint="600"
      ><div>A</div><div>B</div></lyra-split>`,
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
