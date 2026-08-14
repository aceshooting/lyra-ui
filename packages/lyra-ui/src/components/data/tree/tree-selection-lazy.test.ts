import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, TreeItem } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

describe('tree upstream-compatible selection and lazy lifecycle', () => {
  const selectableTree = () => html`
    <lr-tree label="Topics">
      <lr-tree-item label="Parent" expanded>
        <lr-tree-item label="Alpha"></lr-tree-item>
        <lr-tree-item label="Beta"></lr-tree-item>
        <lr-tree-item label="Disabled" disabled></lr-tree-item>
      </lr-tree-item>
      <lr-tree-item label="Standalone"></lr-tree-item>
    </lr-tree>
  `;

  it('defaults to single selection, exposes selectedItems, and emits the normalized selection event', async () => {
    const el = (await fixture(selectableTree())) as LyraTree;
    await el.updateComplete;
    const [, standalone] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];

    expect(el.selection).to.equal('single');
    const changed = oneEvent(el, 'lr-selection-change');
    standalone!.select();
    const event = await changed;
    await el.updateComplete;

    expect(standalone!.selected).to.be.true;
    expect(event.detail.selection.map((item: LyraTreeItem) => item.nodeLabel)).to.eql(['Standalone']);
    expect(el.selectedItems.map((item) => item.nodeLabel)).to.eql(['Standalone']);
  });

  it('cascades multiple selection, computes indeterminate parents, and keeps disabled targets inert', async () => {
    const el = (await fixture(selectableTree())) as LyraTree;
    el.selection = 'multiple';
    await el.updateComplete;
    const parent = el.querySelector(':scope > lr-tree-item') as LyraTreeItem;
    const [alpha, beta, disabled] = [...parent.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];

    alpha!.select();
    await el.updateComplete;
    expect(alpha!.selected).to.be.true;
    expect(parent.indeterminate).to.be.true;
    expect(parent.selected).to.be.false;
    const checkbox = parent.shadowRoot!.querySelector('[part="checkbox"]') as HTMLElement | null;
    expect(checkbox === null, 'multiple mode renders a checkbox').to.be.false;
    expect(checkbox!.getAttribute('aria-checked')).to.equal('mixed');

    parent.select();
    await el.updateComplete;
    expect(parent.selected).to.be.true;
    expect(parent.indeterminate).to.be.false;
    expect(alpha!.selected).to.be.true;
    expect(beta!.selected).to.be.true;
    expect(disabled!.selected, 'a disabled descendant is never changed by cascade').to.be.false;
  });

  it('supports leaf and leaf-multiple without making branch rows selectable', async () => {
    const el = (await fixture(selectableTree())) as LyraTree;
    const parent = el.querySelector(':scope > lr-tree-item') as LyraTreeItem;
    const [alpha, beta] = [...parent.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];

    el.selection = 'leaf';
    await el.updateComplete;
    parent.select();
    await el.updateComplete;
    expect(el.selectedItems.length).to.equal(0);
    alpha!.select();
    await el.updateComplete;
    expect(el.selectedItems.map((item) => item.nodeLabel)).to.eql(['Alpha']);

    el.selection = 'leaf-multiple';
    await el.updateComplete;
    parent.select();
    await el.updateComplete;
    expect(
      el.selectedItems.filter((item) => !item.hasChildren).map((item) => item.nodeLabel),
    ).to.eql(['Alpha', 'Beta']);
    expect(parent.selected).to.be.true;
    expect(parent.indeterminate).to.be.false;
  });

  it('projects tree-level and item-level expand/collapse icon slots into every disclosure', async () => {
    const el = (await fixture(html`
      <lr-tree label="Topics">
        <span slot="expand-icon" data-icon="tree-expanded">minus</span>
        <span slot="collapse-icon" data-icon="tree-collapsed">plus</span>
        <lr-tree-item label="Inherited">
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
        <lr-tree-item label="Own">
          <span slot="expand-icon" data-icon="item-expanded">open</span>
          <span slot="collapse-icon" data-icon="item-collapsed">closed</span>
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const [inherited, own] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];

    expect(inherited!.shadowRoot!.querySelector('[data-icon="tree-collapsed"]') !== null).to.be.true;
    expect(own!.shadowRoot!.querySelector('slot[name="collapse-icon"]') !== null).to.be.true;
    inherited!.expand();
    own!.expand();
    await el.updateComplete;
    expect(inherited!.shadowRoot!.querySelector('[data-icon="tree-expanded"]') !== null).to.be.true;
    const ownSlot = own!.shadowRoot!.querySelector('slot[name="expand-icon"]') as HTMLSlotElement;
    expect(ownSlot.assignedElements().map((node) => node.getAttribute('data-icon'))).to.eql([
      'item-expanded',
    ]);
  });

  it('loads a lazy item once, exposes loading UI, and expands after children arrive', async () => {
    const el = (await fixture(html`
      <lr-tree label="Topics"><lr-tree-item label="Lazy" lazy></lr-tree-item></lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const lazy = el.querySelector('lr-tree-item') as LyraTreeItem;
    const events: string[] = [];
    for (const name of ['lr-lazy-change', 'lr-lazy-load', 'lr-expand', 'lr-after-expand']) {
      lazy.addEventListener(name, () => events.push(name));
    }

    lazy.expand();
    await lazy.updateComplete;
    expect(lazy.loading).to.be.true;
    expect(lazy.expanded).to.be.false;
    expect(lazy.shadowRoot!.querySelector('[part="spinner"]') !== null).to.be.true;
    expect(events.slice(0, 2)).to.eql(['lr-lazy-change', 'lr-lazy-load']);

    const child = document.createElement('lr-tree-item') as LyraTreeItem;
    child.label = 'Loaded';
    lazy.appendChild(child);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(lazy.loading).to.be.false;
    expect(lazy.expanded).to.be.true;
    expect(events).to.include('lr-expand');
    expect(lazy.getChildrenItems().map((item) => item.nodeLabel)).to.eql(['Loaded']);
  });

  it('filters getChildrenItems(), cancels lazy work while disabled, and rejects stale reconnect work', async () => {
    const el = (await fixture(html`
      <lr-tree label="Topics">
        <lr-tree-item label="Lazy" lazy>
          <lr-tree-item label="Enabled"></lr-tree-item>
          <lr-tree-item label="Disabled" disabled></lr-tree-item>
        </lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const lazy = el.querySelector('lr-tree-item') as LyraTreeItem;
    expect(lazy.getChildrenItems().length).to.equal(2);
    expect(lazy.getChildrenItems({ includeDisabled: false }).map((item) => item.nodeLabel)).to.eql([
      'Enabled',
    ]);

    lazy.expand();
    await lazy.updateComplete;
    lazy.disabled = true;
    await lazy.updateComplete;
    expect(lazy.loading).to.be.false;
    expect(lazy.expanded).to.be.false;

    lazy.disabled = false;
    lazy.expand();
    await lazy.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    parent.appendChild(el);
    await el.updateComplete;
    expect(lazy.loading, 'transient loading state is reset across reconnect').to.be.false;
    expect(lazy.expanded, 'a stale pre-disconnect request cannot expand after reconnect').to.be.false;
  });

  it('emits expand/collapse lifecycle events in order and suppresses a stale after-expand', async () => {
    const el = (await fixture(html`
      <lr-tree label="Topics">
        <lr-tree-item label="Parent" style="--show-duration: 30ms; --hide-duration: 1ms">
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const item = el.querySelector('lr-tree-item') as LyraTreeItem;
    const events: string[] = [];
    for (const name of ['lr-expand', 'lr-after-expand', 'lr-collapse', 'lr-after-collapse']) {
      item.addEventListener(name, () => events.push(name));
    }

    item.expand();
    await item.updateComplete;
    item.collapse();
    await new Promise((resolve) => setTimeout(resolve, 45));
    expect(events).to.eql(['lr-expand', 'lr-collapse', 'lr-after-collapse']);
  });

  it('settles the expansion lifecycle immediately when reduced motion is requested', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia;
    try {
      const el = (await fixture(html`
        <lr-tree label="Topics">
          <lr-tree-item label="Parent" style="--show-duration: 5s">
            <lr-tree-item label="Child"></lr-tree-item>
          </lr-tree-item>
        </lr-tree>
      `)) as LyraTree;
      await el.updateComplete;
      const item = el.querySelector('lr-tree-item') as LyraTreeItem;
      const afterExpand = oneEvent(item, 'lr-after-expand');

      item.expand();
      await Promise.race([
        afterExpand,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Reduced-motion expansion did not settle promptly.')), 500),
        ),
      ]);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('uses the same multiple-selection engine for data-created descendants without mutating data', async () => {
    const treeData: TreeItem[] = [
      {
        id: 'branch',
        label: 'Branch',
        children: [
          { id: 'selected', label: 'Selected', selected: true },
          { id: 'available', label: 'Available' },
          { id: 'disabled', label: 'Disabled', disabled: true },
        ],
      },
    ];
    const el = (await fixture(html`<lr-tree label="Topics"></lr-tree>`)) as LyraTree;
    el.selection = 'multiple';
    el.data = treeData;
    await el.updateComplete;

    const branch = el.querySelector('lr-tree-item') as LyraTreeItem;
    const [selected, available, disabled] = branch.getChildrenItems();
    expect(branch.indeterminate).to.be.true;
    expect(selected!.selected).to.be.true;

    branch.select();
    await el.updateComplete;
    expect(branch.selected).to.be.true;
    expect(available!.selected).to.be.true;
    expect(disabled!.selected).to.be.false;
    expect(treeData[0]!.selected, 'selection state stays on elements, not caller-owned data').to.be
      .undefined;
    expect(treeData[0]!.children![1]!.selected).to.be.undefined;
  });

  it('finishes a data-model lazy request from an immutable item refresh', async () => {
    const el = (await fixture(html`<lr-tree label="Topics"></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'lazy', label: 'Lazy', lazy: true }];
    await el.updateComplete;
    const lazy = el.querySelector('lr-tree-item') as LyraTreeItem;
    const requested = oneEvent(el, 'lr-lazy-load');

    lazy.expand();
    const request = await requested;
    expect((request.detail.item) === (lazy)).to.equal(true);
    expect(lazy.loading).to.be.true;

    el.data = [
      {
        id: 'lazy',
        label: 'Lazy',
        children: [{ id: 'loaded', label: 'Loaded' }],
      },
    ];
    await el.updateComplete;
    expect((el.querySelector('lr-tree-item')) === (lazy)).to.equal(true);
    expect(lazy.loading).to.be.false;
    expect(lazy.expanded).to.be.true;
    expect(lazy.getChildrenItems().map((item) => item.nodeLabel)).to.eql(['Loaded']);
  });

  it('exports the upstream parts and CSS hooks while preserving Lyra wrapper aliases', async () => {
    const el = (await fixture(html`
      <lr-tree
        label="Topics"
        selection="multiple"
        style="--indent-size: 2rem; --indent-guide-width: 3px; --show-duration: 7ms"
      >
        <lr-tree-item label="Parent" expanded selected>
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const item = el.querySelector('lr-tree-item') as LyraTreeItem;
    const treeBase = el.shadowRoot!.querySelector('[part~="tree"]') as HTMLElement;
    const itemBase = item.shadowRoot!.querySelector('[part~="tree-item"]') as HTMLElement;
    const itemPart = item.shadowRoot!.querySelector('[part~="item"]') as HTMLElement;
    const indentation = item.shadowRoot!.querySelector('[part="indentation"]') as HTMLElement;

    expect(treeBase.getAttribute('part')).to.equal('base tree');
    expect(itemBase.getAttribute('part')).to.equal('base tree-item');
    expect(itemPart.getAttribute('part')).to.include('item--expanded');
    expect(item.shadowRoot!.querySelector('[part="expand-button"]') !== null).to.be.true;
    expect(item.shadowRoot!.querySelector('[part="children"]') !== null).to.be.true;
    expect(item.shadowRoot!.querySelector('[part="checkbox"]') !== null).to.be.true;
    expect(getComputedStyle(indentation).borderInlineEndWidth).to.equal('3px');
    expect(getComputedStyle(item).getPropertyValue('--show-duration').trim()).to.equal('7ms');
  });

  it('is accessible when expanded, lazy-capable, and multiply selected', async () => {
    const el = (await fixture(html`
      <lr-tree label="Topics" selection="multiple" style="--show-duration: 0ms">
        <lr-tree-item label="Parent" expanded>
          <lr-tree-item label="Selected" selected></lr-tree-item>
          <lr-tree-item label="Lazy" lazy></lr-tree-item>
        </lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    expect(el.selectedItems.length).to.be.greaterThan(0);
    await expect(el).to.be.accessible();
  });
});
