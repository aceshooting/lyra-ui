import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree, LyraTreeNodeData } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

/** Walks into shadow roots to find the actually-focused element (a focused
 *  element inside a shadow tree only surfaces as its shadow host via the
 *  plain `document.activeElement`). */
function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  const active = root.activeElement;
  return active?.shadowRoot?.activeElement ? deepActiveElement(active.shadowRoot) : active;
}

describe('reorderable', () => {
  const reorderData: LyraTreeNodeData[] = [
    {
      id: '1',
      label: 'Root',
      children: [
        { id: '1.1', label: 'Child A' },
        { id: '1.2', label: 'Child B' },
        { id: '1.3', label: 'Child C' },
      ],
    },
    { id: '2', label: 'Leaf' },
  ];

  const clone = (): LyraTreeNodeData[] => JSON.parse(JSON.stringify(reorderData));

  const applyDataReorder = (el: LyraTree, event: CustomEvent): void => {
    const { parentNodeId, fromIndex, toIndex } = event.detail as {
      parentNodeId: string | null;
      fromIndex: number;
      toIndex: number;
    };
    const next = JSON.parse(JSON.stringify(el.data)) as LyraTreeNodeData[];
    const find = (items: LyraTreeNodeData[], id: string): LyraTreeNodeData | undefined => {
      for (const item of items) {
        if (item.id === id) return item;
        const nested = item.children ? find(item.children, id) : undefined;
        if (nested) return nested;
      }
      return undefined;
    };
    const siblings = parentNodeId === null ? next : find(next, parentNodeId)?.children;
    if (!siblings) return;
    const [moved] = siblings.splice(fromIndex, 1);
    if (!moved) return;
    siblings.splice(toIndex, 0, moved);
    el.data = next;
  };

  /** Dispatch a Ctrl/Cmd+Arrow keydown from a node, the way a real key press reaches
   *  `<lr-tree>`'s single delegated listener (composed + bubbling). */
  const modArrow = (
    node: Element,
    key: 'ArrowUp' | 'ArrowDown',
    modifier: 'ctrlKey' | 'metaKey' = 'ctrlKey',
  ): void => {
    node.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        composed: true,
        cancelable: true,
        [modifier]: true,
      }),
    );
  };

  const arrow = (node: Element, key: string): void => {
    node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
  };

  /** Expand the root and walk focus down to the nested child with `id`. */
  async function focusNestedChild(el: LyraTree, id: string): Promise<LyraTreeItem> {
    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    root.expand();
    await el.updateComplete;
    (root as unknown as HTMLElement).focus();
    let current: Element = root as unknown as Element;
    for (let i = 0; i < 8; i++) {
      const active = deepActiveElement() as unknown as LyraTreeItem | null;
      if (active?.item?.id === id) return active;
      arrow(current, 'ArrowDown');
      await el.updateComplete;
      current = deepActiveElement() as Element;
    }
    throw new Error(`could not reach node ${id}`);
  }

  it('Ctrl+ArrowDown on a focused top-level node requests a move to the next sibling slot', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    (root as unknown as HTMLElement).focus();

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    expect(events.length).to.equal(1);
    expect(events[0].detail).to.deep.equal({ nodeId: '1', parentNodeId: null, fromIndex: 0, toIndex: 1 });
    expect(events[0].bubbles).to.be.true;
    expect(events[0].composed).to.be.true;
  });

  it('Cmd+ArrowUp on a nested node is scoped to its own parent\'s children, reporting that parentNodeId', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const childB = await focusNestedChild(el, '1.2');

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(childB as unknown as Element, 'ArrowUp', 'metaKey');
    await el.updateComplete;

    expect(events.length).to.equal(1);
    expect(events[0].detail).to.deep.equal({
      nodeId: '1.2',
      parentNodeId: '1',
      fromIndex: 1,
      toIndex: 0,
    });
  });

  it('never reparents across a subtree boundary: Ctrl+ArrowDown on the last child is a silent no-op', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const childC = await focusNestedChild(el, '1.3');

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(childC as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    // '1.3' is the last child of '1'; the *visually* next row is the top-level
    // uncle '2'. A reorder must never turn into a reparent, so nothing happens.
    expect(events.length).to.equal(0);
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('1.3');
  });

  it('Ctrl+ArrowUp on the first sibling is a silent no-op rather than a move out of the subtree', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const childA = await focusNestedChild(el, '1.1');

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(childA as unknown as Element, 'ArrowUp');
    await el.updateComplete;

    expect(events.length).to.equal(0);
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('1.1');
  });

  it('with reorderable unset, Ctrl+ArrowDown never emits lr-reorder and still moves the roving tabindex', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
    (root as unknown as HTMLElement).focus();

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    expect(events.length).to.equal(0);
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('2');
    expect((leaf as unknown as HTMLElement).tabIndex).to.equal(0);
    // No live region is rendered at all until the feature is opted into.
    expect((el.shadowRoot!.querySelector('lr-live-region')) == null).to.be.true;
    expect(el.hasAttribute('reorderable')).to.be.false;
  });

  it('reflects the reorderable attribute', async () => {
    const el = (await fixture(html`<lr-tree></lr-tree>`)) as LyraTree;
    el.reorderable = true;
    await el.updateComplete;
    expect(el.hasAttribute('reorderable')).to.be.true;
  });

  it('keeps focus on the moved top-level node after the host reassigns a reordered data array', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    (root as unknown as HTMLElement).focus();

    el.addEventListener('lr-reorder', (e) => {
      const { fromIndex, toIndex } = (e as CustomEvent).detail;
      const next = [...el.data];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      el.data = next;
    });
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    const ids = [...el.querySelectorAll('lr-tree-item')].map(
      (n) => (n as unknown as LyraTreeItem).item.id,
    );
    expect(ids).to.deep.equal(['2', '1']);
    // `syncNodes()` re-inserts the moved element, which drops real DOM focus to
    // <body>; the moved node must get it back, and keep the roving tabindex.
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('1');
    expect((root as unknown as HTMLElement).tabIndex).to.equal(0);
  });

  it('keeps focus on the moved nested node after the host reassigns a reordered data array', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const childA = await focusNestedChild(el, '1.1');

    el.addEventListener('lr-reorder', (e) => {
      const { parentNodeId, fromIndex, toIndex } = (e as CustomEvent).detail;
      const next = JSON.parse(JSON.stringify(el.data)) as LyraTreeNodeData[];
      const parent = next.find((item) => item.id === parentNodeId)!;
      const children = parent.children!;
      const [moved] = children.splice(fromIndex, 1);
      children.splice(toIndex, 0, moved);
      el.data = next;
    });
    modArrow(childA as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    const childIds = [...root.shadowRoot!.querySelectorAll('lr-tree-item')].map(
      (n) => (n as unknown as LyraTreeItem).item.id,
    );
    expect(childIds).to.deep.equal(['1.2', '1.1', '1.3']);
    expect((deepActiveElement() as unknown as LyraTreeItem | null)?.item?.id).to.equal('1.1');
  });

  it('does not swap the vertical reorder keys under dir="rtl"', async () => {
    const el = (await fixture(html`<lr-tree dir="rtl" reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const [root, leaf] = [...el.querySelectorAll('lr-tree-item')] as unknown as LyraTreeItem[];
    (root as unknown as HTMLElement).focus();

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));

    // ArrowUp/ArrowDown are not direction-sensitive: "down" always means later
    // in the sibling list, in both LTR and RTL.
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;
    expect(events[0].detail).to.deep.equal({ nodeId: '1', parentNodeId: null, fromIndex: 0, toIndex: 1 });

    (leaf as unknown as HTMLElement).focus();
    arrow(root as unknown as Element, 'End');
    await el.updateComplete;
    modArrow(leaf as unknown as Element, 'ArrowUp');
    await el.updateComplete;
    expect(events[1].detail).to.deep.equal({ nodeId: '2', parentNodeId: null, fromIndex: 1, toIndex: 0 });
    expect(events.length).to.equal(2);
  });

  it('does not announce a completed move when the host ignores the reorder request', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    expect((region) != null, 'a reorderable tree renders a live region').to.equal(true);
    await region.updateComplete;

    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    (root as unknown as HTMLElement).focus();
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const text = region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
    expect(text.trim()).to.equal('');
  });

  it('announces only after the host confirms the requested sibling order', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;
    const root = el.querySelector('lr-tree-item') as LyraTreeItem;
    root.focus();
    el.addEventListener('lr-reorder', (event) => applyDataReorder(el, event as CustomEvent));

    modArrow(root, 'ArrowDown');
    await el.updateComplete;
    const text = region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
    expect(text).to.contain('Root');
    expect(text).to.contain('2');
  });

  it('retains an async request through unrelated updates without announcing early', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;
    const root = el.querySelector('lr-tree-item') as LyraTreeItem;
    root.focus();
    let request: CustomEvent | undefined;
    el.addEventListener('lr-reorder', (event) => {
      request = event as CustomEvent;
    });

    modArrow(root, 'ArrowDown');
    el.label = 'Updated while persistence is pending';
    await el.updateComplete;
    expect((region.shadowRoot!.textContent ?? '').trim()).to.equal('');

    applyDataReorder(el, request!);
    await el.updateComplete;
    expect(region.shadowRoot!.textContent).to.contain('Moved Root');
  });

  it('does not announce a divergent host update or misattribute a later unrelated order', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ];
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;
    const alpha = el.querySelector('lr-tree-item') as LyraTreeItem;
    alpha.focus();
    el.addEventListener(
      'lr-reorder',
      () => {
        el.data = [
          { id: 'a', label: 'Alpha' },
          { id: 'c', label: 'Gamma' },
          { id: 'b', label: 'Beta' },
        ];
      },
      { once: true },
    );

    modArrow(alpha, 'ArrowDown');
    await el.updateComplete;
    expect((region.shadowRoot!.textContent ?? '').trim()).to.equal('');

    el.data = [
      { id: 'b', label: 'Beta' },
      { id: 'a', label: 'Alpha' },
      { id: 'c', label: 'Gamma' },
    ];
    await el.updateComplete;
    expect((region.shadowRoot!.textContent ?? '').trim()).to.equal('');
  });

  it('rejects a pending reorder without throwing when the requested node is removed from data before confirmation', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.data = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ];
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;
    const alpha = el.querySelector('lr-tree-item') as LyraTreeItem;
    alpha.focus();
    el.addEventListener(
      'lr-reorder',
      () => {
        // Removes the requested node entirely instead of reordering it -- findRenderedSiblings()
        // can no longer locate it among its former parent's rendered children.
        el.data = [
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
        ];
      },
      { once: true },
    );

    modArrow(alpha, 'ArrowDown');
    await el.updateComplete;

    expect((region.shadowRoot!.textContent ?? '').trim()).to.equal('');
    expect(
      [...el.querySelectorAll('lr-tree-item')].map((n) => (n as unknown as LyraTreeItem).item?.id),
    ).to.deep.equal(['b', 'c']);
  });

  it('honors a .strings override for the treeNodeMoved announcement', async () => {
    const el = (await fixture(html`<lr-tree reorderable></lr-tree>`)) as LyraTree;
    el.strings = { treeNodeMoved: 'Déplacé {label} en position {index} sur {total}' };
    el.data = clone();
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;

    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    (root as unknown as HTMLElement).focus();
    el.addEventListener('lr-reorder', (event) => applyDataReorder(el, event as CustomEvent));
    modArrow(root as unknown as Element, 'ArrowDown');
    await el.updateComplete;

    const text = region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
    expect(text).to.contain('Déplacé Root en position 2 sur 2');
  });

  it('is accessible in the populated reorderable state', async () => {
    const el = (await fixture(
      html`<lr-tree reorderable label="Reorderable tree"></lr-tree>`,
    )) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    await el.expandAll();
    await expect(el).to.be.accessible();
  });
  it('formats reorder-announcement numbers with the effective locale', async () => {
    // `localize()` interpolates with a bare `String(value)` -- it does no number formatting. A raw
    // `index + 1` therefore renders Western digits inside an otherwise fully-translated sentence,
    // so under a locale with its own numbering system the announcement mixes two digit sets.
    const el = (await fixture(html`<lr-tree reorderable lang="ar-u-nu-arab"></lr-tree>`)) as LyraTree;
    el.data = clone();
    await el.updateComplete;
    const child = await focusNestedChild(el, '1.2');

    el.addEventListener('lr-reorder', (event) => applyDataReorder(el, event as CustomEvent));

    modArrow(child as unknown as Element, 'ArrowUp', 'metaKey');
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    const live = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement | null;
    const announced = (live?.shadowRoot?.textContent ?? '') + (live?.textContent ?? '');
    expect(announced.trim(), 'an announcement was made').to.not.equal('');
    expect(announced, 'announcement should use Arabic-Indic digits').to.match(/[\u0660-\u0669]/);
  });
});
