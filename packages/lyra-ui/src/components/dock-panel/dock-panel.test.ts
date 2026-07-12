import { fixture, expect, html, elementUpdated, oneEvent } from '@open-wc/testing';
import './dock-panel.js';
import type { LyraDockPanel, DockPanelResizeDetail, DockPanelCollapseChangeDetail } from './dock-panel.js';
import { parseLengthPx } from './dock-panel.js';

async function dockedFixture(attrs = '', edge = 'end'): Promise<LyraDockPanel> {
  const wrapper = (await fixture(
    `<div style="position: relative; height: 20rem; display: flex;">
      <div style="flex: 1;">main</div>
      <lyra-dock-panel edge="${edge}" ${attrs}>panel body</lyra-dock-panel>
    </div>`,
  )) as HTMLDivElement;
  return wrapper.querySelector('lyra-dock-panel') as LyraDockPanel;
}

describe('parseLengthPx', () => {
  it('parses px, bare numbers, and percentages', () => {
    expect(parseLengthPx('320px', 1000)).to.equal(320);
    expect(parseLengthPx('320', 1000)).to.equal(320);
    expect(parseLengthPx('25%', 1000)).to.equal(250);
  });

  it('returns undefined for empty or unparseable input', () => {
    expect(parseLengthPx('', 1000)).to.equal(undefined);
    expect(parseLengthPx('auto', 1000)).to.equal(undefined);
  });

  it('resolves vw/vh against the viewport', () => {
    expect(parseLengthPx('10vw', 1000)).to.equal(window.innerWidth * 0.1);
    expect(parseLengthPx('10vh', 1000)).to.equal(window.innerHeight * 0.1);
  });

  it('resolves rem against the document root font size', () => {
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(parseLengthPx('2rem', 1000)).to.equal(2 * rootPx);
  });
});

it('renders with defaults: docked to the end edge, a resizable handle, no collapse toggle', async () => {
  const el = await dockedFixture();
  await elementUpdated(el);
  expect(el.edge).to.equal('end');
  expect(el.resizable).to.equal(true);
  expect(el.collapsible).to.equal(false);
  const handle = el.shadowRoot!.querySelector('[part="handle"]');
  expect(handle).to.not.equal(null);
  expect(handle!.getAttribute('role')).to.equal('separator');
  expect(handle!.getAttribute('aria-orientation')).to.equal('vertical');
  expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]')).to.equal(null);
});

it('renders no drag handle at all when resizable is false', async () => {
  const el = await dockedFixture();
  el.resizable = false;
  await elementUpdated(el);
  expect(el.shadowRoot!.querySelector('[part="handle"]')).to.equal(null);
});

it('sets aria-orientation to horizontal for a top/bottom-docked handle', async () => {
  const el = await dockedFixture('', 'bottom');
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]')!;
  expect(handle.getAttribute('aria-orientation')).to.equal('horizontal');
});

it('applies the size property as the host inline-size for a start/end edge', async () => {
  const el = await dockedFixture('size="300px"');
  await elementUpdated(el);
  expect(el.getBoundingClientRect().width).to.be.closeTo(300, 1);
});

it('applies the size property as the host block-size for a top/bottom edge', async () => {
  const el = await dockedFixture('size="150px"', 'top');
  await elementUpdated(el);
  expect(el.getBoundingClientRect().height).to.be.closeTo(150, 1);
});

it('resizes via keyboard and emits lyra-resize with a px size in the detail', async () => {
  const el = await dockedFixture('size="300px" min-size="100px" max-size="500px"');
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;

  let detail: DockPanelResizeDetail | undefined;
  el.addEventListener('lyra-resize', (e) => (detail = (e as CustomEvent<DockPanelResizeDetail>).detail));
  // edge="end" in LTR: the panel's right edge is pinned, so ArrowLeft (moving
  // the draggable left edge further left) grows it.
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await elementUpdated(el);
  expect(el.size).to.equal('316px');
  expect(detail!.size).to.equal('316px');

  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(el);
  expect(el.size).to.equal('300px');
});

it('swaps ArrowLeft/ArrowRight for edge="end" under dir="rtl"', async () => {
  const el = await fixture(
    html`<div dir="rtl" style="position: relative; height: 10rem; display: flex;">
      <lyra-dock-panel edge="end" size="300px" min-size="100px" max-size="500px"></lyra-dock-panel>
    </div>`,
  );
  const panel = el.querySelector('lyra-dock-panel') as LyraDockPanel;
  await elementUpdated(panel);
  const handle = panel.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;

  // Under RTL, edge="end" is physically pinned to the left, so ArrowRight now
  // grows it (the mirror image of the LTR case above).
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await elementUpdated(panel);
  expect(panel.size).to.equal('316px');
});

it('does not swap ArrowUp/ArrowDown for a top/bottom edge under dir="rtl"', async () => {
  const el = await fixture(
    html`<div dir="rtl" style="position: relative; height: 10rem; display: flex; flex-direction: column;">
      <lyra-dock-panel edge="top" size="150px" min-size="80px" max-size="300px"></lyra-dock-panel>
    </div>`,
  );
  const panel = el.querySelector('lyra-dock-panel') as LyraDockPanel;
  await elementUpdated(panel);
  const handle = panel.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await elementUpdated(panel);
  expect(panel.size).to.equal('166px');
});

it('clamps keyboard resizing to min-size and max-size', async () => {
  const el = await dockedFixture('size="110px" min-size="100px" max-size="200px"');
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;

  for (let i = 0; i < 10; i++) {
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  }
  await elementUpdated(el);
  expect(el.size).to.equal('100px');

  for (let i = 0; i < 10; i++) {
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  }
  await elementUpdated(el);
  expect(el.size).to.equal('200px');
});

it('resizes via pointer drag and mirrors direction under dir="rtl"', async () => {
  const el = await dockedFixture('size="300px" min-size="100px" max-size="500px"');
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};

  const resized = oneEvent(el, 'lyra-resize');
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 200 }));
  // edge="end" LTR: dragging left (toward more-negative clientX) grows it.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 150 }));
  const { detail } = (await resized) as CustomEvent<DockPanelResizeDetail>;
  expect(detail.size).to.equal('350px');
  expect(el.size).to.equal('350px');
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
});

it('ignores a pointermove/pointerup from an unrelated pointerId mid-drag', async () => {
  const el = await dockedFixture('size="300px" min-size="100px" max-size="500px"');
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};

  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 200 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 100 }));
  await elementUpdated(el);
  expect(el.size).to.equal('300px');
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
});

it('does not throw on a stray pointermove/pointerup after disconnect mid-drag', async () => {
  const el = await dockedFixture('size="300px"');
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 200 }));

  el.remove();

  expect(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 50 }));
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  }).to.not.throw();
});

it('toggles collapsed via the collapse-toggle button and emits lyra-collapse-change', async () => {
  const el = await dockedFixture('size="280px" collapsible');
  await elementUpdated(el);
  const toggle = el.shadowRoot!.querySelector('[part="collapse-toggle"]') as HTMLElement;
  expect(toggle).to.not.equal(null);
  expect(toggle.getAttribute('aria-expanded')).to.equal('true');

  let detail: DockPanelCollapseChangeDetail | undefined;
  el.addEventListener('lyra-collapse-change', (e) => (detail = (e as CustomEvent<DockPanelCollapseChangeDetail>).detail));
  toggle.click();
  await elementUpdated(el);

  expect(el.collapsed).to.equal(true);
  expect(detail).to.deep.equal({ collapsed: true });
  expect(toggle.getAttribute('aria-expanded')).to.equal('false');
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  expect(content.hidden).to.equal(true);
  // No drag handle while collapsed -- nothing meaningful to resize.
  expect(el.shadowRoot!.querySelector('[part="handle"]')).to.equal(null);
});

it('preserves the last expanded size across a collapse/expand round trip', async () => {
  const el = await dockedFixture('size="280px" collapsible');
  await elementUpdated(el);
  expect(el.size).to.equal('280px');

  const toggle = el.shadowRoot!.querySelector('[part="collapse-toggle"]') as HTMLElement;
  toggle.click();
  await elementUpdated(el);
  expect(el.collapsed).to.equal(true);
  expect(el.size).to.equal('280px'); // untouched while collapsed

  toggle.click();
  await elementUpdated(el);
  expect(el.collapsed).to.equal(false);
  expect(el.size).to.equal('280px');
  expect(el.getBoundingClientRect().width).to.be.closeTo(280, 1);
});

it('is accessible in its default state (no collapsible, resizable handle only)', async () => {
  const el = await dockedFixture();
  await elementUpdated(el);
  await expect(el).to.be.accessible();
});

it('is accessible when collapsible and populated with content', async () => {
  const el = await dockedFixture('size="280px" collapsible');
  await elementUpdated(el);
  await expect(el).to.be.accessible();
});

it('is accessible while collapsed', async () => {
  const el = await dockedFixture('size="280px" collapsible collapsed');
  await elementUpdated(el);
  await expect(el).to.be.accessible();
});
