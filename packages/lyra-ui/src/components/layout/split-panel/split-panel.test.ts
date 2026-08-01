import { elementUpdated, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './split-panel.js';
import type { LyraSplitPanel, SplitPanelSnapFunction } from './split-panel.js';

function divider(element: LyraSplitPanel): HTMLElement {
  return element.shadowRoot!.querySelector('[part~="divider"]') as HTMLElement;
}

function base(element: LyraSplitPanel): HTMLElement {
  return element.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
}

function keydown(element: LyraSplitPanel, key: string): void {
  divider(element).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function pointer(element: EventTarget, type: string, pointerId: number, x: number, y = 0): void {
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: x,
      clientY: y,
      pointerId,
    }),
  );
}

function installResizeObserverStub(): {
  callbacks: ResizeObserverCallback[];
  restore(): void;
} {
  const OriginalResizeObserver = window.ResizeObserver;
  const callbacks: ResizeObserverCallback[] = [];
  class StubResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = StubResizeObserver;
  return {
    callbacks,
    restore(): void {
      window.ResizeObserver = OriginalResizeObserver;
    },
  };
}

it('renders the exact two-pane slots, shared panel part, divider slot, and wrapper aliases', async () => {
  const element = (await fixture(html`
    <lr-split-panel style="inline-size: 400px; block-size: 200px">
      <div slot="start">Start</div>
      <span slot="divider">Grip</span>
      <div slot="end">End</div>
    </lr-split-panel>
  `)) as LyraSplitPanel;

  expect(element.shadowRoot!.querySelector('[part~="base"][part~="split-panel"]')).to.exist;
  expect(element.shadowRoot!.querySelector('[part~="start"][part~="panel"] slot[name="start"]')).to.exist;
  expect(element.shadowRoot!.querySelector('[part~="end"][part~="panel"] slot[name="end"]')).to.exist;
  expect(divider(element).querySelector('slot[name="divider"]')).to.exist;
  expect(base(element).style.getPropertyValue('--lr-split-panel-start-position')).to.equal('50%');
});

it('keeps percent and pixel positions synchronized in both directions', async () => {
  const element = (await fixture(html`
    <lr-split-panel style="inline-size: 400px; block-size: 200px"></lr-split-panel>
  `)) as LyraSplitPanel;
  await elementUpdated(element);

  expect(element.position).to.equal(50);
  expect(element.positionInPixels).to.be.closeTo(200, 1);

  element.position = 25;
  await elementUpdated(element);
  expect(element.positionInPixels).to.be.closeTo(100, 1);
  expect(base(element).style.getPropertyValue('--lr-split-panel-start-position')).to.equal('25%');

  element.positionInPixels = 120;
  await elementUpdated(element);
  expect(element.position).to.be.closeTo(30, 0.5);
  expect(base(element).style.getPropertyValue('--lr-split-panel-start-position')).to.match(/^30(?:\.0+)?%$/);
});

it('supports orientation="vertical" and the vertical compatibility alias', async () => {
  const canonical = (await fixture(html`
    <lr-split-panel
      orientation="vertical"
      position="25"
      style="inline-size: 400px; block-size: 200px"
    ></lr-split-panel>
  `)) as LyraSplitPanel;
  const alias = (await fixture(html`
    <lr-split-panel vertical position="25" style="inline-size: 400px; block-size: 200px"></lr-split-panel>
  `)) as LyraSplitPanel;

  expect(base(canonical).dataset.orientation).to.equal('vertical');
  expect(base(alias).dataset.orientation).to.equal('vertical');
  expect(canonical.positionInPixels).to.be.closeTo(50, 1);
  expect(alias.positionInPixels).to.be.closeTo(50, 1);
  expect(divider(alias).getAttribute('aria-orientation')).to.equal('horizontal');
});

it('preserves percentages without a primary panel and pixels with either primary panel on resize', async () => {
  const observer = installResizeObserverStub();
  try {
    const proportional = (await fixture(html`
      <lr-split-panel position="25" style="inline-size: 400px; block-size: 100px"></lr-split-panel>
    `)) as LyraSplitPanel;
    const fixedStart = (await fixture(html`
      <lr-split-panel primary="start" position-in-pixels="100" style="inline-size: 400px; block-size: 100px"></lr-split-panel>
    `)) as LyraSplitPanel;
    const fixedEnd = (await fixture(html`
      <lr-split-panel primary="end" position-in-pixels="100" style="inline-size: 400px; block-size: 100px"></lr-split-panel>
    `)) as LyraSplitPanel;

    proportional.style.inlineSize = '600px';
    fixedStart.style.inlineSize = '600px';
    fixedEnd.style.inlineSize = '600px';
    for (const callback of observer.callbacks) callback([], {} as ResizeObserver);
    await Promise.all([
      proportional.updateComplete,
      fixedStart.updateComplete,
      fixedEnd.updateComplete,
    ]);

    expect(proportional.position).to.be.closeTo(25, 0.5);
    expect(proportional.positionInPixels).to.be.closeTo(150, 1);
    expect(fixedStart.positionInPixels).to.be.closeTo(100, 1);
    expect(fixedStart.position).to.be.closeTo(100 / 6, 0.5);
    expect(fixedEnd.positionInPixels).to.be.closeTo(100, 1);
    expect(fixedEnd.position).to.be.closeTo(100 / 6, 0.5);
    expect(base(fixedEnd).style.getPropertyValue('--lr-split-panel-start-position')).to.match(/^83\.3/);
  } finally {
    observer.restore();
  }
});

it('clamps property, Home, and End changes to the public --min/--max constraints', async () => {
  const element = (await fixture(html`
    <lr-split-panel
      style="inline-size: 400px; block-size: 100px; --min: 100px; --max: 300px"
    ></lr-split-panel>
  `)) as LyraSplitPanel;

  element.positionInPixels = 20;
  await elementUpdated(element);
  expect(element.positionInPixels).to.be.closeTo(100, 1);

  keydown(element, 'End');
  await elementUpdated(element);
  expect(element.positionInPixels).to.be.closeTo(300, 1);

  keydown(element, 'Home');
  await elementUpdated(element);
  expect(element.positionInPixels).to.be.closeTo(100, 1);
});

it('resizes from the keyboard, mirrors horizontal arrows in RTL, and emits lr-reposition', async () => {
  const ltr = (await fixture(html`
    <lr-split-panel style="inline-size: 400px; block-size: 100px"></lr-split-panel>
  `)) as LyraSplitPanel;
  const rtl = (await fixture(html`
    <lr-split-panel dir="rtl" style="inline-size: 400px; block-size: 100px"></lr-split-panel>
  `)) as LyraSplitPanel;

  const eventPromise = oneEvent(ltr, 'lr-reposition');
  keydown(ltr, 'ArrowRight');
  const event = await eventPromise;
  await elementUpdated(ltr);
  expect(ltr.position).to.be.greaterThan(50);
  expect(event.bubbles).to.be.true;
  expect(event.composed).to.be.true;

  keydown(rtl, 'ArrowRight');
  await elementUpdated(rtl);
  expect(rtl.position).to.be.lessThan(50);
  keydown(rtl, 'ArrowLeft');
  await elementUpdated(rtl);
  expect(rtl.position).to.be.closeTo(50, 0.1);
});

it('uses vertical ArrowUp/ArrowDown independently of RTL', async () => {
  const element = (await fixture(html`
    <lr-split-panel
      dir="rtl"
      orientation="vertical"
      style="inline-size: 300px; block-size: 200px"
    ></lr-split-panel>
  `)) as LyraSplitPanel;

  keydown(element, 'ArrowDown');
  await elementUpdated(element);
  expect(element.position).to.be.greaterThan(50);
  keydown(element, 'ArrowUp');
  await elementUpdated(element);
  expect(element.position).to.be.closeTo(50, 0.1);
});

it('snaps pointer dragging to fixed, repeated, and functional snap points', async () => {
  const element = (await fixture(html`
    <lr-split-panel
      snap="25% repeat(100px)"
      snap-threshold="12"
      style="inline-size: 400px; block-size: 100px"
    ></lr-split-panel>
  `)) as LyraSplitPanel;

  pointer(divider(element), 'pointerdown', 7, 200);
  pointer(window, 'pointermove', 7, 294);
  await elementUpdated(element);
  expect(element.positionInPixels).to.be.closeTo(300, 1);
  pointer(window, 'pointerup', 7, 294);

  const snap: SplitPanelSnapFunction = ({ pos }) => (pos < 220 ? 180 : pos);
  element.snap = snap;
  element.positionInPixels = 200;
  await elementUpdated(element);
  pointer(divider(element), 'pointerdown', 8, 200);
  pointer(window, 'pointermove', 8, 210);
  await elementUpdated(element);
  expect(element.positionInPixels).to.be.closeTo(180, 1);
  pointer(window, 'pointerup', 8, 210);
});

it('ends a drag on pointercancel and clears transient drag state across reconnect', async () => {
  const element = (await fixture(html`
    <lr-split-panel style="inline-size: 400px; block-size: 100px"></lr-split-panel>
  `)) as LyraSplitPanel;

  pointer(divider(element), 'pointerdown', 9, 200);
  pointer(window, 'pointermove', 9, 240);
  await elementUpdated(element);
  pointer(window, 'pointercancel', 9, 240);
  const cancelledAt = element.position;
  pointer(window, 'pointermove', 9, 300);
  await elementUpdated(element);
  expect(element.position).to.equal(cancelledAt);

  pointer(divider(element), 'pointerdown', 10, 240);
  element.remove();
  pointer(window, 'pointermove', 10, 300);
  expect(element.position).to.equal(cancelledAt);
  document.body.append(element);
  await element.updateComplete;

  pointer(divider(element), 'pointerdown', 11, 240);
  pointer(window, 'pointermove', 11, 260);
  await elementUpdated(element);
  expect(element.position).to.be.greaterThan(cancelledAt);
  pointer(window, 'pointerup', 11, 260);
});

it('makes disabled split panels inert while retaining explicit separator state', async () => {
  const element = (await fixture(html`
    <lr-split-panel disabled style="inline-size: 400px; block-size: 100px"></lr-split-panel>
  `)) as LyraSplitPanel;
  const handle = divider(element);

  expect(handle.getAttribute('role')).to.equal('separator');
  expect(handle.getAttribute('aria-disabled')).to.equal('true');
  expect(handle.tabIndex).to.equal(-1);
  keydown(element, 'ArrowRight');
  pointer(handle, 'pointerdown', 12, 200);
  pointer(window, 'pointermove', 12, 260);
  await elementUpdated(element);
  expect(element.position).to.equal(50);
});

it('localizes the separator name, honors host aria-label, and exposes value state', async () => {
  const localized = (await fixture(html`
    <lr-split-panel
      lang="ar-EG"
      .strings=${{ resizeDivider: 'فاصل {a} و{b}' }}
      style="inline-size: 400px; block-size: 100px"
    ></lr-split-panel>
  `)) as LyraSplitPanel;
  const labelled = (await fixture(html`
    <lr-split-panel aria-label="Resize navigation" style="inline-size: 400px"></lr-split-panel>
  `)) as LyraSplitPanel;

  const number = new Intl.NumberFormat('ar-EG');
  expect(divider(localized).getAttribute('aria-label')).to.equal(
    `فاصل ${number.format(1)} و${number.format(2)}`,
  );
  expect(divider(labelled).getAttribute('aria-label')).to.equal('Resize navigation');
  expect(divider(labelled).getAttribute('aria-valuenow')).to.equal('50');
  expect(divider(labelled).getAttribute('aria-disabled')).to.equal('false');
});

it('guards non-finite numeric inputs before they reach layout or snap math', async () => {
  const element = (await fixture(html`
    <lr-split-panel style="inline-size: 400px; block-size: 100px"></lr-split-panel>
  `)) as LyraSplitPanel;

  element.position = Number.NaN;
  element.positionInPixels = Number.POSITIVE_INFINITY;
  element.snapThreshold = Number.NaN;
  await elementUpdated(element);
  expect(element.position).to.equal(50);
  expect(element.positionInPixels).to.be.closeTo(200, 1);
  expect(base(element).style.getPropertyValue('--lr-split-panel-start-position')).to.not.include('NaN');
});

it('is accessible with populated start, end, and custom divider slots', async () => {
  const element = await fixture(html`
    <lr-split-panel aria-label="Resize editor panes" style="inline-size: 400px; block-size: 200px">
      <section slot="start" aria-label="Source">Source</section>
      <span slot="divider" aria-hidden="true">⋮</span>
      <section slot="end" aria-label="Preview">Preview</section>
    </lr-split-panel>
  `);
  await expect(element).to.be.accessible();
});
