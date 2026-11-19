import { expect, fixture, html } from '@open-wc/testing';
import { tag } from '../../../internal/prefix.js';
import './thread-list.js';
import type { LyraThreadList } from './thread-list.class.js';

it('registers optional children only when their controls are rendered', async () => {
  const el = await fixture(html`<lr-thread-list></lr-thread-list>`) as LyraThreadList;
  expect(['empty', 'pagination'].map(name => Boolean(customElements.get(tag(name))))).to.deep.equal([false, false]);
  el.error = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-empty')!.matches(':defined')).to.equal(true);
  expect(Boolean(customElements.get(tag('pagination')))).to.equal(false);
  el.error = false;
  el.dataSource = {
    revision: 1,
    query: async () => ({ total: 0, rows: [] }),
    lookup: async () => [],
    locate: async () => null,
  };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-pagination')!.matches(':defined')).to.equal(true);
});
