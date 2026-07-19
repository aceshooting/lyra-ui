import { fixture, expect, html } from '@open-wc/testing';
import './dashboard-grid.js';
import type { LyraDashboardGrid } from './dashboard-grid.js';
import type { DashboardCell } from './layout.js';

function twoCells(): DashboardCell[] {
  return [
    { id: 'a', x: 0, y: 0, w: 2, h: 1, label: 'Alpha' },
    { id: 'b', x: 2, y: 0, w: 2, h: 1, label: 'Beta' },
  ];
}

it('defaults to an empty layout, 12 columns, 80px rows, 8px gap, and collision="reject"', async () => {
  const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
  expect(el.layout).to.deep.equal([]);
  expect(el.columns).to.equal(12);
  expect(el.rowHeight).to.equal(80);
  expect(el.gap).to.equal(8);
  expect(el.collision).to.equal('reject');
  expect(el.cellsDraggable).to.be.false;
  expect(el.cellsResizable).to.be.false;
  expect(el.locked).to.be.false;
});

it('renders lr-empty with the noData message when layout is empty', async () => {
  const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect(empty).to.exist;
  expect(empty!.tagName.toLowerCase()).to.equal('lr-empty');
  expect(empty!.getAttribute('heading')).to.equal('No data');
});

it('is accessible in the empty state', async () => {
  const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
  await expect(el).to.be.accessible();
});

describe('grid placement', () => {
  it('places a cell via grid-column/grid-row derived from x/y/w/h', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 1, y: 2, w: 3, h: 4 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    expect(cellEl.style.gridColumn).to.equal('2 / span 3');
    expect(cellEl.style.gridRow).to.equal('3 / span 4');
  });

  it('reflects columns/row-height/gap onto the base as custom properties', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid columns="6" row-height="40" gap="4"></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lr-dashboard-grid-columns')).to.equal('6');
    expect(base.style.getPropertyValue('--lr-dashboard-grid-row-height')).to.equal('40px');
    expect(base.style.getPropertyValue('--lr-dashboard-grid-gap')).to.equal('4px');
  });

  it('renders cells in row-major order regardless of layout array order', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [
      { id: 'second', x: 0, y: 1, w: 1, h: 1 },
      { id: 'first', x: 0, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    const ids = Array.from(el.shadowRoot!.querySelectorAll('[part="cell"]')).map((c) => c.getAttribute('data-cell-id'));
    expect(ids).to.deep.equal(['first', 'second']);
  });
});

describe('default cell composition', () => {
  it('adopts a default lr-widget/lr-widget-renderer pair for a layout entry with no matching child', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [
      { id: 'a', x: 0, y: 0, w: 2, h: 1, label: 'Users', widget: { type: 'stat', props: { label: 'Users', value: '12' } } },
    ];
    await el.updateComplete;
    const widget = el.querySelector('[cell-id="a"]') as HTMLElement;
    expect(widget).to.exist;
    expect(widget.tagName.toLowerCase()).to.equal('lr-widget');
    expect(widget.getAttribute('slot')).to.equal('cell-a');
    expect((widget as unknown as { label: string }).label).to.equal('Users');
    const renderer = widget.querySelector('lr-widget-renderer') as unknown as { tree: unknown } & Element;
    expect(renderer).to.exist;
    await (renderer as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(renderer.shadowRoot!.querySelector('lr-stat')).to.exist;
  });

  it('updates an already-adopted default cell in place when layout changes', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1, label: 'First' }];
    await el.updateComplete;
    const widget = el.querySelector('[cell-id="a"]') as HTMLElement;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Renamed' }];
    await el.updateComplete;
    expect(el.querySelectorAll('[cell-id="a"]').length).to.equal(1);
    expect((el.querySelector('[cell-id="a"]') as unknown as { label: string }).label).to.equal('Renamed');
    expect(el.querySelector('[cell-id="a"]')).to.equal(widget);
  });

  it('routes a user-authored child into its wrapper by cell-id instead of creating a default cell', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid><div cell-id="a">Custom</div></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const custom = el.querySelector('[cell-id="a"]') as HTMLElement;
    expect(custom.tagName.toLowerCase()).to.equal('div');
    expect(custom.getAttribute('slot')).to.equal('cell-a');
    expect(el.querySelectorAll('[cell-id="a"]').length).to.equal(1);
  });

  it('warns and leaves a stale user-authored child unslotted when its cell-id matches no layout entry', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid><div cell-id="ghost">Gone</div></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    const warn = console.warn;
    let warned = false;
    console.warn = (...args: unknown[]) => {
      warned = true;
      void args;
    };
    el.layout = twoCells();
    await el.updateComplete;
    console.warn = warn;
    expect(warned).to.be.true;
    expect(el.querySelector('[cell-id="ghost"]')!.getAttribute('slot')).to.be.null;
  });

  it('removes a default cell once its layout entry disappears', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    expect(el.querySelector('[cell-id="a"]')).to.exist;
    el.layout = [];
    await el.updateComplete;
    expect(el.querySelector('[cell-id="a"]')).to.not.exist;
  });
});

describe('roving keyboard navigation', () => {
  it('moves the roving tabindex forward/backward through row-major order with arrow keys', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const [a, b] = Array.from(el.shadowRoot!.querySelectorAll('[part="cell"]')) as HTMLElement[];
    expect(a.getAttribute('tabindex')).to.equal('0');
    expect(b.getAttribute('tabindex')).to.equal('-1');
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(a.getAttribute('tabindex')).to.equal('-1');
    expect(b.getAttribute('tabindex')).to.equal('0');
    expect(el.shadowRoot!.activeElement).to.equal(b);
  });

  it('Home/End jump to the first/last cell', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [...twoCells(), { id: 'c', x: 0, y: 1, w: 1, h: 1 }];
    await el.updateComplete;
    const cells = Array.from(el.shadowRoot!.querySelectorAll('[part="cell"]')) as HTMLElement[];
    cells[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(cells[2].getAttribute('tabindex')).to.equal('0');
  });

  it('flips the forward-key direction under an RTL ancestor', async () => {
    const el = (await fixture(html`<div dir="rtl"><lr-dashboard-grid></lr-dashboard-grid></div>`)).querySelector(
      'lr-dashboard-grid',
    ) as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const [a, b] = Array.from(el.shadowRoot!.querySelectorAll('[part="cell"]')) as HTMLElement[];
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(b.getAttribute('tabindex')).to.equal('0');
  });
});

describe('keyboard move (Ctrl/Cmd+Arrow)', () => {
  it('moves the focused cell by one grid unit and emits lr-cell-move + lr-layout-change', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 2, y: 2, w: 1, h: 1 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let moveDetail: unknown;
    let layoutDetail: { layout: DashboardCell[] } | undefined;
    el.addEventListener('lr-cell-move', (e) => (moveDetail = (e as CustomEvent).detail));
    el.addEventListener('lr-layout-change', (e) => (layoutDetail = (e as CustomEvent).detail));
    cellEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(moveDetail).to.deep.equal({ id: 'a', position: { x: 3, y: 2 }, previous: { x: 2, y: 2 } });
    expect(layoutDetail!.layout.find((c) => c.id === 'a')).to.deep.include({ x: 3, y: 2 });
  });

  it('flips ArrowRight to decrease x under RTL, matching the roving-nav direction convention', async () => {
    const host = (await fixture(
      html`<div dir="rtl"><lr-dashboard-grid cells-draggable></lr-dashboard-grid></div>`,
    )) as HTMLElement;
    const el = host.querySelector('lr-dashboard-grid') as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 2, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let detail: { position: { x: number; y: number } } | undefined;
    el.addEventListener('lr-cell-move', (e) => (detail = (e as CustomEvent).detail));
    cellEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(detail!.position.x).to.equal(1);
  });

  it('does nothing when cells-draggable is unset', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 2, y: 2, w: 1, h: 1 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let fired = false;
    el.addEventListener('lr-cell-move', () => (fired = true));
    cellEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(fired).to.be.false;
  });

  it('does nothing for a locked cell', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 2, y: 2, w: 1, h: 1, locked: true }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let fired = false;
    el.addEventListener('lr-cell-move', () => (fired = true));
    cellEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(fired).to.be.false;
  });
});

describe('keyboard resize (Ctrl/Cmd+Shift+Arrow)', () => {
  it('grows the focused cell by one column and emits lr-cell-resize + lr-layout-change', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 2, h: 2 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let resizeDetail: unknown;
    let layoutDetail: { layout: DashboardCell[] } | undefined;
    el.addEventListener('lr-cell-resize', (e) => (resizeDetail = (e as CustomEvent).detail));
    el.addEventListener('lr-layout-change', (e) => (layoutDetail = (e as CustomEvent).detail));
    cellEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(resizeDetail).to.deep.equal({ id: 'a', size: { w: 3, h: 2 }, previous: { w: 2, h: 2 } });
    expect(layoutDetail!.layout.find((c) => c.id === 'a')).to.deep.include({ w: 3, h: 2 });
  });

  it('shrinks but never below 1 column/row', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let resizeDetail: { size: { w: number; h: number } } | undefined;
    el.addEventListener('lr-cell-resize', (e) => (resizeDetail = (e as CustomEvent).detail));
    cellEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }),
    );
    // Requested w=0 clamps to minW=1 -- an unchanged size never commits (no-op, not a spurious event).
    expect(resizeDetail).to.be.undefined;
  });

  it('does nothing when cells-resizable is unset', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 2, h: 2 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let fired = false;
    el.addEventListener('lr-cell-resize', () => (fired = true));
    cellEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(fired).to.be.false;
  });
});

describe('collision policy', () => {
  it('reject: blocks a move onto an occupied cell, fires lr-collision, and leaves layout untouched', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-draggable collision="reject"></lr-dashboard-grid>`)) as LyraDashboardGrid;
    const layout: DashboardCell[] = [
      { id: 'a', x: 0, y: 0, w: 1, h: 1 },
      { id: 'b', x: 1, y: 0, w: 1, h: 1 },
    ];
    el.layout = layout;
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector('[data-cell-id="a"]') as HTMLElement;
    let moveFired = false;
    let collisionDetail: { id: string; collidedWith: string[]; accepted: boolean } | undefined;
    el.addEventListener('lr-cell-move', () => (moveFired = true));
    el.addEventListener('lr-collision', (e) => (collisionDetail = (e as CustomEvent).detail));
    cellA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(moveFired).to.be.false;
    expect(collisionDetail).to.deep.equal({ id: 'a', collidedWith: ['b'], policy: 'reject', accepted: false });
    expect(el.layout).to.equal(layout);
  });

  it('push: displaces the occupying cell and reports the layout-change cascade', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-draggable collision="push"></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [
      { id: 'a', x: 0, y: 0, w: 1, h: 1 },
      { id: 'b', x: 1, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector('[data-cell-id="a"]') as HTMLElement;
    let layoutDetail: { layout: DashboardCell[] } | undefined;
    el.addEventListener('lr-layout-change', (e) => (layoutDetail = (e as CustomEvent).detail));
    cellA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
    const a = layoutDetail!.layout.find((c) => c.id === 'a')!;
    const b = layoutDetail!.layout.find((c) => c.id === 'b')!;
    expect(a).to.deep.include({ x: 1, y: 0 });
    expect(b).to.deep.include({ x: 1, y: 1 });
  });

  it('overlap: allows a colliding move while still reporting lr-collision', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable collision="overlap"></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    el.layout = [
      { id: 'a', x: 0, y: 0, w: 1, h: 1 },
      { id: 'b', x: 1, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector('[data-cell-id="a"]') as HTMLElement;
    let moveDetail: { position: { x: number; y: number } } | undefined;
    let collisionDetail: { accepted: boolean } | undefined;
    el.addEventListener('lr-cell-move', (e) => (moveDetail = (e as CustomEvent).detail));
    el.addEventListener('lr-collision', (e) => (collisionDetail = (e as CustomEvent).detail));
    cellA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(moveDetail!.position).to.deep.equal({ x: 1, y: 0 });
    expect(collisionDetail!.accepted).to.be.true;
  });
});

describe('pointer drag', () => {
  it('drags a cell vertically (grid-snapped) and emits lr-cell-move on release', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable row-height="50" gap="8"></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 2, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    // rowPitch = rowHeight(50) + gap(8) = 58px; two full rows down.
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 116 }));
    let detail: { id: string; position: { x: number; y: number }; previous: { x: number; y: number } } | undefined;
    el.addEventListener('lr-cell-move', (e) => (detail = (e as CustomEvent).detail));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 116 }));
    expect(detail).to.deep.equal({ id: 'a', position: { x: 0, y: 4 }, previous: { x: 0, y: 2 } });
  });

  it('clamps an extreme rightward drag to the last valid column', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-draggable columns="4"></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 2, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 999999, clientY: 0 }));
    let detail: { position: { x: number; y: number } } | undefined;
    el.addEventListener('lr-cell-move', (e) => (detail = (e as CustomEvent).detail));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 999999, clientY: 0 }));
    // w=2 on a 4-column grid -- the furthest valid leading column is 2.
    expect(detail!.position.x).to.equal(2);
  });

  it('rejects the drop (and fires lr-collision, not lr-cell-move) when it would land on another cell', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable collision="reject" row-height="50" gap="8"></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    const layout: DashboardCell[] = [
      { id: 'a', x: 0, y: 0, w: 1, h: 1 },
      { id: 'b', x: 0, y: 2, w: 1, h: 1 },
    ];
    el.layout = layout;
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[data-cell-id="a"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 116 }));
    let moveFired = false;
    let collisionDetail: { id: string; collidedWith: string[]; policy: string; accepted: boolean } | undefined;
    el.addEventListener('lr-cell-move', () => (moveFired = true));
    el.addEventListener('lr-collision', (e) => (collisionDetail = (e as CustomEvent).detail));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 116 }));
    expect(moveFired).to.be.false;
    expect(collisionDetail).to.deep.equal({ id: 'a', collidedWith: ['b'], policy: 'reject', accepted: false });
    expect(el.layout).to.equal(layout);
  });

  it('does not drag when cells-draggable is unset', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    let fired = false;
    el.addEventListener('lr-cell-move', () => (fired = true));
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 200 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 200 }));
    expect(fired).to.be.false;
  });

  it('does not render a resize handle for a locked cell even when cells-resizable is set', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1, locked: true }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resize-handle"]')).to.not.exist;
  });
});

describe('pointer resize', () => {
  it('resizes a cell vertically (grid-snapped) and emits lr-cell-resize on release', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-resizable row-height="50" gap="8"></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
    handle.setPointerCapture = () => {};
    handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    // rowPitch = 50 + 8 = 58px; two full rows taller.
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 116 }));
    let detail: { id: string; size: { w: number; h: number }; previous: { w: number; h: number } } | undefined;
    el.addEventListener('lr-cell-resize', (e) => (detail = (e as CustomEvent).detail));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 116 }));
    expect(detail).to.deep.equal({ id: 'a', size: { w: 1, h: 3 }, previous: { w: 1, h: 1 } });
  });
});

describe('narrow allocation', () => {
  it('switches to a single stacked column inside a 320px container', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '320px';
    const el = (await fixture(
      html`<lr-dashboard-grid>
        <div cell-id="a">A</div>
        <div cell-id="b">B</div>
      </lr-dashboard-grid>`,
      { parentNode: container },
    )) as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).display).to.equal('flex');
    expect((el as unknown as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
  });
});

describe('accessibility', () => {
  it('is accessible with populated, draggable, and resizable cells', async () => {
    const el = (await fixture(html`<lr-dashboard-grid cells-draggable cells-resizable></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [
      { id: 'a', x: 0, y: 0, w: 2, h: 1, label: 'Users', widget: { type: 'stat', props: { label: 'Users', value: '12' } } },
      { id: 'b', x: 2, y: 0, w: 2, h: 1, label: 'Errors', widget: { type: 'stat', props: { label: 'Errors', value: '0' } } },
    ];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('falls back to the localized default aria-label, overridable via a host aria-label', async () => {
    const el = (await fixture(html`<lr-dashboard-grid></lr-dashboard-grid>`)) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    // 'dashboardGridLabel' has no `DEFAULT_STRINGS` entry yet (src/internal/localization.ts is a
    // shared file outside this component's own directory -- see the component doc/PR notes for
    // why), so `resolveLyraString()`'s final fallback is the raw key itself until that shared
    // file gains a real English string for it. This asserts today's actual (pending) behavior,
    // not the eventual one -- update this alongside adding the DEFAULT_STRINGS entry.
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('dashboardGridLabel');
    el.accessibleLabel = 'Ops overview';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Ops overview');
  });
});

describe('localized strings', () => {
  it('routes the grid label through this.localize with a .strings override', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid .strings=${{ dashboardGridLabel: 'Tableau de bord' }}></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    el.layout = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Tableau de bord');
  });

  it('routes the collision-rejected announcement through this.localize with a .strings override', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        collision="reject"
        .strings=${{ dashboardCellCollisionRejected: '{label} bloqué' }}
      ></lr-dashboard-grid>`,
    )) as LyraDashboardGrid;
    el.layout = [
      { id: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Alpha' },
      { id: 'b', x: 1, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector('[data-cell-id="a"]') as HTMLElement;
    cellA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
    // The live-region text itself flushes on a throttled delay (see `Announcer`) -- rather than
    // wait out that timer, this asserts against the announcer's own synchronously-set pending
    // text, which `announce()` populates immediately regardless of when the throttle flushes it
    // into `liveText`/the DOM. Mirrors `lr-flow-canvas`'s choice to not test throttled live-region
    // text directly; this goes one step further to still prove the call site's key/interpolation.
    const announcer = (el as unknown as { announcer: { pendingText?: string } }).announcer;
    expect(announcer.pendingText).to.equal('Alpha bloqué');
  });
});
