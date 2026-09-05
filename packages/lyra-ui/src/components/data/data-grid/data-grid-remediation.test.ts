import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './data-grid.js';
import '../../forms/button/button.js';
import type { LyraDataGrid, DataGridColumn } from './data-grid.js';
import type { LyraButton } from '../../forms/button/button.js';

type Row = { id: string; value: string };
const row: Row = { id: 'first', value: 'One' };

describe('data-grid canonical output and interaction', () => {
  it('keeps the first root occurrence in rows, pages, facets and CSV', async () => {
    const second: Row = { id: 'second', value: 'Two' };
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      .rowKey=${'id'} .columns=${[{ field: 'value', label: 'Value' }]}
      .data=${[row, row, { ...row }, second]} paginate .pageSize=${1}
    ></lr-data-grid>`);
    expect(element.getProcessedRows().map((entry) => entry.id)).to.deep.equal(['first', 'second']);
    expect(element.getProcessedRows()[0] === row).to.equal(true);
    expect(element.getColumnFacets('value').uniqueValues.get('One')).to.equal(1);
    expect(element.getDataAsCsv()).to.equal('Value\r\nOne\r\nTwo');
    expect(element.getVisibleRows().map((entry) => entry.id)).to.deep.equal(['first']);
    element.page = 1;
    await element.updateComplete;
    expect(element.getVisibleRows().map((entry) => entry.id)).to.deep.equal(['second']);
    expect(element.shadowRoot!.querySelector('[role="gridcell"]')?.textContent?.trim()).to.equal('Two');
    expect(element.shadowRoot!.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')).to.equal('2');
  });

  for (const flex of [0, -1]) {
    for (const selection of ['none', 'multiple'] as const) {
      it(`reserves visible effective fixed widths with flex=${flex} and selection=${selection}`, async () => {
        const columns: DataGridColumn<Row>[] = [
          { id: 'fixed', field: 'value', label: 'Fixed', width: 100, flex },
          { id: 'hidden', field: 'value', label: 'Hidden', width: 500, flex: 0, hidden: true },
          { id: 'flexible', field: 'value', label: 'Flexible', flex: 1 },
        ];
        const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
          style="inline-size: 320px" .rowKey=${'id'} .columns=${columns}
          .data=${[row]} .selectable=${selection}
        ></lr-data-grid>`);
        const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
        const header = (id: string) => element.shadowRoot!.querySelector<HTMLElement>(`[role="columnheader"][data-column-id="${id}"]`)!;
        await waitUntil(() => header('fixed').getBoundingClientRect().width > 0);
        const fixedWidth = header('fixed').getBoundingClientRect().width;
        const selectionWidth = selection === 'none' ? 0 : element.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"]')!.getBoundingClientRect().width;
        element.sizeColumnsToFit();
        await element.updateComplete;
        expect(header('fixed').getBoundingClientRect().width).to.be.closeTo(fixedWidth, 0.1);
        expect(header('flexible').getBoundingClientRect().width).to.be.closeTo(body.clientWidth - fixedWidth - selectionWidth, 1);
        expect(element.getState().widths?.['fixed']).to.equal(undefined);
        expect(element.getState().widths?.['hidden']).to.equal(undefined);
      });
    }
  }

  it('reserves clamped, minimum-only and resized fixed widths without changing them', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid style="inline-size: 640px"
      .rowKey=${'id'} .data=${[row]} .columns=${[
        { id: 'minimum', field: 'value', label: 'Minimum', minWidth: 80, flex: 0 },
        { id: 'bounded', field: 'value', label: 'Bounded', width: 200, maxWidth: 120, flex: 0 },
        { id: 'resized', field: 'value', label: 'Resized', width: 100, flex: 0 },
        { id: 'flexible', field: 'value', label: 'Flexible', flex: 1 },
      ]}
    ></lr-data-grid>`);
    element.setState({ widths: { resized: 160 } });
    await element.updateComplete;
    element.sizeColumnsToFit();
    await element.updateComplete;
    const headers = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="columnheader"][data-column-id]')];
    expect(headers.map((header) => header.getBoundingClientRect().width)).to.deep.equal([80, 120, 160, 278]);
    expect(element.getState().widths).to.deep.equal({ resized: 160, flexible: 278 });
  });

  it('lets a real shadow-native button own activation while passive cells still emit', async () => {
    let actions = 0;
    const columns: DataGridColumn<Row>[] = [{
      field: 'value', label: 'Action', formatter: () => html`<lr-button @click=${() => actions++}>Run</lr-button><span>Passive</span>`,
    }];
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid .rowKey=${'id'} .columns=${columns} .data=${[row]}></lr-data-grid>`);
    const events: string[] = [];
    element.addEventListener('lr-cell-click', (event) => events.push((event as CustomEvent<{ rowKey: string }>).detail.rowKey));
    const button = element.shadowRoot!.querySelector<LyraButton>('lr-button')!;
    await button.updateComplete;
    button.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    expect(actions).to.equal(1);
    expect(events).to.deep.equal([]);
    element.parentElement!.tabIndex = 0;
    element.shadowRoot!.querySelector<HTMLElement>('[role="gridcell"] span')!.click();
    expect(events).to.deep.equal(['first']);
  });
});
