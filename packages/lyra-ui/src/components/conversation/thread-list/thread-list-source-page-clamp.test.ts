import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraSourceRecord } from '../../../data-sources.js';
import type { LyraChatThread, LyraThreadList, ThreadListSource } from './thread-list.class.js';
import '../../lr-thread-list.js';

const TOTAL = 5;
const entry = (order: number): LyraSourceRecord<LyraChatThread> => ({ key: `t${order}`, order, value: { id: `t${order}`, title: `Thread ${order}` } });

const pagedSource: ThreadListSource = {
  revision: 1,
  query: async ({ page, pageSize }) => ({
    total: TOTAL,
    rows: Array.from({ length: Math.max(0, Math.min(pageSize, TOTAL - page * pageSize)) }, (_, offset) => entry(page * pageSize + offset)),
    groups: [],
  }),
  lookup: async keys => keys.map(key => entry(Number(key.slice(1)))),
  locate: async key => (/^t\d$/.test(key) ? Number(key.slice(1)) : null),
};

describe('lr-thread-list provider paging', () => {
  it('moves a page beyond the provider total back to the last page that has rows', async () => {
    const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .sourcePageSize=${2} .sourcePage=${40} .dataSource=${pagedSource}></lr-thread-list>`);
    await waitUntil(() => el.sourcePage === 2 && el.sourceTotal === TOTAL, 'the page is clamped to the final page');
    await el.updateComplete;
    await waitUntil(() => el.itemElement('t4') !== null, 'the final thread is rendered');
    expect(el.itemElement('t0') === null).to.equal(true);
  });

  it('reports every component-owned sourcePage write and lets the host veto pager requests', async () => {
    const pages: number[] = [];
    const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .sourcePageSize=${2} .sourcePage=${40} .dataSource=${pagedSource}
      @lr-source-page-change=${(event: CustomEvent<{ page: number }>) => pages.push(event.detail.page)}></lr-thread-list>`);
    await waitUntil(() => pages.length === 1, 'the provider correction is reported');
    expect(pages).to.deep.equal([2]);
    el.sourcePage = 1;
    await waitUntil(() => el.itemElement('t2') !== null, 'the host-assigned page renders');
    expect(pages, 'a host assignment is silent').to.deep.equal([2]);
    const next = (): HTMLButtonElement => el.shadowRoot!.querySelector('[part~="source-pagination"]')!.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!;
    const veto = (event: Event): void => event.preventDefault();
    el.addEventListener('lr-source-page-change-request', veto, { once: true });
    const vetoed = oneEvent(el, 'lr-source-page-change-request');
    next().click();
    expect((await vetoed).detail.page).to.equal(2);
    await el.updateComplete;
    expect([el.sourcePage, pages.length]).to.deep.equal([1, 1]);
    next().click();
    expect([el.sourcePage, ...pages]).to.deep.equal([2, 2, 2]);
    (el as unknown as { searchText: string }).searchText = 'Thread';
    await waitUntil(() => pages.length === 3, 'the query reset is reported');
    expect([el.sourcePage, pages[2]]).to.deep.equal([0, 0]);
  });
});
