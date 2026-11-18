import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './tree.js';
import type { LyraTree, LyraTreeNodeData, TreeSource } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

function node(parent: LyraTree | LyraTreeItem, id: string): LyraTreeItem {
  const items = 'childItems' in parent
    ? parent.childItems()
    : [...parent.querySelectorAll<LyraTreeItem>(':scope > lr-tree-item')];
  const item = items.find((candidate) => candidate.nodeId === id);
  if (!item) throw new Error(`Missing tree item ${id}`);
  return item;
}

const leaf: LyraTreeNodeData = { id: 'leaf', label: 'Leaf' };
const branch: LyraTreeNodeData = { id: 'branch', label: 'Branch', expanded: true, children: [leaf] };
const root: LyraTreeNodeData = { id: 'root', label: 'Root', expanded: true, children: [branch] };

function summaries(tree: LyraTree) {
  const events: CustomEvent<Readonly<{ expanded: boolean; nodeIds: readonly string[] }>>[] = [];
  tree.addEventListener('lr-bulk-toggle', (event) => {
    if (event.target === tree) events.push(event as typeof events[number]);
  });
  return events;
}

describe('tree data expansion', () => {
  it('opens authored branches passively and honors only a changed explicit boolean on refresh', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline" data-lr-motion="reduce"></lr-tree>`);
    const events: string[] = [];
    for (const name of ['lr-expand', 'lr-node-toggle', 'lr-after-expand']) {
      tree.addEventListener(name, () => events.push(name));
    }
    tree.data = [root];
    await tree.updateComplete;
    const parent = node(tree, 'root');
    const child = node(parent, 'branch');
    expect(child.getAttribute('aria-expanded')).to.equal('true');
    expect(node(child, 'leaf').nodeLabel).to.equal('Leaf');
    expect(events).to.deep.equal([]);

    child.collapse();
    tree.data = [{ ...root, children: [{ ...branch, label: 'Renamed branch' }] }];
    await tree.updateComplete;
    expect(node(parent, 'branch') === child).to.equal(true);
    expect(child.expanded).to.equal(false);

    tree.data = [{ ...root, children: [{ ...branch, expanded: false }] }];
    await tree.updateComplete;
    expect(child.expanded).to.equal(false);
    child.expand();
    tree.data = [{ ...root, children: [{ ...branch, expanded: false, label: 'Still explicitly closed' }] }];
    await tree.updateComplete;
    expect(child.expanded).to.equal(true);

    tree.data = [{ ...root, children: [{ ...branch, expanded: undefined }] }];
    await tree.updateComplete;
    expect(child.expanded).to.equal(true);
    tree.data = [{ ...root, children: [{ ...branch, expanded: false }] }];
    await tree.updateComplete;
    expect(child.expanded).to.equal(false);
    tree.data = [root];
    await tree.updateComplete;
    expect(child.expanded).to.equal(true);
    expect(branch.expanded).to.equal(true);
  });

  it('retains direct expansion writes through remount, reparenting and reconnect, then forgets removed IDs', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline" data-lr-motion="reduce"></lr-tree>`);
    const other: LyraTreeNodeData = { id: 'other', label: 'Other' };
    tree.data = [root, other];
    await tree.updateComplete;
    const parent = node(tree, 'root');
    const child = node(parent, 'branch');
    child.expanded = false;

    parent.collapse();
    await tree.updateComplete;
    await waitUntil(() => parent.childItems().length === 0, 'collapsed descendants are unmounted');
    parent.expand();
    await tree.updateComplete;
    expect(node(parent, 'branch') === child).to.equal(false);
    expect(node(parent, 'branch').expanded).to.equal(false);

    const moved = [{ ...root, children: [leaf] }, { ...other, expanded: true, children: [{ ...branch, children: [{ id: 'new-leaf', label: 'New leaf' }] }] }];
    tree.data = moved;
    await tree.updateComplete;
    const destination = node(tree, 'other');
    expect(node(destination, 'branch').expanded).to.equal(false);

    const host = tree.parentNode!;
    tree.remove();
    host.appendChild(tree);
    await tree.updateComplete;
    expect(node(node(tree, 'other'), 'branch').expanded).to.equal(false);

    tree.data = [];
    tree.data = moved;
    await tree.updateComplete;
    expect(node(node(tree, 'other'), 'branch').expanded).to.equal(true);
  });

  it('summarizes hidden and mounted bulk changes once and preserves mounted row events', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline" data-lr-motion="reduce"></lr-tree>`);
    const events = summaries(tree);
    const rowChanges: string[] = [];
    tree.addEventListener('lr-node-toggle', (event) => rowChanges.push(event.detail.nodeId));
    tree.data = [
      { ...root, expanded: false },
      { id: 'disabled', label: 'Disabled', disabled: true, expanded: true, children: [{ id: 'disabled-leaf', label: 'Leaf' }] },
      { id: 'standalone', label: 'Standalone', expanded: true },
    ];
    await tree.updateComplete;
    const parent = node(tree, 'root');
    expect(parent.childItems().length).to.equal(0);
    expect(node(tree, 'standalone').expanded).to.equal(false);
    expect(node(tree, 'disabled').expanded).to.equal(false);

    await tree.collapseAll();
    expect(events.map((event) => event.detail)).to.deep.equal([{ expanded: false, nodeIds: ['branch'] }]);
    expect(rowChanges).to.deep.equal([]);
    expect(events[0]!.bubbles && events[0]!.composed).to.equal(true);
    expect(Object.isFrozen(events[0]!.detail) && Object.isFrozen(events[0]!.detail.nodeIds)).to.equal(true);
    await tree.collapseAll();
    expect(events).to.have.length(1);

    await tree.expandAll();
    expect(events.map(({ detail }) => ({ expanded: detail.expanded, nodeIds: [...detail.nodeIds].sort() }))).to.deep.equal([
      { expanded: false, nodeIds: ['branch'] },
      { expanded: true, nodeIds: ['branch', 'root'] },
    ]);
    expect(rowChanges).to.deep.equal(['root', 'branch']);
    await tree.expandAll();
    expect(events).to.have.length(2);
    expect(node(parent, 'branch').expanded).to.equal(true);
  });

  it('supersedes an in-progress expansion and keeps the summary of the first effective collapse', async () => {
    const data = [{ ...root, expanded: false, children: [{ ...branch, expanded: false }] }];
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline" data-lr-motion="reduce" .data=${data}></lr-tree>`);
    const events = summaries(tree);
    const row = node(tree, 'root');

    const expansion = tree.expandAll();
    expect(row.expanded).to.equal(true);
    await Promise.all([expansion, tree.collapseAll(), tree.collapseAll()]);
    expect(row.expanded).to.equal(false);
    expect(events.map((event) => event.detail)).to.deep.equal([{ expanded: false, nodeIds: ['root'] }]);

    row.expand();
    await tree.updateComplete;
    expect(node(row, 'branch').expanded).to.equal(false);
  });

  it('requests a visible authored lazy seed and invalidates its pending intent on bulk collapse', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline" data-lr-motion="reduce"></lr-tree>`);
    const events = summaries(tree);
    const requests: number[] = [];
    tree.addEventListener('lr-lazy-load', (event) => requests.push(event.detail.generation));
    const lazy: LyraTreeNodeData = { id: 'lazy', label: 'Lazy', lazy: true, expanded: true };
    tree.data = [lazy];
    await tree.updateComplete;
    const row = node(tree, 'lazy');
    expect(requests).to.have.length(1);
    expect(row.loading).to.equal(true);
    expect(row.expanded).to.equal(false);
    await tree.expandAll();
    expect(requests).to.have.length(1);
    expect(events).to.have.length(0);

    await tree.collapseAll();
    expect(row.loading).to.equal(false);
    expect(events).to.have.length(0);
    tree.data = [{ ...lazy, children: [leaf] }];
    await tree.updateComplete;
    expect(row.expanded).to.equal(false);
    expect(requests).to.have.length(1);

    await tree.expandAll();
    expect(row.expanded).to.equal(true);
    expect(events.map((event) => event.detail)).to.deep.equal([{ expanded: true, nodeIds: ['lazy'] }]);
    expect(requests).to.have.length(1);
  });

  it('retries a pending authored lazy seed only once the row reconnects', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline"></lr-tree>`);
    const requests: Array<{ generation: number; connected: boolean }> = [];
    tree.addEventListener('lr-lazy-load', ({ detail }) => {
      requests.push({ generation: detail.generation, connected: detail.item.isConnected });
    });
    tree.data = [{ id: 'lazy', label: 'Lazy', lazy: true, expanded: true }];
    await tree.updateComplete;
    const row = node(tree, 'lazy');
    expect(requests.map((request) => request.connected)).to.deep.equal([true]);
    expect(row.loading).to.equal(true);

    const host = tree.parentNode!;
    tree.remove();
    await row.updateComplete;
    expect(row.loading).to.equal(false);
    expect(requests).to.have.length(1);

    host.appendChild(tree);
    const reconnectUpdate = row.updateComplete;
    await tree.updateComplete;
    expect(await reconnectUpdate).to.equal(true);
    expect(node(tree, 'lazy') === row).to.equal(true);
    expect(row.expanded).to.equal(false);
    expect(row.loading).to.equal(true);
    expect(row.getAttribute('aria-busy')).to.equal('true');
    expect(requests.map((request) => request.connected)).to.deep.equal([true, true]);
    expect(requests[1]!.generation).to.be.greaterThan(requests[0]!.generation);
  });

  it('can retry a rejected seed and treats collapse during response handling as cancellation', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline" data-lr-motion="reduce"></lr-tree>`);
    const events = summaries(tree);
    const requests: number[] = [];
    const rowChanges: string[] = [];
    tree.addEventListener('lr-lazy-load', (event) => requests.push(event.detail.generation));
    tree.addEventListener('lr-node-toggle', (event) => rowChanges.push(event.detail.nodeId));
    const lazy: LyraTreeNodeData = { id: 'lazy', label: 'Lazy', lazy: true, expanded: true };
    tree.data = [lazy];
    await tree.updateComplete;
    const row = node(tree, 'lazy');

    tree.data = [{ ...lazy, lazy: false }];
    await tree.updateComplete;
    expect(row.loading).to.equal(false);
    expect(row.expanded).to.equal(false);
    tree.data = [lazy];
    await tree.updateComplete;
    expect(requests).to.have.length(1);
    row.expand();
    expect(requests).to.have.length(2);
    expect(requests[1]).to.be.greaterThan(requests[0]!);

    tree.data = [{ ...lazy, expanded: false }];
    await tree.updateComplete;
    expect(row.loading).to.equal(false);
    tree.data = [lazy];
    await tree.updateComplete;
    expect(requests).to.have.length(3);
    expect(row.loading).to.equal(true);

    let collapse: Promise<void> | undefined;
    tree.addEventListener('lr-lazy-change', (event) => {
      if (!event.detail.loading) collapse = tree.collapseAll();
    }, { once: true });
    tree.data = [{ ...lazy, children: [leaf] }];
    await tree.updateComplete;
    await collapse;
    expect(row.expanded).to.equal(false);
    expect(rowChanges).to.deep.equal([]);
    expect(events).to.have.length(0);
  });

  it('keeps legacy disclosure during provider ownership without emitting a bulk summary', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline" .data=${[root]}></lr-tree>`);
    const events = summaries(tree);
    const provider: TreeSource = {
      revision: 1,
      async project() {
        return {
          state: 'initial', total: 0,
          rows: { count: 0, async read() { return []; }, async indexOfKey() { return null; } },
        };
      },
    };
    tree.treeSource = provider;
    await tree.updateComplete;
    expect(tree.querySelectorAll('lr-tree-item')).to.have.length(0);
    await tree.expandAll();
    await tree.collapseAll();
    expect(events).to.have.length(0);

    tree.treeSource = undefined;
    await tree.updateComplete;
    expect(node(node(tree, 'root'), 'branch').expanded).to.equal(true);
  });

  it('cancels pending declarative lazy expansion during bulk collapse', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline"><lr-tree-item label="Lazy" lazy></lr-tree-item></lr-tree>`);
    const row = tree.querySelector<LyraTreeItem>('lr-tree-item')!;
    const events = summaries(tree);
    row.expand();
    expect(row.loading).to.equal(true);
    await tree.collapseAll();
    expect(row.loading).to.equal(false);
    const child = document.createElement('lr-tree-item');
    child.textContent = 'Late child';
    row.append(child);
    await tree.updateComplete;
    expect(row.expanded).to.equal(false);
    expect(events).to.have.length(0);
  });

  it('hands the roving tab stop back to an author-closed ancestor', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline" .data=${[root]}></lr-tree>`);
    const parent = node(tree, 'root');
    const child = node(parent, 'branch');
    await focusByKeyboard(child, tree);
    expect(child.tabIndex).to.equal(0);

    tree.data = [{ ...root, expanded: false }];
    await tree.updateComplete;
    expect(parent.getAttribute('aria-expanded')).to.equal('false');
    expect(parent.tabIndex).to.equal(0);
    expect(document.activeElement === parent).to.equal(true);
  });

  it('accepts a null-prototype data record and ignores inherited, accessor-backed and malformed expansion fields', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree label="Outline"></lr-tree>`);
    let reads = 0;
    const inherited = Object.assign(Object.create({ expanded: true }), { id: 'inherited', label: 'Inherited', children: [leaf] }) as LyraTreeNodeData;
    const accessor = { id: 'accessor', label: 'Accessor', children: [{ ...leaf, id: 'second-leaf' }], get expanded() { reads++; return true; } };
    const malformed = { id: 'malformed', label: 'Malformed', expanded: 'true', children: [{ ...leaf, id: 'third-leaf' }] };
    const nullPrototype = Object.setPrototypeOf({
      id: 'plain-data', label: 'Data', expanded: true, children: [{ ...leaf, id: 'fourth-leaf' }],
    }, null) as LyraTreeNodeData;
    tree.data = [inherited, accessor, malformed as unknown as LyraTreeNodeData, nullPrototype];
    await tree.updateComplete;
    expect(node(tree, 'inherited').expanded).to.equal(false);
    expect(node(tree, 'accessor').expanded).to.equal(false);
    expect(node(tree, 'malformed').expanded).to.equal(false);
    expect(node(tree, 'plain-data').expanded).to.equal(true);
    expect(tree.data.map((item) => Object.hasOwn(item, 'expanded'))).to.deep.equal([false, false, false, true]);
    expect(reads).to.equal(0);
  });
});
