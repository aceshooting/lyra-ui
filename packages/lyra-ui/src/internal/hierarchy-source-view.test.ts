import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import type { LyraHierarchySource, LyraHierarchyQuery, LyraHierarchyRow } from '../data-sources.js';
import type { LyraTree, LyraTreeNodeData } from '../components/data/tree/tree.class.js';
import '../components/data/tree/tree.js';

type Source = LyraHierarchySource<LyraTreeNodeData, LyraHierarchyQuery>;
function provider() {
  let calls = 0;
  const source: Source = { revision: 1, async project() {
    calls++;
    const row: LyraHierarchyRow<LyraTreeNodeData> = { key: 'same', value: { id: 'same', label: 'Current' }, parentKey: null,
      level: 1, position: 1, setSize: 1, childCount: 1, expanded: false, selected: false };
    return { state: String(calls), total: 1, rows: { count: 1, keyAt: () => 'same', indexOfKey: () => 0, itemAt: () => row } };
  } };
  return { source, get calls() { return calls; } };
}
const ready = (el: LyraTree) => waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));

it('rejects retained row, toggle and keyboard actions after provider replacement with the same key', async () => {
  const first = provider(); const next = provider();
  const el = await fixture<LyraTree>(html`<lr-tree label="Hierarchy" .treeSource=${first.source}></lr-tree>`); await ready(el);
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="source-row"]')!;
  const toggle = row.querySelector<HTMLButtonElement>('button')!;
  el.treeSource = next.source;
  toggle.click(); row.click(); row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await ready(el); await el.updateComplete; await nextFrame();
  expect(row.isConnected).to.equal(false);
  const count = next.calls;
  toggle.click(); row.click(); row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await nextFrame(); expect(next.calls).to.equal(count);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="source-row"] button')!.click();
  await waitUntil(() => next.calls === count + 1);
});

it('rejects retained projection retry after a newer provider becomes ready', async () => {
  const bad: Source = { revision: 1, async project() { throw new Error('Unavailable'); } };
  const el = await fixture<LyraTree>(html`<lr-tree label="Hierarchy" .treeSource=${bad}></lr-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"] button')));
  const retry = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="source-error"] button')!;
  const next = provider(); el.treeSource = next.source; await ready(el); await el.updateComplete;
  const count = next.calls; retry.click(); await nextFrame(); expect(next.calls).to.equal(count);
});
