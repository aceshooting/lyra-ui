import { expect, fixture, html } from '@open-wc/testing';
import { tag } from '../../../internal/prefix.js';
import { LyraDataGrid } from '../../lr-data-grid.js';

it('registers the column menu controls when a grid first requests them', async () => {
  const grid = await fixture<LyraDataGrid>(html`<lr-data-grid label="Inventory"
    .columns=${[{ field: 'name', label: 'Name' }]}></lr-data-grid>`);
  expect(customElements.get(tag('dropdown')) === undefined).to.equal(true);
  grid.withColumnsMenu = true;
  await grid.updateComplete;
  for (const name of ['dropdown', 'button', 'dropdown-item']) {
    expect(typeof customElements.get(tag(name))).to.equal('function');
  }
  expect(grid.shadowRoot!.querySelector('[part="columns-menu"]')!.matches(':defined')).to.equal(true);
  expect(Array.from(grid.shadowRoot!.querySelectorAll(tag('dropdown-item')), (item) => (item as unknown as { hasUpdated: boolean }).hasUpdated),
    'updateComplete covers the menu render').to.deep.equal([true]);
});
