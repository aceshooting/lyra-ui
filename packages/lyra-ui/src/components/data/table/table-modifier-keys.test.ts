import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks, type Row, columns, rows } from '../../../../test/table.js';
installTableTestHooks();

function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('table reserved and held keys', () => {
  it('leaves Alt/Ctrl/Cmd-modified and composing keys on a row to the platform, and activates once per press', async () => {
    const el = (await fixture(html`<lr-table selection-mode="single"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rowKey = (r) => r.id;
    el.rows = rows;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector<HTMLElement>('[data-row-key]')!;
    let activations = 0;
    el.addEventListener('lr-row-activate', () => { activations += 1; });
    for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { repeat: true }]) {
      expect(press(row, 'Enter', init).defaultPrevented, JSON.stringify(init)).to.equal(false);
    }
    expect(press(row, 'ArrowDown', { ctrlKey: true }).defaultPrevented).to.equal(false);
    expect(activations).to.equal(0);
    press(row, 'Enter');
    expect(activations).to.equal(1);
  });

  it('keeps moving focus on a held ArrowDown', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rowKey = (r) => r.id;
    el.rows = rows;
    await el.updateComplete;
    const bodyRows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody [data-row-key]')];
    const held = press(bodyRows[0]!, 'ArrowDown', { repeat: true });
    await el.updateComplete;
    expect(held.defaultPrevented).to.equal(true);
    expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal(bodyRows[1]!.dataset['rowKey']);
  });

  it('does not resize from a modified Arrow on the separator', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns.map((column) => ({ ...column, resizable: true })) as TableColumn<Row>[];
    el.rowKey = (r) => r.id;
    el.rows = rows;
    await el.updateComplete;
    const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
    let requests = 0;
    el.addEventListener('lr-column-resize-request', () => { requests += 1; });
    press(handle, 'ArrowRight', { ctrlKey: true });
    press(handle, 'ArrowRight', { altKey: true });
    expect(requests).to.equal(0);
    press(handle, 'ArrowRight');
    expect(requests).to.equal(1);
  });

  it('does not re-emit lr-selection-change when the single selected row is activated again', async () => {
    const el = (await fixture(html`<lr-table selection-mode="single"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rowKey = (r) => r.id;
    el.rows = rows;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector<HTMLElement>('[data-row-key]')!;
    let changes = 0;
    el.addEventListener('lr-selection-change', () => { changes += 1; });
    press(row, 'Enter');
    press(row, 'Enter');
    expect(changes).to.equal(1);
  });
});
