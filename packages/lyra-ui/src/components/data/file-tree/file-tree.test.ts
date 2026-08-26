import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './file-tree.js';
import type { LyraFileTree, FileTreeNode } from './file-tree.js';

const nodes: FileTreeNode[] = [
  {
    path: 'src',
    kind: 'directory',
    children: [
      { path: 'src/app.ts', gitStatus: 'modified', additions: 4, deletions: 1 },
      { path: 'src/util.ts', gitStatus: 'added' },
    ],
  },
  { path: 'README.md' },
];

function required<T>(value: T | undefined, context: string): T {
  if (value === undefined) throw new Error(`Missing ${context}`);
  return value;
}

describe('lr-file-tree', () => {
  it('renders a row per file/directory, deepest-first order preserved', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    expect(tree.data.map((i: { id: string }) => i.id)).to.deep.equal(['src', 'README.md']);
  });

  it('renders a git-status badge and diffstat for a file with gitStatus', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    const appItem = required(
      required(tree.data[0], 'root file-tree row').children?.find(
        (i: { id: string }) => i.id === 'src/app.ts',
      ),
      'src/app.ts row',
    );
    expect(required(appItem.badges?.[0], 'git-status badge').text).to.equal('M');
    expect(required(appItem.badges?.[0], 'git-status badge').tone).to.equal('brand');
    expect(appItem.description).to.include('+4');
    expect(appItem.description).to.include('-1');
  });

  it('formats visible diff counts with the effective locale', async () => {
    const el = (await fixture(html`<lr-file-tree lang="ar"></lr-file-tree>`)) as LyraFileTree;
    el.nodes = [{ path: 'changed.ts', additions: 1234, deletions: 56 }];
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    const description = required(tree.data[0], 'localized file row').description as string;

    expect(description).to.include(new Intl.NumberFormat('ar').format(1234));
    expect(description).to.include(new Intl.NumberFormat('ar').format(56));
  });

  it('normalizes diff metadata once to finite nonnegative integers', async () => {
    const el = await fixture<LyraFileTree>(html`<lr-file-tree></lr-file-tree>`);
    el.nodes = [{ path: 'changed.ts', additions: Number.NaN, deletions: Number.POSITIVE_INFINITY }];
    await el.updateComplete;
    const description = required(
      el.shadowRoot!.querySelector('lr-tree')!.data[0],
      'normalized file row',
    ).description as string;

    expect(description).to.include('+0');
    expect(description).to.include('-0');
    expect(description).to.not.include('NaN');
    expect(description).to.not.include('∞');
  });

  it('clone-owns a frozen, duplicate-safe, cycle/depth-bounded node snapshot', async () => {
    const duplicate = { path: 'root', name: 'ignored duplicate' };
    const root: Record<string, unknown> = { path: 'root', name: 'Root', kind: 'directory' };
    root['children'] = [root];
    const deepRoot: Record<string, unknown> = { path: 'deep-0', kind: 'directory' };
    let cursor = deepRoot;
    for (let depth = 1; depth < 200; depth++) {
      const child: Record<string, unknown> = { path: `deep-${depth}`, kind: 'directory' };
      cursor['children'] = [child];
      cursor = child;
    }
    const el = await fixture<LyraFileTree>(html`<lr-file-tree></lr-file-tree>`);
    el.nodes = [{ path: '' }, { path: '   ' }, root, duplicate, deepRoot] as never;
    root['name'] = 'Mutated';
    await el.updateComplete;

    expect(el.nodes.map((node) => node.path)).to.deep.equal(['root', 'deep-0']);
    expect(el.nodes[0]!.name).to.equal('Root');
    expect(el.nodes[0]!.children).to.deep.equal([]);
    expect(Object.isFrozen(el.nodes)).to.be.true;
    expect(Object.isFrozen(el.nodes[0]!)).to.be.true;
    let depth = 0;
    let node: FileTreeNode | undefined = el.nodes[1];
    while (node) {
      depth++;
      node = node.children?.[0];
    }
    expect(depth).to.be.at.most(65);
  });

  it('inspects only the first 10,000 source positions even when sparse entries are invalid', async () => {
    const sparse = new Array<FileTreeNode>(10_001);
    sparse[9_999] = { path: 'inside.ts' };
    sparse[10_000] = { path: 'outside.ts' };
    const el = await fixture<LyraFileTree>(html`<lr-file-tree></lr-file-tree>`);

    el.nodes = sparse;

    expect(el.nodes.map((node) => node.path)).to.deep.equal(['inside.ts']);
    expect(Object.isFrozen(el.nodes)).to.equal(true);
  });

  it('forwards a live host aria-label to the internal tree with author precedence', async () => {
    const el = (await fixture(
      html`<lr-file-tree label="Files" aria-label="Workspace files"></lr-file-tree>`,
    )) as LyraFileTree;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    expect(tree.label).to.equal('Workspace files');

    el.setAttribute('aria-label', 'Changed files');
    await el.updateComplete;
    expect(tree.label).to.equal('Changed files');

    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(tree.label).to.equal('');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(tree.label).to.equal('Files');
  });

  it('treats an explicitly empty label as a real override, distinct from an omitted one', async () => {
    const explicit = (await fixture(html`<lr-file-tree label=""></lr-file-tree>`)) as LyraFileTree;
    const explicitTree = explicit.shadowRoot!.querySelector('lr-tree')!;
    expect(explicitTree.label).to.equal('');

    const omitted = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    const omittedTree = omitted.shadowRoot!.querySelector('lr-tree')!;
    expect(omittedTree.label).to.equal('Files');
  });

  it('renders a per-instance .strings override in the internal tree accessible name', async () => {
    const el = (await fixture(
      html`<lr-file-tree .strings=${{ fileTreeLabel: 'Localized file tree' }}></lr-file-tree>`,
    )) as LyraFileTree;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    await tree.updateComplete;

    expect(
      tree.shadowRoot!.querySelectorAll(
        '[part~="base"][role="tree"][aria-label="Localized file tree"]',
      ).length,
    ).to.equal(1);
  });

  it('marks the selected path in the derived tree data', async () => {
    const el = (await fixture(html`<lr-file-tree selected-path="README.md"></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;

    expect(required(tree.data[0], 'first file-tree row').selected).to.be.false;
    expect(required(tree.data[1], 'second file-tree row').selected).to.be.true;
  });

  it('represents a lazy loading placeholder as disabled status content, not a selectable stop', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = [{ path: 'lazy-dir', kind: 'directory', hasChildren: true }];
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    const placeholder = required(
      required(tree.data[0], 'lazy directory row').children?.[0],
      'lazy loading placeholder',
    );

    expect(placeholder.disabled).to.be.true;
  });

  it('emits lr-file-select when a file row is activated', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-file-select');
    el.shadowRoot!.querySelector('lr-tree')!.dispatchEvent(
      new CustomEvent('lr-node-select', { detail: { nodeId: 'README.md' }, bubbles: true, composed: true }),
    );
    const event = (await listener) as CustomEvent<{ filePath: string }>;
    expect(event.detail.filePath).to.equal('README.md');
  });

  it('selects a legitimate file whose id contains the text " loading"', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = [{ path: 'src/file loading states.ts' }];
    await el.updateComplete;
    let selectedPath: string | undefined;
    el.addEventListener('lr-file-select', (event) => {
      selectedPath = event.detail.filePath;
    });

    el.shadowRoot!.querySelector('lr-tree')!.dispatchEvent(
      new CustomEvent('lr-node-select', {
        detail: { nodeId: 'src/file loading states.ts' },
        bubbles: true,
        composed: true,
      }),
    );

    expect(selectedPath).to.equal('src/file loading states.ts');
  });

  it('consumes the internal tree selection event before emitting the wrapper event', async () => {
    const wrapper = await fixture(html`<div><lr-file-tree></lr-file-tree></div>`);
    const el = wrapper.querySelector('lr-file-tree') as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    let internalEvents = 0;
    let wrapperEvents = 0;
    wrapper.addEventListener('lr-node-select', () => internalEvents++);
    wrapper.addEventListener('lr-file-select', () => wrapperEvents++);

    el.shadowRoot!.querySelector('lr-tree')!.dispatchEvent(
      new CustomEvent('lr-node-select', {
        detail: { nodeId: 'README.md' },
        bubbles: true,
        composed: true,
      }),
    );

    expect(internalEvents).to.equal(0);
    expect(wrapperEvents).to.equal(1);
  });

  it('emits lr-file-open on a second select of an already-selected file (keyboard-open parity)', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    el.selectedPath = 'README.md';
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-file-open');
    el.shadowRoot!.querySelector('lr-tree')!.dispatchEvent(
      new CustomEvent('lr-node-select', { detail: { nodeId: 'README.md' }, bubbles: true, composed: true }),
    );
    const event = (await listener) as CustomEvent<{ filePath: string }>;
    expect(event.detail.filePath).to.equal('README.md');
  });

  it('emits lr-load-children exactly once when a lazy (hasChildren, no children) directory expands', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = [{ path: 'lazy-dir', kind: 'directory', hasChildren: true }];
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-load-children');
    el.shadowRoot!.querySelector('lr-tree')!.dispatchEvent(
      new CustomEvent('lr-node-toggle', { detail: { nodeId: 'lazy-dir', expanded: true }, bubbles: true, composed: true }),
    );
    const event = (await listener) as CustomEvent<{ filePath: string }>;
    expect(event.detail.filePath).to.equal('lazy-dir');
  });

  it('setChildren() fulfills a lazy directory in place without a nodes reassignment from the host', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = [{ path: 'lazy-dir', kind: 'directory', hasChildren: true }];
    await el.updateComplete;
    el.setChildren('lazy-dir', [{ path: 'lazy-dir/file.ts' }]);
    await el.updateComplete;
    const tree = el.shadowRoot!.querySelector('lr-tree')!;
    const dirItem = tree.data.find((i: { id: string }) => i.id === 'lazy-dir')!;
    expect(dirItem.children!.map((c: { id: string }) => c.id)).to.deep.equal(['lazy-dir/file.ts']);
  });

  it('revealPath() expands ancestors and resolves true for a real nested path', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    const found = await el.revealPath('src/app.ts');
    expect(found).to.be.true;
  });

  it('revealPath() resolves false for an absent path', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    expect(await el.revealPath('does/not/exist')).to.be.false;
  });

  it('is accessible with a nested, git-status-decorated tree', async () => {
    const el = (await fixture(html`<lr-file-tree></lr-file-tree>`)) as LyraFileTree;
    el.nodes = nodes;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

// -- expandAll/collapseAll delegation to the embedded tree ------------------

it('delegates expandAll() and collapseAll() to the embedded lr-tree', async () => {
  const el = (await fixture(html`<lr-file-tree .nodes=${nodes}></lr-file-tree>`)) as LyraFileTree;
  await el.updateComplete;
  await el.expandAll();
  await el.updateComplete;
  const expanded = [...el.shadowRoot!.querySelectorAll('[aria-expanded]')].filter(
    (n) => n.getAttribute('aria-expanded') === 'true',
  );
  expect(expanded.length, 'expandAll opens every expandable row').to.be.greaterThan(0);

  el.collapseAll();
  await el.updateComplete;
  const stillOpen = [...el.shadowRoot!.querySelectorAll('[aria-expanded]')].filter(
    (n) => n.getAttribute('aria-expanded') === 'true',
  );
  expect(stillOpen.length).to.equal(0);
});

it('fails hostile array descriptors and record getters closed while retaining later valid siblings', async () => {
  const el = await fixture<LyraFileTree>(html`<lr-file-tree></lr-file-tree>`);
  const hostileLength = new Proxy([] as FileTreeNode[], {
    getOwnPropertyDescriptor(target, property) {
      if (property === 'length') throw new Error('hostile length descriptor');
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  el.nodes = hostileLength;
  expect(el.nodes).to.deep.equal([]);

  const hostileRecord = new Proxy({ path: 'unreadable.ts' }, {
    get(target, property, receiver) {
      if (property === 'path') throw new Error('hostile path getter');
      return Reflect.get(target, property, receiver);
    },
  });
  const hostileEntryDescriptor = new Proxy(
    [{ path: 'skipped.ts' }, hostileRecord, { path: 'retained.ts' }],
    {
      getOwnPropertyDescriptor(target, property) {
        if (property === '0') throw new Error('hostile entry descriptor');
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    },
  );
  el.nodes = hostileEntryDescriptor;
  await el.updateComplete;

  expect(el.nodes.map((node) => node.path)).to.deep.equal(['retained.ts']);
  expect(el.shadowRoot!.querySelector('lr-tree')!.data.map((node: { id: string }) => node.id))
    .to.deep.equal(['retained.ts']);
});
