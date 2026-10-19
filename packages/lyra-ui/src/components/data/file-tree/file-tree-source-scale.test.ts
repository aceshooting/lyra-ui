import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraHierarchyRow, LyraHierarchySource, LyraHierarchyQuery } from '../../../data-sources.js';
import type { LyraFileTree, FileTreeNode } from './file-tree.class.js';
import './file-tree.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');

it('reaches the final allocated million-record source through the public route with bounded reads', async function () {
  this.timeout(30000);
  const n = 1_000_000;
  // Provider storage is deliberately allocated before measuring the component interaction.
  const records: FileTreeNode[] = Array.from({ length: n }, (_, index) => { const key = `n${index}`; return { path: key, name: key, kind: 'file' }; });
  let reads = 0;
  let keys = 0;
  const provider: LyraHierarchySource<FileTreeNode, LyraHierarchyQuery> = { revision: 1, async project(request) {
    return { state: 'all', total: n, rows: { count: n,
      keyAt: index => { keys++; return `n${index}`; },
      indexOfKey: (key: string | number) => Number(String(key).slice(1)),
      itemAt: index => { reads++; return { key: `n${index}`, value: records[index]!, parentKey: null,
        level: 1, position: index + 1, setSize: n, childCount: 0, expanded: false, selected: false }; },
    }, ...(request.action.type === 'reveal' ? { focusIndex: Number(request.action.key.slice(1)) } : {}) };
  } };
  const el = await fixture<LyraFileTree>(html`<lr-file-tree label="Allocated records" .treeSource=${provider}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-row"]')));
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!);
  await sendKeys({ press: 'End' });
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="n999999"][tabindex="0"]')));
  const last = el.shadowRoot!.querySelector<HTMLElement>('[data-source-key="n999999"]')!;
  expect(last.textContent).to.contain('n999999');
  expect(last.getAttribute('aria-posinset')).to.equal(String(n));
  expect(records.length).to.equal(n);
  expect(reads).to.be.lessThan(1000);
  const mounted = el.shadowRoot!.querySelectorAll('[part~="source-row"]').length;
  expect(mounted).to.be.at.most(301);
  recordScaleMeasurement('lr-file-tree', '1000000 allocated records End source navigation', { reads, keyReads: keys, mountedRows: mounted });
});

it('bounds ranged million-row reads, including an unaligned large window and a focused pin', async function () {
  this.timeout(30000); // Budget for a heavily loaded multi-browser host; the asserted bounds are unchanged.
  const n = 1_000_000;
  let reads = 0;
  let rows = 0;
  let physical = 0;
  let peak = 0;
  let largest = 0;
  const provider: LyraHierarchySource<FileTreeNode, LyraHierarchyQuery> = { revision: 1, async project(request) {
    return { state: 'range', total: n, rows: { count: n,
      async indexOfKey(key: string) { return Number(key.slice(1)); },
      async read(request) {
        reads++; rows += request.limit; largest = Math.max(largest, request.limit);
        physical++; peak = Math.max(peak, physical);
        await new Promise(resolve => setTimeout(resolve, 5));
        physical--;
        return Array.from({ length: request.limit }, (_, offset): LyraHierarchyRow<FileTreeNode> => {
          const index = request.offset + offset; const key = `n${index}`;
          return { key, value: { path: key, name: key, kind: 'file' }, parentKey: null, level: 1, position: index + 1,
            setSize: n, childCount: 0, expanded: false, selected: false };
        });
      },
    }, ...(request.action.type === 'reveal' ? { focusIndex: Number(request.action.key.slice(1)) } : {}) };
  } };
  const el = await fixture<LyraFileTree>(html`<lr-file-tree label="Ranged records" style="height: 20000px" .treeSource=${provider}></lr-file-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="n0"]')), 'first ranged row', { timeout: 20000 });
  expect(await el.revealSourceKey('n99')).to.equal(true);
  (el.shadowRoot!.querySelector('[role="tree"]') as HTMLElement).style.blockSize = '20000px';
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as import('../../layout/virtual-list/virtual-list.class.js').LyraVirtualList;
  list.scrollToIndex(199, { align: 'start', behavior: 'auto' });
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await list.updateComplete;
  await waitUntil(() => physical === 0, 'ranged reads settled', { timeout: 20000 });
  const mounted = el.shadowRoot!.querySelectorAll('[part~="source-row"]').length;
  expect(mounted).to.equal(301);
  expect(el.shadowRoot!.querySelector('[data-source-key="n99"]') !== null).to.equal(true);
  expect(largest).to.be.at.most(100);
  expect(peak).to.be.at.most(2);
  expect(reads).to.be.lessThan(20);
  const retained = (el as unknown as { hierarchy: { window: { pages: Map<number, { slots?: unknown[] }> }; focused?: unknown } }).hierarchy;
  const retainedRows = [...retained.window.pages.values()].reduce((sum, page) => sum + (page.slots?.length ?? 0), 0) + (retained.focused ? 1 : 0);
  expect(retained.window.pages.size).to.equal(4);
  expect(retainedRows).to.be.at.most(401);
  expect(await el.revealSourceKey('n999999')).to.equal(true);
  recordScaleMeasurement('lr-file-tree', '1000000 ranged rows unaligned window and reveal', { rangeReads: reads, rowsRead: rows, peakPhysicalReads: peak, mountedRows: mounted, retainedRows });
});
