import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './heatmap.js';
import type { HeatmapSelectedCell, LyraHeatmap } from './heatmap.js';

type SelectionDetail = { selectedCells: readonly HeatmapSelectedCell[]; source: string };
const data = {
  kind: 'matrix' as const,
  rowLabels: ['Monday', 'Tuesday'],
  colLabels: ['Morning', 'Noon', 'Evening'],
  values: [[1, 2, 3], [4, 5, 6]],
};

async function matrix(multiple = true): Promise<LyraHeatmap> {
  return fixture<LyraHeatmap>(html`<lr-heatmap
    style="inline-size: 320px; --lr-transition-fast: 0ms"
    accessible-cells .multiple=${multiple} .data=${data}
  ></lr-heatmap>`);
}
function cell(el: LyraHeatmap, row: number, col: number): HTMLButtonElement {
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-cell-key="matrix-${row}-${col}"]`);
  if (!button) throw new Error(`Missing cell ${row},${col}`);
  return button;
}
function changes(el: LyraHeatmap): SelectionDetail[] {
  const details: SelectionDetail[] = [];
  el.addEventListener('lr-selection-change', (event) => details.push((event as CustomEvent<SelectionDetail>).detail));
  return details;
}
function key(el: HTMLElement, value: string, modifiers: KeyboardEventInit = {}): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, ...modifiers }));
}
async function point(el: HTMLElement): Promise<[number, number]> {
  await hoverUntilMatched(el, 'heatmap cell is hovered');
  const rect = el.getBoundingClientRect();
  return [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)];
}
afterEach(async () => resetMouse());

describe('lr-heatmap controlled multiple selection', () => {
  it('preserves single-cell behavior when multiple is unset', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${data}
      .selectedCell=${{ row: 0, col: 0 }} .selectedCells=${[{ row: 1, col: 1 }]}></lr-heatmap>`);
    const details = changes(el);
    let clicks = 0;
    el.addEventListener('lr-cell-click', () => clicks++);
    cell(el, 1, 1).click();
    await el.updateComplete;
    expect(clicks).to.equal(1);
    expect(details.length).to.equal(0);
    expect(cell(el, 0, 0).getAttribute('aria-selected')).to.equal('true');
    expect(cell(el, 1, 1).getAttribute('aria-selected')).to.equal('false');
  });

  it('emits an immutable proposal and applies only the controlled assignment', async () => {
    const el = await matrix();
    const details = changes(el);
    cell(el, 0, 1).click();
    expect(details.length).to.equal(1);
    expect(details[0]!.selectedCells).to.deep.equal([{ row: 0, col: 1 }]);
    expect(Object.isFrozen(details[0])).to.equal(true);
    expect(Object.isFrozen(details[0]!.selectedCells[0])).to.equal(true);
    await el.updateComplete;
    expect(cell(el, 0, 1).getAttribute('aria-selected')).to.equal('false');
    el.selectedCells = details[0]!.selectedCells;
    await el.updateComplete;
    expect(details.length).to.equal(1);
    expect(cell(el, 0, 1).getAttribute('aria-selected')).to.equal('true');
    expect(el.shadowRoot!.querySelector('[role="grid"]')!.getAttribute('aria-multiselectable')).to.equal('true');
    await expect(el).to.be.accessible();
  });

  it('clone-owns input and excludes duplicates, invalid coordinates and non-interactive cells', async () => {
    const el = await matrix();
    el.cellInteractive = (pos) => !('row' in pos && pos.row === 1 && pos.col === 2);
    const selected = [{ row: 0, col: 0 }, { row: 0, col: 0 }, { row: -1, col: 0 },
      { row: 1, col: 2 }, { row: 0.5, col: 1 }];
    el.selectedCells = selected;
    selected[0]!.col = 2;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length).to.equal(1);
    expect(cell(el, 0, 0).getAttribute('aria-selected')).to.equal('true');
    const details = changes(el);
    cell(el, 0, 1).click();
    expect(details[0]!.selectedCells).to.deep.equal([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });

  it('extends and contracts a rectangular keyboard range while retaining unrelated selection', async () => {
    const el = await matrix();
    el.selectedCells = [{ row: 1, col: 2 }];
    await el.updateComplete;
    const details = changes(el);
    el.addEventListener('lr-selection-change', (event) => {
      el.selectedCells = (event as CustomEvent<SelectionDetail>).detail.selectedCells;
    });
    cell(el, 0, 0).focus();
    key(cell(el, 0, 0), 'ArrowRight', { shiftKey: true });
    await el.updateComplete;
    expect(details.at(-1)!.selectedCells).to.deep.equal([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 2 }]);
    key(cell(el, 0, 1), 'ArrowDown', { shiftKey: true });
    await el.updateComplete;
    expect(details.at(-1)!.selectedCells.length).to.equal(5);
    key(cell(el, 1, 1), 'ArrowUp', { shiftKey: true });
    await el.updateComplete;
    expect(details.at(-1)!.selectedCells.length).to.equal(3);
  });

  it('toggles rows and columns through public methods and keyboard shortcuts', async () => {
    const el = await matrix();
    const details = changes(el);
    el.toggleRowSelection(1);
    expect(details.at(-1)!.selectedCells).to.deep.equal([{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }]);
    el.selectedCells = details.at(-1)!.selectedCells;
    await el.updateComplete;
    cell(el, 1, 0).focus();
    key(cell(el, 1, 0), ' ', { shiftKey: true });
    expect(details.at(-1)!.selectedCells.length).to.equal(0);
    el.toggleColumnSelection(2);
    expect(details.at(-1)!.selectedCells.length).to.equal(4);
    const count = details.length;
    el.toggleRowSelection(Number.POSITIVE_INFINITY);
    el.toggleColumnSelection(-1);
    expect(details.length).to.equal(count);
  });

  it('paints and erases a native pointer drag with one proposal per completed gesture', async () => {
    const el = await matrix();
    const details = changes(el);
    el.addEventListener('lr-selection-change', (event) => {
      el.selectedCells = (event as CustomEvent<SelectionDetail>).detail.selectedCells;
    });
    await point(cell(el, 0, 0));
    await sendMouse({ type: 'down' });
    const end = cell(el, 0, 2).getBoundingClientRect();
    await sendMouse({ type: 'move', position: [Math.round(end.x + end.width / 2), Math.round(end.y + end.height / 2)] });
    expect(details.length).to.equal(0);
    await sendMouse({ type: 'up' });
    await waitUntil(() => details.length === 1);
    expect(details[0]!.selectedCells).to.deep.equal([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]);
    await point(cell(el, 0, 0));
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'move', position: [Math.round(end.x + end.width / 2), Math.round(end.y + end.height / 2)] });
    await sendMouse({ type: 'up' });
    await waitUntil(() => details.length === 2);
    expect(details[1]!.selectedCells.length).to.equal(0);
  });

  it('discards a cancelled drag and does not resume it after reconnect', async () => {
    const el = await matrix();
    const details = changes(el);
    let pointerId = 0;
    el.addEventListener('pointerdown', (event) => { pointerId = event.pointerId; });
    await point(cell(el, 0, 0));
    await sendMouse({ type: 'down' });
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length === 1);
    el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }));
    await sendMouse({ type: 'up' });
    await el.updateComplete;
    expect(details.length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length).to.equal(0);
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    cell(el, 0, 1).click();
    expect(details.at(-1)!.selectedCells).to.deep.equal([{ row: 0, col: 1 }]);
  });
});

describe('lr-heatmap selection across modes and input devices', () => {
  it('supports native keyboard toggles and physical range navigation under Arabic RTL', async () => {
    const el = await matrix();
    el.dir = 'rtl';
    el.lang = 'ar';
    el.strings = { heatmapSelectedCount: 'المحدد: {count}' };
    await el.updateComplete;
    const details = changes(el);
    el.addEventListener('lr-selection-change', (event) => {
      el.selectedCells = (event as CustomEvent<SelectionDetail>).detail.selectedCells;
    });
    cell(el, 0, 0).focus();
    await sendKeys({ press: 'Space' });
    await waitUntil(() => details.length === 1);
    expect(details[0]!.selectedCells).to.deep.equal([{ row: 0, col: 0 }]);
    await sendKeys({ press: 'Shift+ArrowRight' });
    await waitUntil(() => details.length === 2);
    expect(details[1]!.selectedCells).to.deep.equal([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
    expect(el.shadowRoot!.querySelector('[role="grid"]')!.getAttribute('aria-label')).to.include('المحدد:');
    await sendKeys({ press: 'Control+Space' });
    await waitUntil(() => details.length === 3);
    expect(details[2]!.selectedCells.length).to.equal(3);
  });

  it('uses calendar date identity for selected gaps and week-column toggles', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap multiple accessible-cells
      .data=${{ kind: 'calendar', days: [{ date: '2026-09-07', value: 1 }, { date: '2026-09-09', value: 2 }] }}
      .selectedCells=${[{ date: '2026-09-08' }, { date: '2025-01-01' }]}
    ></lr-heatmap>`);
    expect(el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[aria-selected="true"]')!.getAttribute('data-cell-identity')).to.equal('2026-09-08');
    const details = changes(el);
    el.toggleColumnSelection(0);
    expect(details[0]!.selectedCells.length).to.equal(7);
    expect(details[0]!.selectedCells.every((pos) => typeof pos.date === 'string')).to.equal(true);
    await expect(el).to.be.accessible();
  });

  it('keeps projection and filtered totals bounded when the controlled data shrinks', async () => {
    const el = await matrix();
    el.selectedCells = [{ row: 0, col: 0 }, { row: 1, col: 2 }];
    await el.updateComplete;
    cell(el, 1, 2).focus();
    el.data = { kind: 'matrix', rowLabels: ['Monday'], colLabels: ['Morning'], values: [[5]] };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="cell"][tabindex="0"]').length).to.equal(1);
    const details = changes(el);
    cell(el, 0, 0).click();
    expect(details[0]!.selectedCells.length).to.equal(0);
  });

  it('bounds selected entries and the accessible window independently on a 100 by 100 matrix', async () => {
    const el = await matrix();
    const labels = Array.from({ length: 100 }, (_, index) => String(index));
    el.data = { kind: 'matrix', rowLabels: labels, colLabels: labels, values: [] };
    el.selectedCells = Array.from({ length: 10_100 }, (_, index) => ({ row: Math.floor(index / 100), col: index % 100 }));
    await el.updateComplete;
    expect(el.selectedCells.length).to.equal(10_000);
    expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(400);
    const details = changes(el);
    el.toggleRowSelection(99);
    expect(details[0]!.selectedCells.length).to.equal(9900);
  });

  it('handles touch cancellation and a second pointer without committing a selection', async () => {
    const el = await matrix();
    const details = changes(el);
    const rect = cell(el, 0, 0).getBoundingClientRect();
    const init = { bubbles: true, pointerType: 'touch', pointerId: 8, isPrimary: true,
      clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 };
    cell(el, 0, 0).dispatchEvent(new PointerEvent('pointerdown', init));
    await el.updateComplete;
    expect(cell(el, 0, 0).getAttribute('aria-selected')).to.equal('true');
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    base.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerId: 9, isPrimary: false }));
    expect(details.length).to.equal(0);
    base.dispatchEvent(new PointerEvent('pointercancel', init));
    await el.updateComplete;
    expect(details.length).to.equal(0);
    expect(cell(el, 0, 0).getAttribute('aria-selected')).to.equal('false');
    expect(getComputedStyle(cell(el, 0, 0)).touchAction).to.equal('none');
  });

  it('does not emit a cell click when a painted drag returns to its starting cell', async () => {
    const el = await matrix();
    const details = changes(el);
    let clicks = 0;
    el.addEventListener('lr-cell-click', () => clicks++);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    const dispatch = (type: string, col: number): void => {
      const rect = cell(el, 0, col).getBoundingClientRect();
      base.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 21, isPrimary: true, button: 0,
        clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
      }));
    };
    dispatch('pointerdown', 0);
    dispatch('pointermove', 2);
    dispatch('pointermove', 0);
    dispatch('pointerup', 0);
    expect(details.length).to.equal(1);
    expect(details[0]!.selectedCells).to.deep.equal([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]);
    expect(clicks).to.equal(0);
  });

  it('cancels drag state on Escape, disconnect, data refresh and leaving multiple mode', async () => {
    const el = await matrix();
    const details = changes(el);
    for (const cancel of ['escape', 'disconnect', 'data', 'multiple']) {
      el.multiple = true;
      await el.updateComplete;
      const rect = cell(el, 0, 0).getBoundingClientRect();
      const init = { bubbles: true, pointerId: 5, isPrimary: true,
        clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 };
      cell(el, 0, 0).dispatchEvent(new PointerEvent('pointerdown', init));
      await el.updateComplete;
      if (cancel === 'escape') key(cell(el, 0, 0), 'Escape');
      if (cancel === 'data') el.data = { ...data };
      if (cancel === 'multiple') el.multiple = false;
      if (cancel === 'disconnect') { const parent = el.parentElement!; el.remove(); parent.append(el); }
      await el.updateComplete;
      el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new PointerEvent('pointerup', init));
      await el.updateComplete;
      expect(details.length, cancel).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length, cancel).to.equal(0);
    }
  });
});

it('uses current controlled selection when an external update interrupts a keyboard range', async () => {
  const el = await matrix();
  const details = changes(el);
  el.addEventListener('lr-selection-change', (event) => {
    el.selectedCells = (event as CustomEvent<SelectionDetail>).detail.selectedCells;
  });
  cell(el, 0, 0).focus();
  key(cell(el, 0, 0), 'ArrowRight', { shiftKey: true });
  await el.updateComplete;
  el.selectedCells = [{ row: 1, col: 1 }];
  await el.updateComplete;
  key(cell(el, 0, 1), 'ArrowRight', { shiftKey: true });
  expect(details.at(-1)!.selectedCells).to.deep.equal([{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 1 }]);
});

it('supports multiple selection from the canvas keyboard surface without accessibleCells', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap multiple .data=${data}></lr-heatmap>`);
  const details = changes(el);
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  canvas.focus();
  key(canvas, 'ArrowRight');
  key(canvas, 'Enter');
  expect(details[0]!.selectedCells).to.deep.equal([{ row: 0, col: 0 }]);
  expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(0);
  expect(canvas.getAttribute('role')).to.equal('application');
});
