import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchyRow } from '../../../data-sources.js';
import type { LyraTraceTree, TraceTreeSource } from './trace-tree.class.js';
import type { LyraSpan } from './span.js';
import '../../lr-trace-tree.js';

function provider(values: readonly LyraSpan[]) {
  let calls = 0;
  const rows: LyraHierarchyRow<LyraSpan>[] = values.map((value, index) => ({ key: value.id, value,
    parentKey: null, level: 1, position: index + 1, setSize: values.length, childCount: 0, expanded: false, selected: false }));
  const source: TraceTreeSource = { revision: 1, async project() {
    calls++;
    return { state: 'guards', total: rows.length, summary: { startMs: 0, endMs: 100 },
      rows: { count: rows.length, keyAt: index => rows[index]!.key, itemAt: index => rows[index]!,
        indexOfKey: (key: string | number) => rows.findIndex(row => row.key === key) } };
  } };
  return { source, calls: () => calls };
}
const sourceRow = (element: LyraTraceTree, key: string) => element.shadowRoot!.querySelector<HTMLElement>(`[data-source-key="${key}"]`);
const part = (row: Element, name: string) => row.querySelector(`[part="${name}"]`)?.textContent ?? '';

it('renders blank detail and cost cells for a provider span that omits them', async () => {
  const data = provider([
    { id: 'bare', name: 'Bare span', kind: 'llm', status: 'success', startMs: 0, endMs: 50 },
    { id: 'full', name: 'Full span', detail: 'Has detail', costText: '$1.00', kind: 'tool', status: 'success', startMs: 50, endMs: 100 },
  ]);
  const element = await fixture<LyraTraceTree>(html`<lr-trace-tree with-cost .treeSource=${data.source}></lr-trace-tree>`);
  await waitUntil(() => sourceRow(element, 'bare') !== null && sourceRow(element, 'full') !== null);
  const bare = sourceRow(element, 'bare')!;
  expect(part(bare, 'detail')).to.equal('');
  expect(part(bare, 'cost')).to.equal('');
  expect(bare.getAttribute('aria-label')).to.include('Bare span').and.not.include('Cost');
  expect(part(sourceRow(element, 'full')!, 'cost')).to.equal('$1.00');
  expect(sourceRow(element, 'full')!.getAttribute('aria-label')).to.include('Has detail').and.include('Cost: $1.00');
  // The treeitem name deliberately adds the kind label beside the visible cells (see trace-tree.test.ts).
  await expect(element).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
});

it('leaves source rows to the provider when the legacy expand and collapse helpers are called', async () => {
  const data = provider([{ id: 'only', name: 'Only span', kind: 'tool', status: 'success', startMs: 0, endMs: 10 }]);
  const element = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}></lr-trace-tree>`);
  await waitUntil(() => sourceRow(element, 'only') !== null);
  const toggles: Event[] = [];
  element.addEventListener('lr-span-toggle', (event) => toggles.push(event));
  expect(element.treeSource === data.source).to.equal(true);
  element.collapseAll();
  await element.expandAll();
  await element.updateComplete;
  expect(toggles.length).to.equal(0);
  expect(sourceRow(element, 'only')).to.not.equal(null);
  expect(data.calls()).to.equal(1);
});

it('reports that no key can be revealed without a source', async () => {
  const element = await fixture<LyraTraceTree>(html`<lr-trace-tree .spans=${[
    { id: 'a', name: 'Alpha', kind: 'tool', status: 'success', startMs: 0, endMs: 10 },
  ]}></lr-trace-tree>`);
  expect(await element.revealSourceKey('a')).to.equal(false);
  expect(element.shadowRoot!.querySelector('[data-id="a"]')).to.not.equal(null);
});

it('renders one row for a duplicated legacy span id and roves from the first row when focus is unknown', async () => {
  const spans: LyraSpan[] = [
    { id: 'root', name: 'Root', kind: 'agent', status: 'success', startMs: 0, endMs: 100 },
    { id: 'child', parentId: 'root', name: 'Child', kind: 'tool', status: 'success', startMs: 5, endMs: 50 },
    { id: 'child', parentId: 'root', name: 'Child copy', kind: 'tool', status: 'success', startMs: 6, endMs: 60 },
  ];
  const element = await fixture<LyraTraceTree>(html`<lr-trace-tree .spans=${spans}></lr-trace-tree>`);
  const rows = () => [...element.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  expect(rows().map((row) => row.dataset['id'])).to.deep.equal(['root', 'child']);
  expect(rows().filter((row) => row.tabIndex === 0).map((row) => row.dataset['id'])).to.deep.equal(['root']);
  element.collapseAll();
  await element.updateComplete;
  expect(rows().map((row) => row.dataset['id'])).to.deep.equal(['root']);
  await element.expandAll();
  expect(rows().map((row) => row.dataset['id'])).to.deep.equal(['root', 'child']);
  element.spans = [];
  await element.updateComplete;
  expect(rows().length).to.equal(0);
});
