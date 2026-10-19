import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraSourceRecord } from '../../../data-sources.js';
import type { LyraChatThread, LyraThreadList, ThreadListSource } from './thread-list.class.js';
import './thread-list.js';

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
});
