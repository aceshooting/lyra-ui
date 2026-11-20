import { expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { readCanvasRgba } from '../../../internal/canvas-color.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-data-grid.js';
import type { LyraDataGrid } from '../../lr-data-grid.js';
import { type Person, columns, dataGrid, header, rows } from '../../../../test/data-grid.js';

function cell(element: LyraDataGrid<Person>, row: number, column: number): HTMLElement {
  const found = element.shadowRoot!.querySelector<HTMLElement>(
    `[role="gridcell"][data-row-position="${row}"][data-column-position="${column}"]`,
  );
  if (!found) throw new Error(`Missing cell ${row}:${column}`);
  return found;
}

function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('data-grid reserved and held keys', () => {
  it('leaves Alt/Ctrl/Cmd-modified keys and IME composition to the platform', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
    const target = cell(element, 0, 0);
    for (const init of [
      { key: 'ArrowDown', ctrlKey: true },
      { key: 'ArrowRight', ctrlKey: true },
      { key: '=', ctrlKey: true },
      { key: 'ArrowRight', altKey: true },
      { key: 'ArrowDown', isComposing: true },
      { key: 'ArrowDown', keyCode: 229 },
    ] satisfies Array<KeyboardEventInit & { key: string }>) {
      const event = press(target, init.key, init);
      expect(event.defaultPrevented, `${init.key} ${JSON.stringify(init)}`).to.equal(false);
    }
    expect(press(target, 'ArrowDown').defaultPrevented, 'plain ArrowDown still navigates').to.equal(true);
  });

  it('activates a header sort once for a held Enter and not at all while composing', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
    let requests = 0;
    element.addEventListener('lr-sort-request', () => { requests += 1; });
    const target = header(element, 'name');
    press(target, 'Enter', { repeat: true });
    press(target, 'Enter', { isComposing: true });
    expect(requests).to.equal(0);
    press(target, 'Enter');
    expect(requests).to.equal(1);
  });

  it('does not resize a column from a modified Arrow on the separator', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" resizable .columns=${columns} .data=${rows}></lr-data-grid>`);
    const handle = element.shadowRoot!.querySelector<HTMLElement>('[part~="resize-handle"]');
    expect(handle !== null).to.equal(true);
    let requests = 0;
    element.addEventListener('lr-column-resize-request', () => { requests += 1; });
    press(handle!, 'ArrowRight', { ctrlKey: true });
    press(handle!, 'ArrowRight', { altKey: true });
    expect(requests).to.equal(0);
    press(handle!, 'ArrowRight');
    expect(requests).to.equal(1);
  });
});

describe('data-grid request revalidation and page reset', () => {
  it('drops a sort commit after a request listener removed the grid', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
    let committed = 0;
    element.addEventListener('lr-sort-change', () => { committed += 1; });
    element.addEventListener('lr-sort-request', () => { element.remove(); });
    press(header(element, 'name'), 'Enter');
    expect(committed).to.equal(0);
    expect(element.sort.length).to.equal(0);
  });

  it('reports the page reset a user sort, filter or search causes', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" paginate with-search page="1" page-size="2" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    expect(element.page).to.equal(1);
    const reset = oneEvent(element, 'lr-page-change');
    press(header(element, 'name'), 'Enter');
    const { detail } = await reset;
    expect(detail.page).to.equal(0);
    expect(element.page).to.equal(0);

    element.page = 1;
    await element.updateComplete;
    const search = element.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
    const searchReset = oneEvent(element, 'lr-page-change');
    search.value = 'a';
    search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    expect((await searchReset).detail.page).to.equal(0);
  });
});

describe('data-grid selection re-activation', () => {
  it('does not re-emit lr-row-select when select-all is repeated on a fully selected page', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" selectable="multiple" row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    let events = 0;
    element.addEventListener('lr-row-select', () => { events += 1; });
    press(cell(element, 0, 0), 'a', { ctrlKey: true });
    await element.updateComplete;
    expect(events).to.equal(1);
    expect(element.selectedKeys.length).to.equal(rows.length);
    press(cell(element, 0, 0), 'a', { ctrlKey: true });
    await element.updateComplete;
    expect(events).to.equal(1);
  });
});

describe('data-grid pinned cell paint', () => {
  it('keeps a pinned sortable header opaque while hovered and pressed', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" pinnable .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    element.pinColumn('name', 'left');
    await element.updateComplete;
    const target = header(element, 'name');
    expect(target.hasAttribute('data-sortable')).to.equal(true);
    const alpha = () => readCanvasRgba(element.ownerDocument, getComputedStyle(target).backgroundColor)?.[3];
    try {
      await hoverUntilMatched(target, 'pinned header hover');
      expect(alpha()).to.equal(1);
      await sendMouse({ type: 'down' });
      await waitUntil(() => target.matches(':active'), 'pinned header press');
      expect(alpha()).to.equal(1);
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it('raises a pinned body cell above the next row while it holds an open overlay', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" pinnable .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    element.pinColumn('name', 'left');
    await element.updateComplete;
    const pinned = element.shadowRoot!.querySelector<HTMLElement>('[part~="cell"][data-pin="left"]')!;
    const resting = Number(getComputedStyle(pinned).zIndex);
    const overlay = document.createElement('lr-dropdown');
    overlay.setAttribute('open', '');
    pinned.append(overlay);
    expect(Number(getComputedStyle(pinned).zIndex)).to.be.greaterThan(resting);
  });
});
