import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraHierarchyQuery, LyraHierarchySource } from '../../../data-sources.js';
import type { LyraTree } from '../tree/tree.class.js';
import type { FileTreeNode, LyraFileTree } from './file-tree.class.js';
import './file-tree.js';

const nested: readonly FileTreeNode[] = [{ path: 'src', kind: 'directory', children: [
  { path: 'src/deep', kind: 'directory', children: [{ path: 'src/deep/file.ts', mimeType: 'text/typescript' }] },
] }];

function source(actions: string[]): LyraHierarchySource<FileTreeNode, LyraHierarchyQuery> {
  return { revision: 'remote', project(request) {
    actions.push(request.action.type);
    return Promise.resolve({ state: 'remote', total: 1, rows: { count: 1,
      keyAt: (_index: number) => 'remote.ts', indexOfKey: (key: string | number) => key === 'remote.ts' ? 0 : -1,
      itemAt: (index: number) => ({ key: 'remote.ts', value: { path: 'remote.ts', kind: 'file' as const }, parentKey: null,
        level: 1, position: index + 1, setSize: 1, childCount: 0, expanded: false, selected: false }),
    }, ...(request.action.type === 'reveal' ? { focusIndex: 0 } : {}) });
  } };
}

it('retains a root directory name and MIME metadata while ignoring a late response for a removed path', async () => {
  const element = await fixture<LyraFileTree>(html`<lr-file-tree .nodes=${[
    { path: '/', kind: 'directory' }, { path: 'module.ts', mimeType: 'text/typescript' },
  ]}></lr-file-tree>`);
  const tree = element.shadowRoot!.querySelector<LyraTree>('lr-tree')!;
  await tree.updateComplete;
  expect(tree.data.map(node => node.label)).to.deep.equal(['/', 'module.ts']);
  expect(element.nodes[1]?.mimeType).to.equal('text/typescript');
  const before = element.nodes;
  element.setChildren('removed-directory', [{ path: 'removed-directory/late.ts' }]);
  await element.updateComplete;
  expect(element.nodes === before).to.equal(true);
  expect(tree.data.map(node => node.id)).to.deep.equal(['/', 'module.ts']);
});

it('revokes a nested reveal when disconnected, then reveals the path after reconnect without stealing outside focus', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><button>Outside</button><lr-file-tree .nodes=${nested}></lr-file-tree></div>`);
  const element = wrapper.querySelector<LyraFileTree>('lr-file-tree')!;
  const outside = wrapper.querySelector('button')!;
  await focusByKeyboard(outside);
  const pending = element.revealPath('src/deep/file.ts');
  element.remove();
  expect(await pending).to.equal(false);
  expect(document.activeElement === outside).to.equal(true);
  wrapper.append(element);
  await element.updateComplete;
  expect(await element.revealPath('src/deep/file.ts')).to.equal(true);
  const tree = element.shadowRoot!.querySelector<LyraTree>('lr-tree')!;
  await tree.updateComplete;
  const root = tree.querySelector('lr-tree-item')!;
  const branch = root.shadowRoot!.querySelector('lr-tree-item')!;
  const target = branch.shadowRoot!.querySelector('lr-tree-item')!;
  expect(target.item?.id).to.equal('src/deep/file.ts');
  expect(target.tabIndex).to.equal(0);
  expect(document.activeElement === outside).to.equal(false);
});

it('does not report an obsolete reveal as successful after its path is replaced during expansion', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><button>Outside</button><lr-file-tree .nodes=${nested}></lr-file-tree></div>`);
  const element = wrapper.querySelector<LyraFileTree>('lr-file-tree')!;
  const outside = wrapper.querySelector('button')!;
  await focusByKeyboard(outside);
  const pending = element.revealPath('src/deep/file.ts');
  element.nodes = [{ path: 'replacement.ts' }];
  expect(await pending).to.equal(false);
  expect(document.activeElement === outside).to.equal(true);
  await element.updateComplete;
  const tree = element.shadowRoot!.querySelector<LyraTree>('lr-tree')!;
  await tree.updateComplete;
  expect(tree.data.map(node => node.id)).to.deep.equal(['replacement.ts']);
  expect(await element.revealPath('replacement.ts')).to.equal(true);
  expect(document.activeElement === outside).to.equal(false);
});

it('settles simultaneous reveals on disconnect and permits concurrent current reveals after reconnect', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><button>Outside</button><lr-file-tree .nodes=${[
    ...nested, { path: 'docs', kind: 'directory', children: [{ path: 'docs/readme.md' }] },
  ]}></lr-file-tree></div>`);
  const element = wrapper.querySelector<LyraFileTree>('lr-file-tree')!;
  const outside = wrapper.querySelector('button')!;
  await focusByKeyboard(outside);
  const pending = [element.revealPath('src/deep/file.ts'), element.revealPath('docs/readme.md')];
  element.remove();
  expect(await Promise.all(pending)).to.deep.equal([false, false]);
  expect(document.activeElement === outside).to.equal(true);
  expect(await element.revealPath('src/deep/file.ts')).to.equal(false);
  wrapper.append(element);
  await element.updateComplete;
  const tree = element.shadowRoot!.querySelector<LyraTree>('lr-tree')!;
  await tree.updateComplete;
  expect(await Promise.all([
    element.revealPath('src/deep/file.ts'), element.revealPath('docs/readme.md'),
  ])).to.deep.equal([true, true]);
  expect(document.activeElement === outside).to.equal(false);
});

it('completes concurrent sibling and same-path reveals through initially collapsed shared ancestors', async () => {
  const element = await fixture<LyraFileTree>(html`<lr-file-tree .nodes=${[
    { path: 'src', kind: 'directory', children: [
      { path: 'src/deep', kind: 'directory', children: [{ path: 'src/deep/one.ts' }, { path: 'src/deep/two.ts' }] },
    ] },
  ]}></lr-file-tree>`);
  const tree = element.shadowRoot!.querySelector<LyraTree>('lr-tree')!;
  await tree.updateComplete;
  const root = tree.querySelector('lr-tree-item')!;
  expect(root.expanded).to.equal(false);
  expect(root.shadowRoot!.querySelectorAll('lr-tree-item').length).to.equal(0);
  expect(await Promise.all([
    element.revealPath('src/deep/one.ts'),
    element.revealPath('src/deep/two.ts'),
    element.revealPath('src/deep/one.ts'),
  ])).to.deep.equal([true, true, true]);
  await tree.updateComplete;
  const branch = root.shadowRoot!.querySelector('lr-tree-item')!;
  expect(root.expanded).to.equal(true);
  expect(branch.expanded).to.equal(true);
  expect([...branch.shadowRoot!.querySelectorAll('lr-tree-item')].map(item => item.item?.id)).to.deep.equal([
    'src/deep/one.ts', 'src/deep/two.ts',
  ]);
  const target = branch.shadowRoot!.querySelector('lr-tree-item')!;
  expect(target.matches(':focus')).to.equal(true);
  expect(target.tabIndex).to.equal(0);
});

it('revokes an over-budget legacy reveal when a provider takes ownership and leaves bulk expansion source-owned', async () => {
  const many: readonly FileTreeNode[] = [{ path: 'src', kind: 'directory', children: [
    nested[0]!.children![0]!, ...Array.from({ length: 1100 }, (_, index) => ({ path: `src/other-${index}.ts` })),
  ] }];
  const element = await fixture<LyraFileTree>(html`<lr-file-tree style="inline-size:320px;block-size:240px" .nodes=${many}></lr-file-tree>`);
  const actions: string[] = [];
  const pending = element.revealPath('src/deep/file.ts');
  element.treeSource = source(actions);
  expect(await pending).to.equal(false);
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[data-source-key="remote.ts"]').length === 1, 'source row missing');
  const before = [...actions];
  expect(element.expandAll()).to.equal(undefined);
  element.collapseAll();
  expect(actions).to.deep.equal(before);
  expect(await element.revealPath('remote.ts')).to.equal(true);
  expect(actions).to.include('reveal');
  expect(element.shadowRoot!.querySelector('[data-source-key="remote.ts"]')?.getAttribute('aria-level')).to.equal('1');
  element.treeSource = undefined;
  element.nodes = [{ path: 'restored.ts' }];
  await element.updateComplete;
  expect(await element.revealPath('restored.ts')).to.equal(true);
});
