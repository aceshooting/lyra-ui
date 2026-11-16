import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchyRow, LyraSourceRangeRequest } from '../../../data-sources.js';
import type { LyraTraceTree, TraceTreeSource } from './trace-tree.class.js';
import type { LyraSpan } from './span.js';
import './trace-tree.js';

interface Deferred { readonly request: LyraSourceRangeRequest; release(): void }

/** A ranged provider whose row reads wait until the test releases them. */
function deferredProvider(prefix: string, count = 3) {
  const reads: Deferred[] = [];
  const holds: (() => void)[] = [];
  let holdProjects = false;
  let projects = 0;
  const row = (index: number): LyraHierarchyRow<LyraSpan> => ({ key: `${prefix}${index}`,
    value: { id: `${prefix}${index}`, name: `${prefix} span ${index}`, kind: 'tool', status: 'success', startMs: index * 10, endMs: index * 10 + 5 },
    parentKey: null, level: 1, position: index + 1, setSize: count, childCount: 0, expanded: false, selected: false });
  const source: TraceTreeSource = { revision: 1, async project() {
    projects++;
    if (holdProjects) await new Promise<void>((resolve) => holds.push(resolve));
    return { state: `${prefix}-${projects}`, total: count, summary: { startMs: 0, endMs: count * 10 },
      rows: { count,
        async indexOfKey(key: string) { return key.startsWith(prefix) ? Number(key.slice(prefix.length)) : null; },
        read(request: LyraSourceRangeRequest) {
          return new Promise<readonly LyraHierarchyRow<LyraSpan>[]>((resolve) => {
            reads.push({ request, release: () => resolve(Array.from({ length: request.limit }, (_, offset) => row(request.offset + offset))) });
          });
        } } };
  } };
  return { source, reads, projects: () => projects,
    holdProjects(value: boolean) { holdProjects = value; }, releaseProjects() { for (const release of holds.splice(0)) release(); } };
}
const keys = (el: LyraTraceTree) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-source-key]')].map((row) => row.dataset['sourceKey']);
const releaseAll = (reads: Deferred[]) => { for (const read of reads.splice(0)) read.release(); };

it('drops a row page that resolves after the source was replaced', async () => {
  const first = deferredProvider('old');
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${first.source}></lr-trace-tree>`);
  await waitUntil(() => first.reads.length > 0, 'the first page is requested');
  const toggles: Event[] = [];
  el.addEventListener('lr-span-toggle', (event) => toggles.push(event));
  const second = deferredProvider('new');
  el.treeSource = second.source;
  expect(first.reads.every((read) => read.request.signal.aborted)).to.equal(true);
  releaseAll(first.reads);
  await waitUntil(() => second.reads.length > 0, 'the replacement page is requested');
  await el.updateComplete;
  expect(keys(el).some((key) => key?.startsWith('old'))).to.equal(false);
  releaseAll(second.reads);
  await waitUntil(() => keys(el).length === 3, 'the replacement rows mount');
  expect(keys(el)).to.deep.equal(['new0', 'new1', 'new2']);
  expect(toggles.length).to.equal(0);
});

it('re-projects instead of painting a page that resolves after hidden kinds changed', async () => {
  const data = deferredProvider('span');
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}></lr-trace-tree>`);
  await waitUntil(() => data.reads.length > 0);
  el.hiddenKinds = ['llm'];
  await el.updateComplete;
  releaseAll(data.reads);
  await waitUntil(() => data.projects() >= 2, 'the query change re-projects');
  await waitUntil(() => data.reads.length > 0, 'the new projection requests its page');
  releaseAll(data.reads);
  await waitUntil(() => keys(el).length === 3);
  expect(keys(el)).to.deep.equal(['span0', 'span1', 'span2']);
});

it('resumes loading after being disconnected while a page was pending', async () => {
  const data = deferredProvider('span');
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}></lr-trace-tree>`);
  await waitUntil(() => data.reads.length > 0);
  const parent = el.parentNode!;
  el.remove();
  releaseAll(data.reads);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(keys(el).length).to.equal(0);
  parent.appendChild(el);
  await waitUntil(() => data.reads.length > 0, 'the reconnected tree requests again');
  releaseAll(data.reads);
  await waitUntil(() => keys(el).length === 3);
  expect(keys(el)).to.deep.equal(['span0', 'span1', 'span2']);
});

it('rejects a reveal that the source superseded before its key lookup settled', async () => {
  const data = deferredProvider('span');
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}></lr-trace-tree>`);
  await waitUntil(() => data.reads.length > 0);
  releaseAll(data.reads);
  await waitUntil(() => keys(el).length === 3);
  const reveal = el.revealSourceKey('span2');
  el.treeSource = deferredProvider('other').source;
  expect(await reveal).to.equal(false);
});

it('fails a provider row whose span id disagrees with its row key', async () => {
  const rows: LyraHierarchyRow<LyraSpan>[] = [
    { key: 'good', value: { id: 'good', name: 'Good span', kind: 'tool', status: 'success', startMs: 0, endMs: 5 },
      parentKey: null, level: 1, position: 1, setSize: 2, childCount: 0, expanded: false, selected: false },
    { key: 'claimed', value: { id: 'other', name: 'Mislabelled span', kind: 'tool', status: 'success', startMs: 5, endMs: 9 },
      parentKey: null, level: 1, position: 2, setSize: 2, childCount: 0, expanded: false, selected: false },
  ];
  const source: TraceTreeSource = { revision: 1, async project() {
    return { state: 'mismatch', total: 2, summary: { startMs: 0, endMs: 10 },
      rows: { count: 2, keyAt: (index) => rows[index]!.key, itemAt: (index) => rows[index]!,
        indexOfKey: (key: string | number) => rows.findIndex((candidate) => candidate.key === key) } };
  } };
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${source}></lr-trace-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')), 'the mismatched row fails closed');
  expect(el.shadowRoot!.textContent).not.to.include('Mislabelled span');
});

it('treats cleared hidden kinds on a source-backed tree as no hidden kinds', async () => {
  const data = deferredProvider('span');
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}></lr-trace-tree>`);
  (el as unknown as { hiddenKinds: unknown }).hiddenKinds = null;
  await el.updateComplete;
  await waitUntil(() => data.reads.length > 0);
  releaseAll(data.reads);
  await waitUntil(() => keys(el).length === 3, 'every kind stays visible');
  expect(keys(el)).to.deep.equal(['span0', 'span1', 'span2']);
});

it('discards a page that lands while a newer projection is still loading', async () => {
  const data = deferredProvider('span');
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}></lr-trace-tree>`);
  await waitUntil(() => data.reads.length > 0);
  data.holdProjects(true);
  el.hiddenKinds = ['llm'];
  await el.updateComplete;
  await waitUntil(() => data.projects() === 2, 'the newer projection starts');
  releaseAll(data.reads);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(keys(el).length, 'no row from the superseded page paints').to.equal(0);
  data.holdProjects(false);
  data.releaseProjects();
  await waitUntil(() => data.reads.length > 0, 'the accepted projection requests its page');
  releaseAll(data.reads);
  await waitUntil(() => keys(el).length === 3);
  expect(keys(el)).to.deep.equal(['span0', 'span1', 'span2']);
});

it('settles a pending reveal as rejected when the tree is disconnected mid-projection', async () => {
  const data = deferredProvider('span');
  const el = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}></lr-trace-tree>`);
  await waitUntil(() => data.reads.length > 0);
  releaseAll(data.reads);
  await waitUntil(() => keys(el).length === 3);
  data.holdProjects(true);
  const reveal = el.revealSourceKey('span2');
  await waitUntil(() => data.projects() === 2, 'the reveal projection is pending');
  const parent = el.parentNode!;
  el.remove();
  expect(await reveal).to.equal(false);
  data.holdProjects(false);
  data.releaseProjects();
  parent.appendChild(el);
  await waitUntil(() => keys(el).length > 0 || data.reads.length > 0, 'the reconnected tree reloads');
  releaseAll(data.reads);
  await waitUntil(() => keys(el).length === 3);
});
