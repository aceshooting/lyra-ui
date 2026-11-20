import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-dashboard-grid.js';
import type { LyraDashboardGrid } from './dashboard-grid.class.js';

it('registers the default-cell widget stack only when a layout entry has no authored cell', async () => {
  const grid = await fixture<LyraDashboardGrid>(html`<lr-dashboard-grid
    .layout=${[{ cellId: 'a', x: 0, y: 0, w: 1, h: 1 }]}><div cell-id="a">Authored</div></lr-dashboard-grid>`);
  expect(['lr-widget', 'lr-widget-renderer'].filter(name => customElements.get(name))).to.deep.equal([]);
  grid.layout = [...grid.layout, { cellId: 'b', x: 1, y: 0, w: 1, h: 1, label: 'Users',
    widget: { type: 'stat', props: { label: 'Users', value: '12' } } }];
  await grid.updateComplete;
  const widget = grid.querySelector('[data-cell-id="b"]');
  const renderer = widget?.querySelector('lr-widget-renderer');
  const [Widget, Renderer] = [customElements.get('lr-widget'), customElements.get('lr-widget-renderer')];
  expect(Boolean(Widget && widget instanceof Widget)).to.equal(true);
  expect(Boolean(Renderer && renderer instanceof Renderer)).to.equal(true);
  expect((widget as unknown as { label: string }).label).to.equal('Users');
});
