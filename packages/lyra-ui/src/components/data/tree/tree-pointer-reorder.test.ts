import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import './tree.js';
import type { LyraTree, LyraTreePointerReorderDetail } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

const data = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo', children: [{ id: 'c', label: 'Charlie' }] },
  { id: 'd', label: 'Delta' },
];

function row(node: LyraTreeItem): HTMLElement {
  return node.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
}

function point(node: LyraTreeItem, fraction: number): [number, number] {
  const box = row(node).getBoundingClientRect();
  return [Math.round(box.left + box.width / 2), Math.round(box.top + fraction * box.height)];
}

function listen(tree: LyraTree): LyraTreePointerReorderDetail[] {
  const requests: LyraTreePointerReorderDetail[] = [];
  tree.addEventListener('lr-pointer-reorder', event => { requests.push((event as CustomEvent<LyraTreePointerReorderDetail>).detail); });
  return requests;
}

async function start(source: LyraTreeItem, target: LyraTreeItem, fraction: number): Promise<void> {
  await hoverUntilMatched(row(source), 'place the native pointer on the source row before pressing');
  await sendMouse({ type: 'down' });
  await sendMouse({ type: 'move', position: point(target, fraction) });
  await settlePointer();
}

function indicator(tree: LyraTree): HTMLElement | null {
  return tree.shadowRoot!.querySelector<HTMLElement>('[part="drop-indicator"]:not([hidden])');
}

describe('pointer reorder', () => {
  afterEach(async () => { await resetMouse(); });

  it('requests a final sibling index only on release and preserves the installed data and selection', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable label="Contents" .data=${data}></lr-tree>`);
    const [first, , last] = [...tree.children] as LyraTreeItem[];
    const requests = listen(tree);
    const selections: Event[] = [];
    tree.addEventListener('lr-node-select', event => selections.push(event));
    const previous = tree.data;
    await start(first!, last!, 0.75);
    await waitUntil(() => Boolean(indicator(tree)), 'show insertion line after third row');
    expect(requests.length).to.equal(0);
    await sendMouse({ type: 'up' });
    await waitUntil(() => requests.length === 1, 'emit pointer move on release');
    expect(requests).to.deep.equal([{ nodeId: 'a', fromParentNodeId: null, fromIndex: 0,
      toParentNodeId: null, toIndex: 2, targetNodeId: 'd', position: 'after' }]);
    expect(Object.is(tree.data, previous)).to.equal(true);
    expect(tree.selectedItems.length).to.equal(0);
    expect(selections.length).to.equal(0);
    expect(indicator(tree) === null).to.equal(true);
  });

  it('requires cross-parent opt-in and checks the host policy again on release', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable label="Contents" .data=${data}></lr-tree>`);
    const [first, branch] = [...tree.children] as LyraTreeItem[];
    branch!.expand();
    await tree.updateComplete;
    const child = branch!.childItems()[0]!;
    const requests = listen(tree);
    await start(first!, child, 0.25);
    await sendMouse({ type: 'up' });
    expect(requests.length).to.equal(0);
    tree.allowCrossParentReorder = true;
    let allow = true;
    tree.canDrop = () => allow;
    await tree.updateComplete;
    await start(first!, child, 0.25);
    await waitUntil(() => Boolean(indicator(tree)), 'show accepted cross-parent target');
    allow = false;
    await sendMouse({ type: 'up' });
    expect(requests.length).to.equal(0);
    allow = true;
    await start(first!, child, 0.25);
    await sendMouse({ type: 'up' });
    await waitUntil(() => requests.length === 1, 'emit cross-parent move');
    expect(requests[0]).to.deep.equal({ nodeId: 'a', fromParentNodeId: null, fromIndex: 0,
      toParentNodeId: 'b', toIndex: 0, targetNodeId: 'c', position: 'before' });
  });

  it('rejects dropping a parent next to its descendant and Escape cancels an accepted drag', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable allow-cross-parent-reorder label="Contents" .data=${data}></lr-tree>`);
    const [first, branch, last] = [...tree.children] as LyraTreeItem[];
    branch!.expand();
    await tree.updateComplete;
    const requests = listen(tree);
    await start(branch!, branch!.childItems()[0]!, 0.75);
    await sendMouse({ type: 'up' });
    expect(requests.length).to.equal(0);
    await start(first!, last!, 0.75);
    await waitUntil(() => Boolean(indicator(tree)), 'show cancelable insertion line');
    await sendKeys({ press: 'Escape' });
    await sendMouse({ type: 'up' });
    expect(requests.length).to.equal(0);
    expect(indicator(tree) === null).to.equal(true);
  });

  it('keeps a native image drag inside an eligible row in the controlled reorder gesture', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree pointer-reorderable label="Illustrations">
      <lr-tree-item>
        <img alt="Alpha" draggable="true" width="40" height="32"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='32'%3E%3Crect width='40' height='32' fill='blue'/%3E%3C/svg%3E">
      </lr-tree-item>
      <lr-tree-item label="Beta"></lr-tree-item>
      <lr-tree-item label="Gamma"></lr-tree-item>
    </lr-tree>`);
    const [first, , last] = [...tree.children] as LyraTreeItem[];
    const thumbnail = first!.querySelector('img')!;
    const requests = listen(tree);
    const nativeDrags: DragEvent[] = [];
    thumbnail.addEventListener('dragstart', event => { if (event.isTrusted) nativeDrags.push(event); });
    const isPlaywrightWebKit = /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent);
    const probeDragStart = (): boolean =>
      thumbnail.dispatchEvent(new DragEvent('dragstart', { bubbles: true, composed: true, cancelable: true }));
    await thumbnail.decode();
    await hoverUntilMatched(thumbnail, 'place the pointer over the draggable image');
    const start = thumbnail.getBoundingClientRect();
    await sendMouse({ type: 'down' });
    expect(probeDragStart(), 'the active tree gesture cancels dragstart').to.equal(false);
    await sendMouse({ type: 'move', position: [Math.round(start.left + start.width / 2 + 10),
      Math.round(start.top + start.height / 2)] });
    await sendMouse({ type: 'move', position: point(last!, 0.75) });
    await sendMouse({ type: 'up' });
    // Playwright WebKit can deliver the pointer sequence without synthesizing an OS image drag.
    if (!isPlaywrightWebKit) expect(nativeDrags.length, 'the browser attempted a native image drag').to.be.greaterThan(0);
    expect(nativeDrags.every(event => event.defaultPrevented), 'the active tree gesture owns that drag').to.equal(true);
    expect(requests.map(request => [request.nodeId, request.targetNodeId])).to.deep.equal([[first!.nodeId, last!.nodeId]]);

    // A completed gesture releases its drag listeners, including when the tree switches modes.
    tree.pointerReorderable = false;
    await tree.updateComplete;
    expect(probeDragStart(), 'the completed gesture released its dragstart listener').to.equal(true);
    // The headless WebKit driver cannot finish an unowned native image drag. The cancelable
    // event above exercises cleanup on every engine; the other drivers also deliver the OS drag.
    if (!isPlaywrightWebKit) {
      const completedDrags = nativeDrags.length;
      await hoverUntilMatched(thumbnail, 'return to the image after disabling pointer reorder');
      await sendMouse({ type: 'down' });
      await sendMouse({ type: 'move', position: point(last!, 0.75) });
      await sendMouse({ type: 'up' });
      const unownedDrags = nativeDrags.slice(completedDrags);
      expect(unownedDrags.length, 'the browser attempted its normal image drag').to.be.greaterThan(0);
      expect(unownedDrags.every(event => !event.defaultPrevented), 'the image regains its native drag').to.equal(true);
    }
    expect(requests.length).to.equal(1);
  });

  it('leaves keyboard-only trees free of pointer reorder state or requests', async () => {
    const tree = await fixture<LyraTree>(html`<lr-tree reorderable label="Contents" .data=${data}></lr-tree>`);
    const [first, , last] = [...tree.children] as LyraTreeItem[];
    const requests = listen(tree);
    await start(first!, last!, 0.75);
    await sendMouse({ type: 'up' });
    expect(requests.length).to.equal(0);
    expect(indicator(tree) === null).to.equal(true);
    expect(getComputedStyle(row(first!)).touchAction).to.equal('auto');
  });
});
