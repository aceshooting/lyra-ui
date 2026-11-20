import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-tree.js';
import type { LyraTree, LyraTreeNodeData } from '../../lr-tree.js';
import type { LyraTreeItem } from '../../lr-tree-item.js';

type PointerPoint = readonly [x: number, y: number];

const data: readonly LyraTreeNodeData[] = [
  { id: 'a', label: 'Alpha', children: [{ id: 'a1', label: 'Nested' }] },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
];

function part(owner: HTMLElement, name: string): HTMLElement {
  return owner.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
}

function point(element: HTMLElement, fraction = 0.5): PointerPoint {
  const rect = element.getBoundingClientRect();
  return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height * fraction)];
}

function pointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  [clientX, clientY]: PointerPoint,
  pointerType: 'mouse' | 'touch' = 'mouse',
): void {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    isPrimary: true,
    pointerId: 37,
    pointerType,
    clientX,
    clientY,
    button: 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
  }));
}

function requests(tree: LyraTree): { targetNodeId: string; position: string }[] {
  const results: { targetNodeId: string; position: string }[] = [];
  tree.addEventListener('lr-pointer-reorder', event => {
    results.push((event as CustomEvent<{ targetNodeId: string; position: string }>).detail);
  });
  return results;
}

function visibleIndicator(tree: LyraTree): HTMLElement | null {
  return tree.shadowRoot!.querySelector<HTMLElement>('[part="drop-indicator"]:not([hidden])');
}

function roots(tree: LyraTree): LyraTreeItem[] {
  return [...tree.querySelectorAll<LyraTreeItem>(':scope > lr-tree-item')];
}

function drag(from: HTMLElement, to: PointerPoint, pointerType: 'mouse' | 'touch' = 'mouse'): void {
  pointer(from, 'pointerdown', point(from), pointerType);
  pointer(window, 'pointermove', to, pointerType);
}

describe('pointer reorder gesture edges', () => {
  it('scrolls the nearest viewport at a stationary edge and follows the row that moves under the pointer', async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      id: `row-${index}`, label: `Outline row ${index}`,
    }));
    const scroller = await fixture<HTMLElement>(html`
      <div style="block-size: 132px; inline-size: 320px; overflow-y: auto">
        <lr-tree pointer-reorderable label="Scrollable outline" .data=${rows}></lr-tree>
      </div>
    `);
    const tree = scroller.querySelector<LyraTree>('lr-tree')!;
    await tree.updateComplete;
    const items = roots(tree);
    const emitted = requests(tree);
    const bounds = scroller.getBoundingClientRect();
    const edge: PointerPoint = [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.bottom - 10)];
    drag(part(items[0]!, 'row'), edge);
    try {
      await waitUntil(() => scroller.scrollTop >= 88, 'scroll more than two rows without another pointermove');
      const target = items.find(item => {
        const row = part(item, 'row').getBoundingClientRect();
        return edge[1] >= row.top && edge[1] < row.bottom;
      })!;
      expect(target.nodeId).not.to.equal('row-2');
      const row = part(target, 'row').getBoundingClientRect();
      const position = edge[1] < row.top + row.height / 2 ? 'before' : 'after';
      expect(visibleIndicator(tree)?.getBoundingClientRect().top).to.be.closeTo(position === 'before' ? row.top : row.bottom, 1);
      pointer(window, 'pointerup', edge);
      expect(emitted.map(result => [result.targetNodeId, result.position])).to.deep.equal([[target.nodeId, position]]);
      const settled = scroller.scrollTop;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      expect(scroller.scrollTop).to.equal(settled);
    } finally {
      pointer(window, 'pointercancel', edge);
    }
  });

  it('reserves touch dragging for the grip and clears the indicator on pointercancel', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable label="Outline" .data=${data}></lr-tree>`);
    const [first, , last] = roots(tree);
    const row = part(first!, 'row');
    const grip = part(first!, 'reorder-handle');
    const toward = point(part(last!, 'row'), 0.75);
    const emitted = requests(tree);
    expect(getComputedStyle(row).touchAction).to.equal('auto');
    expect(Boolean(grip), 'touch grip is rendered in pointer mode').to.equal(true);
    expect(getComputedStyle(grip).touchAction).to.equal('none');

    drag(part(first!, 'label'), toward, 'touch');
    expect(Boolean(visibleIndicator(tree))).to.equal(false);
    pointer(window, 'pointerup', toward, 'touch');
    expect(emitted.length).to.equal(0);

    drag(grip, toward, 'touch');
    expect(Boolean(visibleIndicator(tree))).to.equal(true);
    pointer(window, 'pointercancel', toward, 'touch');
    expect(Boolean(visibleIndicator(tree))).to.equal(false);
    pointer(window, 'pointerup', toward, 'touch');
    expect(emitted.length).to.equal(0);

    drag(grip, toward, 'touch');
    pointer(window, 'pointerup', toward, 'touch');
    expect(emitted.map(result => result.targetNodeId)).to.deep.equal(['c']);
  });

  it('keeps slotted buttons and branch disclosures independent of row dragging', async () => {
    const tree = await fixture<LyraTree>(html`
      <lr-tree pointer-reorderable label="Outline">
        <lr-tree-item id="a">
          Alpha <button type="button">Action</button>
          <lr-tree-item id="a1" label="Nested"></lr-tree-item>
        </lr-tree-item>
        <lr-tree-item id="b" label="Bravo"></lr-tree-item>
        <lr-tree-item id="c" label="Charlie"></lr-tree-item>
      </lr-tree>
    `);
    const [first, , last] = roots(tree);
    const action = first!.querySelector('button')!;
    const toward = point(part(last!, 'row'), 0.75);
    const emitted = requests(tree);
    let clicks = 0;
    action.addEventListener('click', () => clicks++);
    drag(action, toward);
    expect(Boolean(visibleIndicator(tree))).to.equal(false);
    pointer(window, 'pointerup', toward);

    const toggle = part(first!, 'toggle');
    const capture = toggle.setPointerCapture;
    toggle.setPointerCapture = () => {}; // The synthetic pointer has no native capture state.
    try {
      drag(toggle, toward);
      expect(Boolean(visibleIndicator(tree))).to.equal(false);
    } finally {
      pointer(toggle, 'pointerup', toward);
      toggle.setPointerCapture = capture;
    }
    expect(emitted.length).to.equal(0);
    action.click();
    expect(clicks).to.equal(1);
    expect(tree.selectedItems.length).to.equal(0);

    drag(part(first!, 'row'), toward);
    pointer(window, 'pointerup', toward);
    expect(emitted.map(result => result.targetNodeId)).to.deep.equal([last!.nodeId]);
  });

  it('excludes descendants of inert or disabled parents and accepts them after the parent is enabled', async () => {
    const tree = await fixture<LyraTree>(html`
      <lr-tree pointer-reorderable allow-cross-parent-reorder label="Outline">
        <lr-tree-item id="a" label="Folder" expanded>
          <lr-tree-item id="a1" label="Nested"></lr-tree-item>
        </lr-tree-item>
        <lr-tree-item id="b" label="Bravo"></lr-tree-item>
        <lr-tree-item id="c" label="Charlie"></lr-tree-item>
      </lr-tree>
    `);
    const [folder, , last] = roots(tree);
    const child = folder!.childItems()[0]!;
    await child.updateComplete;
    expect(part(child, 'row').getBoundingClientRect().height).to.be.greaterThan(0);
    const from = part(child, 'row');
    const toward = point(part(last!, 'row'), 0.75);
    const emitted = requests(tree);
    folder!.inert = true;
    drag(from, toward);
    pointer(window, 'pointerup', toward);
    expect(emitted.length).to.equal(0);
    folder!.inert = false;

    // Disabling normally folds the branch on its next update. While the child is still visible,
    // pointer validation must already reject the disabled parent.
    folder!.disabled = true;
    drag(from, toward);
    pointer(window, 'pointerup', toward);
    expect(emitted.length).to.equal(0);
    folder!.disabled = false;

    drag(from, toward);
    pointer(window, 'pointerup', toward);
    expect(emitted.map(result => result.targetNodeId)).to.deep.equal([last!.nodeId]);
  });

  it('rejects throwing, truthy nonboolean, and asynchronous canDrop results', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable label="Outline" .data=${data}></lr-tree>`);
    const [first, , last] = roots(tree);
    const emitted = requests(tree);
    const toward = point(part(last!, 'row'), 0.75);
    for (const result of [() => { throw new Error('Policy failed'); }, () => 'yes', () => Promise.resolve(true)]) {
      let checks = 0;
      Reflect.set(tree, 'canDrop', () => { checks++; return result(); });
      drag(part(first!, 'row'), toward);
      expect(Boolean(visibleIndicator(tree))).to.equal(false);
      pointer(window, 'pointerup', toward);
      expect(checks).to.be.greaterThan(0);
      expect(emitted.length).to.equal(0);
    }
  });

  it('rejects release on an identical-looking replacement for the painted target row', async () => {
    const tree = await fixture<LyraTree>(html`
      <lr-tree pointer-reorderable label="Outline">
        <lr-tree-item id="a" label="Alpha"></lr-tree-item>
        <lr-tree-item id="b" label="Bravo"></lr-tree-item>
        <lr-tree-item id="c" label="Charlie"></lr-tree-item>
      </lr-tree>
    `);
    const [first, , last] = roots(tree);
    const emitted = requests(tree);
    const toward = point(part(last!, 'row'), 0.75);
    const replacement = document.createElement('lr-tree-item') as LyraTreeItem;
    replacement.id = last!.id;
    replacement.label = last!.label;
    drag(part(first!, 'row'), toward);
    try {
      expect(Boolean(visibleIndicator(tree))).to.equal(true);
      last!.replaceWith(replacement);
      await replacement.updateComplete;
      await tree.updateComplete;
      expect(point(part(replacement, 'row'), 0.75)).to.deep.equal(toward);
      pointer(window, 'pointerup', toward);
      expect(emitted.length).to.equal(0);
      expect(Boolean(visibleIndicator(tree))).to.equal(false);
      drag(part(first!, 'row'), toward);
      pointer(window, 'pointerup', toward);
      expect(emitted.map(result => result.targetNodeId)).to.deep.equal([replacement.nodeId]);
    } finally {
      pointer(window, 'pointercancel', toward);
    }
  });

  it('rejects a pending request after a data refresh even when the dragged row is reused', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable label="Outline" .data=${data}></lr-tree>`);
    const [first, , last] = roots(tree);
    const emitted = requests(tree);
    const toward = point(part(last!, 'row'), 0.75);
    drag(part(first!, 'row'), toward);
    expect(Boolean(visibleIndicator(tree))).to.equal(true);
    tree.data = data.map(node => ({ ...node, label: `${node.label} refreshed` }));
    await tree.updateComplete;
    expect(roots(tree)[0] === first).to.equal(true);
    pointer(window, 'pointerup', toward);
    expect(emitted.length).to.equal(0);
    expect(Boolean(visibleIndicator(tree))).to.equal(false);
    drag(part(first!, 'row'), toward);
    pointer(window, 'pointerup', toward);
    expect(emitted.map(result => result.targetNodeId)).to.deep.equal(['c']);
  });

  it('keeps the visual selection checkbox independent of pointer reordering', async () => {
    const tree = await fixture<LyraTree>(html`
      <lr-tree pointer-reorderable selection="multiple" label="Outline" .data=${data}></lr-tree>
    `);
    const [, middle, last] = roots(tree);
    const checkbox = part(middle!, 'checkbox__control');
    const toward = point(part(last!, 'row'), 0.75);
    const emitted = requests(tree);

    drag(checkbox, toward);
    expect(Boolean(visibleIndicator(tree))).to.equal(false);
    pointer(window, 'pointerup', toward);
    expect(emitted.length).to.equal(0);

    checkbox.click();
    await tree.updateComplete;
    expect(tree.selectedItems.map(item => item.nodeId)).to.deep.equal(['b']);
    drag(part(middle!, 'row'), toward);
    pointer(window, 'pointerup', toward);
    expect(emitted.map(result => result.targetNodeId)).to.deep.equal(['c']);
  });

  for (const role of ['source', 'target'] as const) {
    it(`rejects a painted request after the ${role} row receives a new item object`, async () => {
      const tree = await fixture<LyraTree>(html`
        <lr-tree pointer-reorderable label="Outline" .data=${data}></lr-tree>
      `);
      const [first, , last] = roots(tree);
      const installed = tree.data;
      const changed = role === 'source' ? first! : last!;
      const previousPart = part(changed, 'row');
      const previousItem = changed.item!;
      const revisedItem = { ...previousItem };
      const toward = point(part(last!, 'row'), 0.75);
      const emitted = requests(tree);

      drag(part(first!, 'row'), toward);
      try {
        expect(Boolean(visibleIndicator(tree))).to.equal(true);
        changed.item = revisedItem;
        await changed.updateComplete;
        expect(tree.data === installed).to.equal(true);
        expect(changed.item === revisedItem && changed.item !== previousItem).to.equal(true);
        expect(part(changed, 'row') === previousPart).to.equal(true);
        expect(changed.nodeId).to.equal(previousItem.id);
        pointer(window, 'pointerup', toward);
        expect(emitted.length).to.equal(0);
        expect(Boolean(visibleIndicator(tree))).to.equal(false);

        drag(part(first!, 'row'), toward);
        pointer(window, 'pointerup', toward);
        expect(emitted.map(result => result.targetNodeId)).to.deep.equal(['c']);
      } finally {
        pointer(window, 'pointercancel', toward);
      }
    });
  }

  it('rejects release when the source becomes visibility:hidden without losing its layout', async () => {
    const tree = await fixture<LyraTree>(html`
      <lr-tree pointer-reorderable label="Outline" .data=${data}></lr-tree>
    `);
    const [first, , last] = roots(tree);
    const source = part(first!, 'row');
    const toward = point(part(last!, 'row'), 0.75);
    const emitted = requests(tree);

    drag(source, toward);
    try {
      expect(Boolean(visibleIndicator(tree))).to.equal(true);
      const originalHeight = source.getBoundingClientRect().height;
      first!.style.visibility = 'hidden';
      expect(getComputedStyle(source).visibility).to.equal('hidden');
      expect(source.getBoundingClientRect().height).to.equal(originalHeight);
      pointer(window, 'pointerup', toward);
      expect(emitted.length).to.equal(0);
      expect(Boolean(visibleIndicator(tree))).to.equal(false);

      first!.style.removeProperty('visibility');
      drag(source, toward);
      pointer(window, 'pointerup', toward);
      expect(emitted.map(result => result.targetNodeId)).to.deep.equal(['c']);
    } finally {
      first!.style.removeProperty('visibility');
      pointer(window, 'pointercancel', toward);
    }
  });

  it('ignores and handles a rejected promise returned from canDrop', async () => {
    const tree = await fixture<LyraTree>(html`
      <lr-tree pointer-reorderable label="Outline" .data=${data}></lr-tree>
    `);
    const [first, , last] = roots(tree);
    const toward = point(part(last!, 'row'), 0.75);
    const emitted = requests(tree);
    const rejection = new Error('Asynchronous drop policy rejected');
    let checks = 0;
    let unhandled = 0;
    const onUnhandled = (event: PromiseRejectionEvent): void => {
      if (event.reason !== rejection) return;
      unhandled++;
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    try {
      Reflect.set(tree, 'canDrop', () => {
        checks++;
        return Promise.reject(rejection);
      });
      drag(part(first!, 'row'), toward);
      expect(Boolean(visibleIndicator(tree))).to.equal(false);
      pointer(window, 'pointerup', toward);
      expect(checks).to.be.greaterThan(0);
      // wait-reason: let the browser report any unhandled promise rejection after microtasks drain.
      await new Promise<void>(resolve => setTimeout(resolve, 20));
      expect(emitted.length).to.equal(0);
      expect(unhandled).to.equal(0);
    } finally {
      pointer(window, 'pointercancel', toward);
      window.removeEventListener('unhandledrejection', onUnhandled);
    }
  });

  it('announces a pointer move only after the host applies its exact requested order', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable label="Outline" .data=${data}></lr-tree>`);
    const region = tree.shadowRoot!.querySelector('lr-live-region')!;
    const liveText = (): string => region.shadowRoot!.querySelector('[part="region"]')?.textContent?.trim() ?? '';
    const move = (): void => {
      const rows = roots(tree);
      const destination = point(part(rows[2]!, 'row'), 0.75);
      drag(part(rows[0]!, 'row'), destination);
      pointer(window, 'pointerup', destination);
    };
    const emitted = requests(tree);
    move();
    expect(emitted.length).to.equal(1);
    tree.label = 'Updated outline';
    await tree.updateComplete;
    expect(liveText()).to.equal('');
    // The source remains at index zero, but the host applied another order.
    tree.data = [data[0]!, data[2]!, data[1]!];
    await tree.updateComplete;
    tree.data = [data[1]!, data[2]!, data[0]!];
    await tree.updateComplete;
    expect(liveText()).to.equal('');
    tree.data = data;
    await tree.updateComplete;
    move();
    tree.data = [data[1]!, data[2]!, data[0]!];
    await tree.updateComplete;
    await waitUntil(() => liveText().includes('Alpha'), 'announce confirmed pointer move');
  });

  it('aligns the insertion line to RTL indentation and rejects label content outside its row', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable dir="rtl" label="Outline">
      <lr-tree-item label="First"></lr-tree-item>
      <lr-tree-item label="Middle"></lr-tree-item>
      <lr-tree-item>Last <span style="position:fixed; left:20px; bottom:10px">Preview</span></lr-tree-item>
    </lr-tree>`);
    const [first, , last] = roots(tree);
    const targetRow = part(last!, 'row');
    const toward = point(targetRow, 0.75);
    const emitted = requests(tree);
    drag(part(first!, 'row'), toward);
    const indicator = visibleIndicator(tree)!.getBoundingClientRect();
    const bounds = targetRow.getBoundingClientRect();
    const indent = parseFloat(getComputedStyle(targetRow).paddingInlineStart);
    expect(indicator.left).to.be.closeTo(bounds.left, 1);
    expect(indicator.right).to.be.closeTo(bounds.right - indent, 1);
    const outside = point(last!.querySelector('span')!);
    expect(outside[1]).to.be.greaterThan(bounds.bottom);
    pointer(window, 'pointermove', outside);
    expect(Boolean(visibleIndicator(tree))).to.equal(false);
    pointer(window, 'pointerup', outside);
    expect(emitted.length).to.equal(0);
  });

  it('scrolls the native tree viewport when its base part owns the overflow', async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ id: String(index), label: `Row ${index}` }));
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable label="Outline" .data=${rows}></lr-tree>`);
    const base = part(tree, 'tree');
    base.style.maxHeight = '132px';
    base.style.overflowY = 'auto';
    const bounds = base.getBoundingClientRect();
    const edge: PointerPoint = [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.bottom - 8)];
    drag(part(roots(tree)[0]!, 'row'), edge);
    try {
      await waitUntil(() => base.scrollTop >= 44, 'scroll under the stationary pointer');
    } finally {
      pointer(window, 'pointercancel', edge);
    }
  });
});
