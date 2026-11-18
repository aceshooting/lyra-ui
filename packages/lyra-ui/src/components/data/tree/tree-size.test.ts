import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { forceCoarsePointer } from '../../../../test/coarse-pointer-media.js';
import type { LyraHierarchySource, LyraHierarchyQuery } from '../../../data-sources.js';
import type { LyraSize } from '../../../internal/variants.js';
import '../../forms/icon-button/icon-button.js';
import type { LyraIconButton } from '../../forms/icon-button/icon-button.class.js';
import './tree.js';
import type { LyraTree, LyraTreeNodeData } from './tree.class.js';
import type { LyraTreeItem } from './tree-item.class.js';

const data: readonly LyraTreeNodeData[] = [
  { id: 'branch', label: 'Branch', children: [{ id: 'child', label: 'Child' }] },
  { id: 'leaf', label: 'Leaf' },
];

function part(item: HTMLElement, name: string): HTMLElement {
  return item.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
}

function box(element: HTMLElement): [number, number] {
  const { width, height } = element.getBoundingClientRect();
  return [width, height];
}

function expectControlSize(item: LyraTreeItem, pixels: number): void {
  expect(box(part(item, 'toggle')), 'disclosure or placeholder').to.deep.equal([pixels, pixels]);
  expect(box(part(item, 'checkbox')), 'selection checkbox').to.deep.equal([pixels, pixels]);
}

describe('lr-tree optional size', () => {
  it('reflects the shared ladder, preserves the unset geometry, and normalizes unsupported values', async () => {
    const tree = await fixture<LyraTree & { size: LyraSize | undefined }>(html`
      <lr-tree label="Outline" selection="multiple" .data=${data}></lr-tree>
    `);
    const branch = tree.querySelector<LyraTreeItem>('lr-tree-item')!;
    await branch.updateComplete;
    expect(tree.size).to.equal(undefined);
    expect(tree.hasAttribute('size')).to.equal(false);
    expect(box(part(branch, 'row'))[1]).to.equal(44);
    expectControlSize(branch, 36);

    const tiers: readonly (readonly [LyraSize, number, number])[] = [
      ['2xs', 24, 24], ['xs', 24, 24], ['s', 32, 28], ['m', 36, 32],
      ['l', 40, 36], ['xl', 56, 52], ['small', 32, 28],
      ['medium', 36, 32], ['large', 40, 36],
    ];
    for (const [size, row, control] of tiers) {
      tree.size = size;
      await tree.updateComplete;
      expect(tree.getAttribute('size')).to.equal(size);
      expect(box(part(branch, 'row'))[1], `row at ${size}`).to.equal(row);
      expectControlSize(branch, control);
    }

    tree.setAttribute('size', 'unsupported');
    await tree.updateComplete;
    expect(tree.size).to.equal(undefined);
    expect(tree.hasAttribute('size')).to.equal(false);
    expect(box(part(branch, 'row'))[1]).to.equal(44);
    tree.setAttribute('size', 'small');
    await tree.updateComplete;
    expect(tree.size).to.equal('small');
    expect(box(part(branch, 'row'))[1]).to.equal(32);
    tree.size = 'unsupported' as LyraSize;
    await tree.updateComplete;
    expect(tree.size).to.equal(undefined);
    expect(tree.hasAttribute('size')).to.equal(false);
    expectControlSize(branch, 36);

    tree.setAttribute('size', 's');
    await tree.updateComplete;
    tree.removeAttribute('size');
    await tree.updateComplete;
    expect(tree.size).to.equal(undefined);
    expectControlSize(branch, 36);
  });

  it('keeps generated and declarative descendants aligned and lets custom controls grow a compact row', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-tree size="small" label="Data outline" selection="multiple" .data=${data}></lr-tree>
        <lr-tree size="s" label="Markup outline" selection="multiple">
          <lr-tree-item expanded>
            Branch
            <lr-tree-item label="Child"></lr-tree-item>
          </lr-tree-item>
          <lr-tree-item label="Leaf"></lr-tree-item>
          <lr-tree-item><lr-icon-button icon="close" label="Dismiss"></lr-icon-button></lr-tree-item>
        </lr-tree>
      </div>
    `);
    const [dataTree, markupTree] = wrapper.querySelectorAll<LyraTree>('lr-tree');
    const dataBranch = dataTree!.querySelector<LyraTreeItem>('lr-tree-item')!;
    await dataBranch.updateComplete;
    dataBranch.expanded = true;
    await waitUntil(() => dataBranch.childItems().length === 1);
    const dataChild = dataBranch.childItems()[0]!;
    const [markupBranch, markupChild, markupLeaf, actionItem] = markupTree!.querySelectorAll<LyraTreeItem>('lr-tree-item');
    for (const item of [dataBranch, dataChild, markupBranch!, markupChild!, markupLeaf!]) {
      await item.updateComplete;
      expect(box(part(item, 'row'))[1]).to.equal(32);
      expectControlSize(item, 28);
    }
    const leafToggle = part(markupLeaf!, 'toggle');
    expect(getComputedStyle(leafToggle).visibility).to.equal('hidden');
    expect(part(markupLeaf!, 'label').getBoundingClientRect().left).to.equal(part(markupBranch!, 'label').getBoundingClientRect().left);

    await actionItem!.updateComplete;
    const action = actionItem!.querySelector<LyraIconButton>('lr-icon-button')!;
    await action.updateComplete;
    const actionBox = box(part(action, 'button'));
    expect(actionBox).to.deep.equal([36, 36]);
    expect(box(part(actionItem!, 'row'))[1]).to.be.at.least(actionBox[1]);
  });

  it('accepts independent inherited and per-item overrides and contains taller row content', async () => {
    const tree = await fixture<LyraTree>(html`
      <lr-tree size="s" label="Outline" selection="multiple"
        style="--lr-tree-row-height: 38px; --lr-tree-toggle-size: 26px">
        <lr-tree-item expanded>
          Branch
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
        <lr-tree-item label="Leaf" style="--lr-tree-toggle-size: 30px"></lr-tree-item>
        <lr-tree-item><span style="display: inline-block; block-size: 48px">Tall label</span></lr-tree-item>
      </lr-tree>
    `);
    const [branch, child, leaf, tall] = tree.querySelectorAll<LyraTreeItem>('lr-tree-item');
    for (const item of [branch!, child!, leaf!, tall!]) await item.updateComplete;
    expectControlSize(branch!, 26);
    expectControlSize(child!, 26);
    expectControlSize(leaf!, 30);
    expect(box(part(branch!, 'row'))[1]).to.equal(38);
    expect(box(part(leaf!, 'row'))[1]).to.equal(38);
    expect(box(part(tall!, 'row'))[1]).to.be.at.least(48);
  });

  it('enforces a physical 24px minimum and the existing coarse-pointer floor', async () => {
    const tree = await fixture<LyraTree>(html`
      <lr-tree data-lr-theme-scope label="Outline" size="2xs" selection="multiple" .data=${data}
        style="--lr-tree-row-height: 0; --lr-tree-toggle-size: 0; --lr-theme-size-24px: 8px"></lr-tree>
    `);
    const branch = tree.querySelector<LyraTreeItem>('lr-tree-item')!;
    await branch.updateComplete;
    const root = document.documentElement;
    const originalRootFontSize = root.style.fontSize;
    try {
      root.style.fontSize = '10px';
      expect(getComputedStyle(branch).getPropertyValue('--lr-size-24px').trim()).to.equal('8px');
      expectControlSize(branch, 24);
      expect(box(part(branch, 'row'))[1]).to.be.at.least(24);
    } finally {
      root.style.fontSize = originalRootFontSize;
    }

    const restore = forceCoarsePointer(branch);
    try {
      expectControlSize(branch, 44);
      expect(box(part(branch, 'row'))[1]).to.be.at.least(44);
    } finally {
      restore();
    }
  });

  it('retains automatic measurement and provider row geometry', async () => {
    const source: LyraHierarchySource<LyraTreeNodeData, LyraHierarchyQuery> = {
      revision: 1,
      async project() {
        return {
          state: 'density',
          total: 1,
          rows: {
            count: 1,
            keyAt: () => 'branch',
            indexOfKey: (key: string | number) => key === 'branch' ? 0 : -1,
            itemAt: () => ({
              key: 'branch', value: data[0]!, parentKey: null, level: 1, position: 1,
              setSize: 1, childCount: 1, expanded: false, selected: false,
            }),
          },
        };
      },
    };
    const tree = await fixture<LyraTree>(html`<lr-tree label="Provider outline" .treeSource=${source}></lr-tree>`);
    await waitUntil(() => Boolean(tree.shadowRoot?.querySelector('[part~="source-row"]')));
    const row = part(tree, 'source-row');
    const toggle = row.querySelector<HTMLElement>('[part~="source-toggle"]')!;
    const rowBefore = box(row);
    const toggleBefore = box(toggle);
    tree.setAttribute('size', '2xs');
    tree.style.setProperty('--lr-tree-row-height', '1px');
    tree.style.setProperty('--lr-tree-toggle-size', '1px');
    await tree.updateComplete;
    const currentRow = part(tree, 'source-row');
    expect(box(currentRow)).to.deep.equal(rowBefore);
    expect(box(currentRow.querySelector<HTMLElement>('[part~="source-toggle"]')!)).to.deep.equal(toggleBefore);
    expect(part(tree, 'source-list').getAttribute('row-height')).to.equal('auto');
  });
});
