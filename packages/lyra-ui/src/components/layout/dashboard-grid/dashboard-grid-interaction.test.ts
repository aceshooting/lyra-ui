import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './dashboard-grid.js';
import type { LyraDashboardGrid } from './dashboard-grid.js';
import type { LyraDashboardCell } from './layout.js';

const twoCells = (): LyraDashboardCell[] => [
  { cellId: 'a', x: 0, y: 0, w: 1, h: 1 },
  { cellId: 'b', x: 1, y: 0, w: 1, h: 1 },
];

async function grid(attrs = ''): Promise<LyraDashboardGrid> {
  const host = await fixture<HTMLDivElement>(
    html`<div .innerHTML=${`<lr-dashboard-grid ${attrs}></lr-dashboard-grid>`}></div>`
  );
  const el = host.querySelector('lr-dashboard-grid') as LyraDashboardGrid;
  el.layout = twoCells();
  await el.updateComplete;
  return el;
}

function cells(el: LyraDashboardGrid): HTMLElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]'));
}

describe('lr-dashboard-grid interactions', () => {
  for (const init of [
    { key: 'ArrowRight', shiftKey: true },
    { key: 'End', shiftKey: true },
    { key: 'ArrowRight', keyCode: 229 },
  ] as KeyboardEventInit[]) {
    it(`leaves ${JSON.stringify(init)} to the browser`, async () => {
      const el = await grid();
      const [a] = cells(el) as [HTMLElement];
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      a.dispatchEvent(event);
      await el.updateComplete;
      expect(event.defaultPrevented).to.equal(false);
      expect(a.getAttribute('tabindex')).to.equal('0');
    });
  }

  it('names a cell from its id when the label is whitespace', async () => {
    const el = await grid();
    el.layout = [{ cellId: 'sales', x: 0, y: 0, w: 1, h: 1, label: '   ' }];
    await el.updateComplete;
    expect(cells(el)[0]!.getAttribute('aria-label')).to.equal('sales');
  });

  it('treats an empty columns attribute as the default', async () => {
    const el = await grid('columns=""');
    expect(el.columns).to.equal(12);
  });

  it('observes direct children only, yet still adopts a child whose cell-id changes', async () => {
    const original = MutationObserver.prototype.observe;
    let subtreeObserved = false;
    MutationObserver.prototype.observe = function (
      this: MutationObserver,
      target: Node,
      options?: MutationObserverInit
    ): void {
      if (options?.subtree && target.nodeName === 'LR-DASHBOARD-GRID') subtreeObserved = true;
      return original.call(this, target, options);
    };
    try {
      const el = await grid();
      const child = document.createElement('div');
      child.setAttribute('cell-id', 'b');
      child.textContent = 'Authored';
      el.append(child);
      await waitUntil(() => child.getAttribute('slot') === 'cell-b', 'the child is adopted');
      child.setAttribute('cell-id', 'a');
      await waitUntil(() => child.getAttribute('slot') === 'cell-a', 'the renamed child is adopted');
      expect(subtreeObserved).to.equal(false);
    } finally {
      MutationObserver.prototype.observe = original;
    }
  });

  it('keeps the resize handle visible at rest', async () => {
    const el = await grid('cells-resizable');
    const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
    const grip = getComputedStyle(handle, '::before');
    expect(grip.borderBlockEndStyle).to.equal('solid');
    expect(parseFloat(grip.borderBlockEndWidth) > 0).to.equal(true);
  });

  it('outlines a hovered cell only when it can be dragged', async () => {
    const plain = await grid();
    try {
      const [cell] = cells(plain) as [HTMLElement];
      await hoverUntilMatched(cell, 'The plain cell receives the pointer');
      expect(getComputedStyle(cell).outlineStyle).to.equal('none');
      const draggable = await grid('cells-draggable');
      const [dragCell] = cells(draggable) as [HTMLElement];
      await hoverUntilMatched(dragCell, 'The draggable cell receives the pointer');
      await waitUntil(() => getComputedStyle(dragCell).outlineStyle === 'solid', 'the hover outline paints');
      expect(getComputedStyle(dragCell).outlineStyle).to.equal('solid');
      draggable.style.setProperty('--lr-color-border-strong', 'rgb(1, 2, 3)');
      expect(getComputedStyle(dragCell).outlineColor).to.equal('rgb(1, 2, 3)');
      draggable.style.setProperty('--lr-dashboard-grid-cell-hover-outline-color', 'rgb(4, 5, 6)');
      expect(getComputedStyle(dragCell).outlineColor).to.equal('rgb(4, 5, 6)');
    } finally {
      await resetMouse();
    }
  });
});

it('drags by one rendered column inside a scaled container', async () => {
  const el = await grid('cells-draggable columns="4" gap="0" style="inline-size:1600px;transform:scale(2)"');
  el.layout = [{ cellId: 'a', x: 0, y: 0, w: 1, h: 1 }];
  await el.updateComplete;
  const cell = cells(el)[0]!;
  let movedTo: number | undefined;
  el.addEventListener('lr-cell-move', (event) => { movedTo = event.detail.position.x; });
  const position = { bubbles: true, composed: true, pointerId: 31, isPrimary: true, button: 0 };
  cell.dispatchEvent(new PointerEvent('pointerdown', { ...position, clientX: 0 }));
  expect(getComputedStyle(cell.parentElement!).display).to.equal('grid');
  const clientX = cell.getBoundingClientRect().width;
  window.dispatchEvent(new PointerEvent('pointermove', { ...position, clientX }));
  window.dispatchEvent(new PointerEvent('pointerup', { ...position, clientX }));
  await el.updateComplete;
  expect(movedTo).to.equal(1);
});

it('accepts a programmatic accessibleLabel on the base', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-dashboard-grid']>(html`<lr-dashboard-grid ></lr-dashboard-grid>`);
  el.accessibleLabel = 'Quarterly results';
  await el.updateComplete;
  const owner = el.shadowRoot!.querySelector('[part~="base"]')!;
  expect(owner.getAttribute('aria-label')).to.equal('Quarterly results');
});

it('keeps the keyboard ring on a hovered draggable cell', async () => {
  const el = await grid('cells-draggable');
  const cell = cells(el)[0]!;
  el.style.setProperty('--lr-focus-ring-color', 'rgb(1, 2, 3)');
  el.style.setProperty('--lr-dashboard-grid-cell-hover-outline-color', 'rgb(4, 5, 6)');
  try {
    await focusByKeyboard(cell);
    await hoverUntilMatched(cell, 'the focused cell receives hover');
    expect(getComputedStyle(cell).outlineColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});

it('paints the resize grip hover background from its public token', async () => {
  const el = await grid('cells-resizable');
  const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
  el.style.setProperty('--lr-dashboard-grid-resize-handle-hover-bg', 'rgb(1, 2, 3)');
  try {
    await hoverUntilMatched(handle, 'the resize handle receives hover');
    await waitUntil(() => getComputedStyle(handle).backgroundColor === 'rgb(1, 2, 3)', 'the handle hover color settles');
  } finally {
    await resetMouse();
  }
});
