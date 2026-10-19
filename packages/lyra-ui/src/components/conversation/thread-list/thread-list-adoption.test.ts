import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraSourceRecord } from '../../../data-sources.js';
import type { LyraChatThread, LyraThreadList, ThreadListSource } from './thread-list.class.js';
import './thread-list.js';

const entry = (order: number): LyraSourceRecord<LyraChatThread> => ({ key: `t${order}`, order, value: { id: `t${order}`, title: `Thread ${order}` } });

function source(queries: number[]): ThreadListSource {
  return {
    revision: 1,
    query: async ({ page }) => {
      queries.push(page);
      return { total: 3, rows: [entry(0), entry(1), entry(2)], groups: [] };
    },
    lookup: async keys => keys.map(key => entry(Number(key.slice(1)))),
    locate: async key => (/^t\d$/.test(key) ? Number(key.slice(1)) : null),
  };
}

describe('lr-thread-list adopted into another document', () => {
  it('reloads its provider rows in the destination document', async () => {
    const queries: number[] = [];
    const el = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${source(queries)}></lr-thread-list>`);
    await waitUntil(() => el.sourceTotal === 3, 'the provider rows load');
    const before = queries.length;

    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument!;
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      await waitUntil(() => queries.length > before, 'the provider is queried again after adoption');
      await el.updateComplete;
      expect(el.ownerDocument === frameDocument).to.equal(true);
      expect(el.sourceTotal).to.equal(3);
    } finally {
      el.remove();
      frame.remove();
    }
  });
});
