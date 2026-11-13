import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraPageResult, LyraSourceGroup, LyraSourceRecord } from '../../../data-sources.js';
import type { LyraChatThread, LyraThreadList, ThreadListSource } from './thread-list.class.js';
import './thread-list.js';

const record = (index: number): LyraSourceRecord<LyraChatThread> => ({
  key: `t${index}`, order: index, value: { id: `t${index}`, title: `Thread ${index}` },
});
function source(reply: () => LyraPageResult<LyraChatThread>): ThreadListSource {
  return { revision: 1, query: async () => reply(), lookup: async () => [], locate: async () => null };
}
async function rejected(viewer: LyraThreadList): Promise<HTMLButtonElement> {
  await waitUntil(() => viewer.shadowRoot!.querySelector('[part="retry-button"]') !== null);
  expect(viewer.sourceTotal).to.equal(null);
  expect(viewer.shadowRoot!.querySelectorAll('lr-virtual-list').length).to.equal(0);
  return viewer.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!;
}
async function loaded(viewer: LyraThreadList, count: number): Promise<void> {
  await waitUntil(() => viewer.sourceTotal === count);
  await waitUntil(() => viewer.itemElement('t0') !== null);
  expect(viewer.shadowRoot!.querySelectorAll('[part="retry-button"]').length).to.equal(0);
}

for (const [name, value] of [
  ['null', null], ['array', []], ['number', 3],
  ['identity mismatch', { id: 'other', title: 'Wrong identity' }],
  ['oversized title', { id: 't0', title: 'x'.repeat(65_537) }],
  ['aggregate text overflow', { id: 't0', title: 'x'.repeat(32_768), excerpt: 'y'.repeat(32_768) }],
] as const) {
  it(`rejects a provider thread with ${name} and recovers through its current retry control`, async () => {
    let invalid = true;
    const provider = source(() => ({ total: 1, rows: invalid
      ? [{ key: 't0', order: 0, value: value as unknown as LyraChatThread }] : [record(0)] }));
    const viewer = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
    const retry = await rejected(viewer);
    invalid = false; retry.click();
    await loaded(viewer, 1);
    expect(viewer.threads.length).to.equal(0);
  });
}

for (const field of ['id', 'title', 'excerpt', 'timestamp', 'pinned', 'archived'] as const) {
  it(`rejects a provider ${field} accessor without executing it`, async () => {
    let reads = 0;
    const value = { id: 't0', title: 'Thread' };
    Object.defineProperty(value, field, { configurable: true, get() { reads++; throw new Error('Private provider detail'); } });
    const provider = source(() => ({ total: 1, rows: [{ key: 't0', order: 0, value }] }));
    const viewer = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
    await rejected(viewer);
    expect(reads).to.equal(0);
    viewer.dataSource = source(() => ({ total: 1, rows: [record(0)] }));
    await loaded(viewer, 1);
  });
}

const group = (key: string, startIndex: number, itemCount: number): LyraSourceGroup => ({ key, label: key, startIndex, itemCount });
for (const [name, groups] of [
  ['overlap', [group('first', 0, 2), group('second', 1, 2)]],
  ['gap', [group('first', 0, 1), group('second', 2, 1)]],
  ['reversed groups', [group('second', 1, 2), group('first', 0, 1)]],
] as const) {
  it(`rejects global thread groups with ${name} and accepts a corrected partition`, async () => {
    let invalid = true;
    const provider = source(() => ({ total: 3, rows: [record(0), record(1), record(2)],
      groups: invalid ? groups : [group('first', 0, 1), group('second', 1, 2)] }));
    const viewer = await fixture<LyraThreadList>(html`<lr-thread-list grouping="custom" .dataSource=${provider}></lr-thread-list>`);
    const retry = await rejected(viewer); invalid = false; retry.click();
    await loaded(viewer, 3);
    expect(viewer.itemElement('t2') !== null).to.equal(true);
  });
}

it('rejects supplied groups when grouping is disabled and accepts the same rows without them', async () => {
  let grouped = true;
  const provider = source(() => ({ total: 1, rows: [record(0)], ...(grouped ? { groups: [group('all', 0, 1)] } : {}) }));
  const viewer = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
  const retry = await rejected(viewer); grouped = false; retry.click();
  await loaded(viewer, 1);
});

it('accepts exactly the total thread text budget and a grouped empty source', async () => {
  const provider = source(() => ({ total: 1, rows: [{ key: 't0', order: 0,
    value: { id: 't0', title: 'x'.repeat(32_767), excerpt: 'y'.repeat(32_767) } }] }));
  const viewer = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
  await loaded(viewer, 1);
  viewer.grouping = 'custom'; viewer.dataSource = source(() => ({ total: 0, rows: [], groups: [] }));
  await waitUntil(() => viewer.sourceTotal === 0);
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelectorAll('[part="retry-button"]').length).to.equal(0);
  expect(viewer.shadowRoot!.querySelectorAll('[part="empty"]').length).to.equal(1);
});

it('contains a provider revision failure and retries after the revision becomes readable', async () => {
  let unavailable = true;
  const provider = source(() => ({ total: 1, rows: [record(0)] }));
  Object.defineProperty(provider, 'revision', { get() {
    if (unavailable) throw new Error('Private provider detail');
    return 2;
  } });
  const viewer = await fixture<LyraThreadList>(html`<lr-thread-list grouping="none" .dataSource=${provider}></lr-thread-list>`);
  const retry = await rejected(viewer); unavailable = false; retry.click();
  await loaded(viewer, 1);
});
