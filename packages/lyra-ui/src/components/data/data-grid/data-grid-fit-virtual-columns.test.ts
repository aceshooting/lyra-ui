import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { DataGridColumn, LyraDataGrid } from './data-grid.js';
import './data-grid.js';

type Row = { id: string; value: string };

describe('data-grid fitting with unmounted fixed columns', () => {
  const fixedColumns: [string, Partial<DataGridColumn<Row>>, number][] = [
    ['an explicit width', { width: 90 }, 90],
    ['only a maximum width', { maxWidth: 80 }, 80],
    ['only a minimum width', { minWidth: 70 }, 70],
    ['the public fallback size', {}, 96],
  ];
  for (const [name, fixed, expectedFixedWidth] of fixedColumns) {
    for (const direction of ['ltr', 'rtl'] as const) {
      for (const selectable of ['none', 'multiple'] as const) {
        it(`reserves ${name} outside the ${direction} window with ${selectable} selection`, async () => {
          const flexibleCount = 59;
          const columns: DataGridColumn<Row>[] = [
            ...Array.from({ length: flexibleCount }, (_, index) => ({
              id: `column-${index}`, field: 'value', label: `Column ${index + 1}`, width: 120, minWidth: 1, flex: 1,
            })),
            { id: 'fixed', field: 'value', label: 'Fixed', flex: 0, ...fixed },
          ];
          const grid = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid label="Wide records"
            style="inline-size:2048px;--lr-size-7rem:96px" dir=${direction} .selectable=${selectable}
            .rowKey=${'id'} .columns=${columns} .data=${[{ id: 'record', value: 'Value' }]}></lr-data-grid>`);
          const body = grid.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
          const header = (id: string) => grid.shadowRoot!.querySelector<HTMLElement>(`[role="columnheader"][data-column-id="${id}"]`);
          await waitUntil(() => body.scrollWidth > body.clientWidth && header('fixed') === null,
            'the fixed column should be outside the mounted horizontal window');
          const selectionWidth = selectable === 'none' ? 0 :
            grid.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"]:not([data-column-id])')!.getBoundingClientRect().width;
          const expectedFlexibleWidth = (body.clientWidth - selectionWidth - expectedFixedWidth) / flexibleCount;
          expect(expectedFlexibleWidth).to.be.greaterThan(1);
          grid.sizeColumnsToFit();
          await grid.updateComplete;
          const widths = grid.getState().widths!;
          expect(Object.keys(widths).length).to.equal(flexibleCount);
          expect(widths['fixed']).to.equal(undefined);
          for (let index = 0; index < flexibleCount; index++) {
            expect(widths[`column-${index}`], `column ${index}`).to.be.closeTo(expectedFlexibleWidth, 0.001);
          }
          await waitUntil(() => header('fixed') !== null, 'fitting should bring the fixed column into view');
          expect(header('fixed')!.getBoundingClientRect().width).to.be.closeTo(expectedFixedWidth, 1);
          expect(header('column-0')!.getBoundingClientRect().width).to.be.closeTo(expectedFlexibleWidth, 1);
          expect(body.scrollWidth).to.be.at.most(body.clientWidth + 1);
        });
      }
    }
  }
});
