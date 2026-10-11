import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import { measurementAccess } from '../../../../test/data-grid.js';

it('invalidates an offscreen measurement after a caller-owned row edit', async () => {
  const rows = Array.from({ length: 200 }, (_, id) => ({ id, height: id === 0 ? 100 : 20 }));
  const grid = await fixture<LyraDataGrid<{ id: number; height: number }>>(html`<lr-data-grid
    label="Rows" row-key="id" style="--row-height:40px;--cell-padding:0px;--max-height:160px"
    .columns=${[{ field: 'height', label: 'Height', formatter: (value: unknown) => html`<span style=${`display:block;height:${value}px`}></span>` }]}
    .data=${rows}
  ></lr-data-grid>`);
  const measurements = measurementAccess(grid);
  await waitUntil(() => (measurements.measuredItemHeights.get('row:number:0') ?? 0) > 90);
  const body = grid.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  body.scrollTop = 4_000;
  body.dispatchEvent(new Event('scroll'));
  await waitUntil(() => grid.shadowRoot!.querySelector('[data-visible-index="0"]') === null);
  rows[0]!.height = 20;
  grid.requestUpdate();
  await grid.updateComplete;
  expect(measurements.measuredItemHeights.has('row:number:0')).to.equal(false);
});

for (const withDetail of [false, true]) it(`bounds virtual body item reads with detail renderer ${withDetail}`, async () => {
  const grid = await fixture<LyraDataGrid<{ id: number }>>(html`<lr-data-grid
    label="Rows" row-key="id" style="--row-height:40px;--max-height:160px"
    .columns=${[{ field: 'id', label: 'ID' }]}
    .rowDetail=${withDetail ? () => html`Details` : null}
    .data=${Array.from({ length: 2_000 }, (_, id) => ({ id }))}
  ></lr-data-grid>`);
  await nextFrame();
  const access = grid as unknown as {
    displayItems: Array<{ kind: string }>;
    bodyScrollTop: number;
    renderBodyContent(): unknown;
  };
  access.bodyScrollTop = 40_000;
  let reads = 0;
  for (const item of access.displayItems) {
    const kind = item.kind;
    Object.defineProperty(item, 'kind', { configurable: true, get() { reads += 1; return kind; } });
  }
  access.renderBodyContent();
  expect(reads, 'only the rendered window should inspect row kinds').to.be.lessThan(100);
});

it('matches each canonical row once when ancestors share nonmatching descendants', async () => {
  interface Row { id: string; name: string; children?: Row[] }
  const children: Row[] = Array.from({ length: 100 }, (_, id) => ({ id: `child-${id}`, name: 'Child' }));
  const parents: Row[] = Array.from({ length: 100 }, (_, id) => ({ id: `parent-${id}`, name: 'Parent', children }));
  let matches = 0;
  const grid = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
    label="Rows" row-key="id" child-rows="children" filter-from-leaf-rows .searchTerm=${'absent'}
    .columns=${[{ field: 'name', label: 'Name' }]}
    .searchFn=${() => { matches += 1; return false; }} .data=${parents}
  ></lr-data-grid>`);
  expect(grid.getProcessedRows().length).to.equal(0);
  expect(matches).to.be.at.most(400);
  matches = 0;
  children[0]!.name = 'absent';
  grid.searchFn = (_value, term, row) => { matches += 1; return row.name === term; };
  await grid.updateComplete;
  expect(grid.getProcessedRows().length).to.equal(100);
  expect(matches, 'changed predicates must not reuse previous matches').to.be.at.most(400);
  matches = 0;
  children[0]!.name = 'Child';
  grid.requestUpdate();
  await grid.updateComplete;
  expect(grid.getProcessedRows().length).to.equal(0);
  expect(matches, 'caller-owned edits must invalidate cached matches').to.be.at.most(400);
});
