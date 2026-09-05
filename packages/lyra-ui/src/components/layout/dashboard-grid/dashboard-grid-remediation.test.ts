import { expect, fixture, html, waitUntil } from '@open-wc/testing';
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
