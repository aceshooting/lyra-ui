import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LitElement, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import './dashboard-grid.js';
import type { LyraDashboardGrid } from './dashboard-grid.js';
import type { LyraDashboardCell } from './layout.js';

describe('rendered grid pitch', () => {
  for (const direction of ['ltr', 'rtl'] as const) {
    for (const geometry of ['properties', 'css overrides', 'css gaps', 'css percentages', 'css normal gaps'] as const) {
      for (const action of ['move', 'resize'] as const) {
        const columnSteps = geometry === 'css normal gaps' ? 5 : 4;
        it(`proposes ${columnSteps} columns and two rows for ${direction} ${action} with ${geometry}`, async () => {
          const initial: LyraDashboardCell[] = [{ cellId: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Alpha' }];
          if (geometry === 'css percentages') initial.push({ cellId: 'reference', x: 1, y: 4, w: 1, h: 1, label: 'Reference' });
          const overrides = geometry === 'css overrides'
            ? '--lr-dashboard-grid-columns: 8; --lr-dashboard-grid-row-height: 40px; --lr-dashboard-grid-gap: 12px;'
            : geometry === 'css gaps' ? '--lr-dashboard-grid-gap: 30px;'
            : geometry === 'css percentages' ? '--lr-dashboard-grid-columns: 8; --lr-dashboard-grid-gap: 10%;'
            : geometry === 'css normal gaps' ? '--lr-dashboard-grid-gap: normal;' : '';
          const el = await fixture<LyraDashboardGrid>(html`
            <lr-dashboard-grid dir=${direction} cells-draggable .cellsResizable=${action === 'resize'}
              .layout=${initial}
              style=${`inline-size: 720px; min-block-size: 300px; ${overrides}`}>
              <div cell-id="a">Alpha</div>
            </lr-dashboard-grid>
          `);
          await settlePointer();
          const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
          const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
          const target = action === 'resize' ? cell.querySelector<HTMLElement>('[part="resize-handle"]')! : cell;
          const style = getComputedStyle(base);
          expect(style.display).to.equal('grid');
          const cellRect = cell.getBoundingClientRect();
          const referenceRect = base.querySelectorAll('[part="cell"]')[1]?.getBoundingClientRect();
          const colPitch = referenceRect ? Math.abs(referenceRect.left - cellRect.left)
            : cellRect.width + (style.columnGap === 'normal' ? 0 : Number.parseFloat(style.columnGap));
          const rowPitch = referenceRect ? (referenceRect.top - cellRect.top) / 4
            : cellRect.height + (style.rowGap === 'normal' ? 0 : Number.parseFloat(style.rowGap));
          const baseline = el.layout;
          const proposals: (readonly LyraDashboardCell[])[] = [];
          let actions = 0;
          el.addEventListener('lr-layout-change', (event) => proposals.push((event as CustomEvent<{ layout: LyraDashboardCell[] }>).detail.layout));
          el.addEventListener(action === 'move' ? 'lr-cell-move' : 'lr-cell-resize', () => actions++);
          try {
            const point = (rect: DOMRect): [number, number] => [rect.left + rect.width / 2, action === 'move' ? rect.top + 8 : rect.top + rect.height / 2];
            await hoverUntilMatched(target, 'The cell interaction target receives the pointer', point);
            const [startX, startY] = point(target.getBoundingClientRect());
            await sendMouse({ type: 'down' });
            await waitUntil(() => cell.hasAttribute(action === 'move' ? 'data-dragging' : 'data-resizing'), 'The cell gesture starts');
            await sendMouse({ type: 'move', position: [Math.round(startX + (direction === 'rtl' ? -1 : 1) * columnSteps * colPitch), Math.round(startY + 2 * rowPitch)] });
            await sendMouse({ type: 'up' });
            await waitUntil(() => proposals.length === 1, 'The gesture proposes one controlled layout');
            expect(actions).to.equal(1);
            expect(proposals[0]!.filter(({ cellId }) => cellId === 'a').map(({ x, y, w, h }) => ({ x, y, w, h }))).to.deep.equal([
              action === 'move' ? { x: columnSteps, y: 2, w: 1, h: 1 } : { x: 0, y: 0, w: columnSteps + 1, h: 3 },
            ]);
            expect(el.layout === baseline).to.equal(true);
            expect(el.layout[0]!.x).to.equal(0);
            expect(el.layout[0]!.w).to.equal(1);
            expect(cell.style.gridColumn).to.equal('1 / span 1');
            expect(cell.style.gridRow).to.equal('1 / span 1');
          } finally {
            await resetMouse();
          }
        });
      }
    }
  }
});

const REBIND_LAYOUT: LyraDashboardCell[] = [
  { cellId: 'a', x: 0, y: 0, w: 2, h: 1, widget: { type: 'text', props: { text: 'A' } } },
  { cellId: 'b', x: 2, y: 0, w: 2, h: 1, widget: { type: 'text', props: { text: 'B' } } },
];

class DashboardGridRebindHost extends LitElement {
  @state() tick = 0;
  fresh = false;
  protected override render(): TemplateResult {
    const layout = this.fresh ? REBIND_LAYOUT.map((cell) => ({ ...cell })) : REBIND_LAYOUT;
    return html`<span>${this.tick}</span><lr-dashboard-grid cells-draggable cells-resizable .layout=${layout}></lr-dashboard-grid>`;
  }
}
customElements.define('dashboard-grid-rebind-host', DashboardGridRebindHost);

function pointer(type: string, pointerId: number, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { pointerId, isPrimary: true, button: 0, bubbles: true, composed: true, ...init });
}

async function mountRebindHost(fresh: boolean): Promise<{ host: DashboardGridRebindHost; grid: LyraDashboardGrid; cell: HTMLElement }> {
  const host = await fixture<DashboardGridRebindHost>(html`<dashboard-grid-rebind-host></dashboard-grid-rebind-host>`);
  host.fresh = fresh;
  const grid = host.shadowRoot!.querySelector('lr-dashboard-grid') as LyraDashboardGrid;
  await grid.updateComplete;
  const cell = grid.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
  cell.setPointerCapture = () => {};
  return { host, grid, cell };
}

describe('dashboard-grid under a re-rendering parent', () => {
  for (const fresh of [false, true]) {
    it(`keeps an in-flight drag when the parent re-renders ${fresh ? 'an equal new layout' : 'the same layout'}`, async () => {
      const { host, grid, cell } = await mountRebindHost(fresh);
      cell.dispatchEvent(pointer('pointerdown', 7));
      expect(cell.hasAttribute('data-dragging')).to.equal(true);
      host.tick += 1;
      await host.updateComplete;
      await grid.updateComplete;
      expect(cell.hasAttribute('data-dragging')).to.equal(true);
      window.dispatchEvent(pointer('pointerup', 7));
    });
  }

  it('does not rebuild a default widget document when the same layout is rebound', async () => {
    const { host, grid } = await mountRebindHost(false);
    const renderer = grid.querySelector('lr-widget-renderer') as HTMLElement & { document: unknown };
    const before = renderer.document;
    host.tick += 1;
    await host.updateComplete;
    await grid.updateComplete;
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
    expect(renderer.document === before).to.equal(true);
  });
});

describe('dashboard-grid pointer gestures', () => {
  it('lets a cell or resize-handle press reach ancestor listeners without starting both gestures', async () => {
    const { grid, cell } = await mountRebindHost(false);
    const handle = cell.querySelector<HTMLElement>('[part="resize-handle"]')!;
    handle.setPointerCapture = () => {};
    let presses = 0;
    const count = (): void => { presses += 1; };
    document.addEventListener('pointerdown', count);
    try {
      handle.dispatchEvent(pointer('pointerdown', 8));
      expect(cell.hasAttribute('data-resizing')).to.equal(true);
      expect(cell.hasAttribute('data-dragging'), 'the handle press is not also a cell drag').to.equal(false);
      window.dispatchEvent(pointer('pointercancel', 8));
      cell.dispatchEvent(pointer('pointerdown', 9));
      expect(cell.hasAttribute('data-dragging')).to.equal(true);
      window.dispatchEvent(pointer('pointercancel', 9));
      expect(presses).to.equal(2);
    } finally {
      document.removeEventListener('pointerdown', count);
    }
    expect(grid.isConnected).to.equal(true);
  });

  it('survives a pointerdown whose pointer cannot be captured', async () => {
    const { cell } = await mountRebindHost(false);
    delete (cell as { setPointerCapture?: unknown }).setPointerCapture;
    cell.dispatchEvent(pointer('pointerdown', 99));
    expect(cell.hasAttribute('data-dragging')).to.equal(true);
    window.dispatchEvent(pointer('pointerup', 99));
    expect(cell.hasAttribute('data-dragging')).to.equal(false);
    cell.dispatchEvent(pointer('pointerdown', 100));
    expect(cell.hasAttribute('data-dragging'), 'a later drag still starts').to.equal(true);
    window.dispatchEvent(pointer('pointercancel', 100));
  });
});

describe('dashboard-grid keyboard', () => {
  it('leaves Alt+Arrow and Ctrl+Home/End to the browser', async () => {
    const { grid } = await mountRebindHost(false);
    const [a, b] = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')] as [HTMLElement, HTMLElement];
    for (const init of [{ key: 'ArrowRight', altKey: true }, { key: 'End', ctrlKey: true }]) {
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      a.dispatchEvent(event);
      await grid.updateComplete;
      expect(event.defaultPrevented, `${JSON.stringify(init)} is not swallowed`).to.equal(false);
      expect(b.getAttribute('tabindex')).to.equal('-1');
    }
  });

  it('sorts the layout once per assignment', async () => {
    const { grid } = await mountRebindHost(false);
    const sorted = (): unknown => (grid as unknown as { sortedLayout: unknown }).sortedLayout;
    expect(sorted()).to.equal(sorted());
  });
});

describe('dashboard-grid resize handle theming', () => {
  it('paints the hovered resize handle from --lr-dashboard-grid-resize-handle-hover-bg', async () => {
    const el = await fixture<LyraDashboardGrid>(html`<lr-dashboard-grid cells-resizable
      style="inline-size: 400px; --lr-dashboard-grid-resize-handle-hover-bg: rgb(1, 2, 3)"
      .layout=${[{ cellId: 'a', x: 0, y: 0, w: 2, h: 2, widget: { type: 'text', props: { text: 'A' } } }]}></lr-dashboard-grid>`);
    const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
    try {
      await hoverUntilMatched(handle, 'The resize handle receives the pointer');
      await waitUntil(() => getComputedStyle(handle).backgroundColor === 'rgb(1, 2, 3)', 'hover paint');
    } finally {
      await resetMouse();
    }
  });
});
