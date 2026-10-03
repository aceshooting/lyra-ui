import { expect, fixture, html, waitUntil, nextFrame } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import { measurementAccess } from '../../../../test/data-grid.js';

describe('data grid measured row shrink', () => {
  it('keeps the next row at the viewport edge when invalidating a tall row from its final divider pixel', async () => {
    const columns = [{ field: 'name', label: 'Name', formatter: (value: unknown) => html`<span style="display:block;height:80px">${value}</span>` }];
    const grid = await fixture<LyraDataGrid<{ id: number; name: string }>>(html`<lr-data-grid
      label="Rows" row-key="id" style="--row-height:40px;--cell-padding:0px;--max-height:160px"
      .columns=${columns}
      .data=${Array.from({ length: 80 }, (_, index) => ({ id: index, name: `Row ${index}` }))}
    ></lr-data-grid>`);
    const measurements = measurementAccess(grid);
    await waitUntil(() => (measurements.measuredItemHeights.get('row:number:0') ?? 0) > 70);
    const body = grid.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    body.scrollTop = measurements.measuredItemHeights.get('row:number:0')! - 1;
    await waitUntil(() => measurements.lastMeasurementAnchor?.itemKey === 'row:number:1');
    grid.columns = [{ field: 'name', label: 'Name', formatter: (value: unknown) => html`<span style="display:block;height:20px">${value}</span>` }];
    await grid.updateComplete;
    await nextFrame();
    await waitUntil(() => Math.abs(body.scrollTop - 40) <= 1);
    const next = grid.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="1"]')!;
    expect(next.getBoundingClientRect().top).to.be.closeTo(body.getBoundingClientRect().top, 1);
  });

  it('retires a tall-row measurement when its content returns to the ordinary row estimate', async () => {
    const grid = await fixture<LyraDataGrid<{ id: number; name: string }>>(html`<lr-data-grid
      label="Rows" row-key="id" style="--row-height:40px;--cell-padding:0px;--max-height:160px"
      .columns=${[{ field: 'name', label: 'Name', formatter: (value: unknown) => html`<span class="row-content" style="display:block;height:80px">${value}</span>` }]}
      .data=${Array.from({ length: 80 }, (_, index) => ({ id: index, name: `Row ${index}` }))}
    ></lr-data-grid>`);
    const measurements = measurementAccess(grid);
    await waitUntil(() => (measurements.measuredItemHeights.get('row:number:0') ?? 0) > 70);
    const content = grid.shadowRoot!.querySelector<HTMLElement>('.row-content')!;
    content.style.height = '20px';
    await waitUntil(() => !measurements.measuredItemHeights.has('row:number:0'), 'shrinking to the baseline discards the cached taller height');
    const first = grid.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="0"]')!;
    expect(first.getBoundingClientRect().height).to.be.closeTo(40, 1);
    await nextFrame();
    expect(grid.shadowRoot!.querySelectorAll('[part~="row"]').length).to.be.greaterThan(0);
  });

  it('honors a fixed column maximum while distributing remaining width to a flexible column', async () => {
    const grid = await fixture<LyraDataGrid<{ id: number; name: string }>>(html`<lr-data-grid
      label="Columns" style="inline-size:500px"
      .columns=${[
        { field: 'id', label: 'Identifier', flex: 0, maxWidth: 90 },
        { field: 'name', label: 'Name', flex: 1 },
      ]}
      .data=${[{ id: 1, name: 'Ada' }]}
    ></lr-data-grid>`);
    grid.sizeColumnsToFit();
    await grid.updateComplete;
    const widths = grid.getState().widths!;
    expect(widths['id'] === undefined || widths['id'] <= 90).to.equal(true);
    expect(grid.shadowRoot!.querySelector('[part~="header-cell"][data-column-id="id"]')!.getBoundingClientRect().width).to.be.at.most(90);
    expect(widths['name']).to.be.greaterThan(300);
  });
});
