import { expect, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import '../../lr-data-grid.js';
import type { LyraDataGrid } from '../../lr-data-grid.js';
import { type Person, columns, dataGrid, rows } from '../../../../test/data-grid.js';

describe('data-grid repeated control names and clipped focus rings', () => {
  it('names each row expand button with the row and the filter controls with their column', async () => {
    const element = (await dataGrid(html`
      <lr-data-grid label="People" row-key="id"
        .columns=${columns.map((column) => ({ ...column, filterable: true }))}
        .data=${rows}
        .rowDetail=${(row: Person) => html`<span>${row.name}</span>`}
      ></lr-data-grid>`)) as LyraDataGrid<Person>;
    const names = [...element.shadowRoot!.querySelectorAll('[part="expand-button"]')].map((button) => button.getAttribute('aria-label'));
    expect(names.length).to.be.greaterThan(1);
    expect(new Set(names).size).to.equal(names.length);
    expect(names[0]).to.contain(String(rows[0]!.name));
    const filters = [...element.shadowRoot!.querySelectorAll('[part="filter-button"]')].map((button) => button.getAttribute('aria-label'));
    expect(filters.length).to.be.greaterThan(1);
    expect(new Set(filters).size).to.equal(filters.length);
  });

  it('draws the cell focus ring inside the scrollport', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" row-key="id" style="--lr-focus-ring-offset: 3px" .columns=${columns} .data=${rows}></lr-data-grid>`);
    const cell = element.shadowRoot!.querySelector<HTMLElement>('[role="gridcell"]')!;
    await focusByKeyboard(cell);
    expect(parseFloat(getComputedStyle(cell).outlineOffset)).to.be.at.most(0);
  });

  it('outlines the selected row under forced colors', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" row-key="id" selection-mode="multiple" .selectedKeys=${[1]} .columns=${columns} .data=${rows}></lr-data-grid>`);
    try {
      await setForcedColors('active');
    } catch {
      return;
    }
    try {
      if (!matchMedia('(forced-colors: active)').matches) return;
      const selected = element.shadowRoot!.querySelector<HTMLElement>('[role="row"][aria-selected="true"]')!;
      const plain = element.shadowRoot!.querySelector<HTMLElement>('[role="row"][aria-selected="false"]')!;
      expect(getComputedStyle(selected).outlineStyle).to.equal('solid');
      expect(getComputedStyle(plain).outlineStyle).to.not.equal('solid');
    } finally {
      await setForcedColors('none');
    }
  });
});
