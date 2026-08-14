import { fixture, expect, html } from '@open-wc/testing';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';

it("survives keyboard navigation over slotted tree-items that carry no item", async () => {
  // `<lr-tree>`'s documented slot takes `<lr-tree-item>` elements, and `item` is `attribute: false`
  // -- so any consumer writing the tree declaratively in HTML necessarily gets nodes whose `item`
  // is undefined. `visibleNodeElements()` already guards with `n.item?.disabled`, but the keyboard
  // handler and `focusNode()` read `n.item.id` bare, throwing a TypeError on the first arrow key.
  const el = (await fixture(html`
    <lr-tree>
      <lr-tree-item>Alpha</lr-tree-item>
      <lr-tree-item>Beta</lr-tree-item>
    </lr-tree>
  `)) as LyraTree;
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector('[part~="base"]') ?? el;
  const press = (key: string) =>
    base.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true }));

  expect(() => press("ArrowDown")).to.not.throw();
  expect(() => press("ArrowUp")).to.not.throw();
  expect(() => press("Home")).to.not.throw();
  expect(() => press("End")).to.not.throw();
});

// The declarative child model end to end. A `wa-tree`/`sl-tree` app migrates by renaming tags only,
// so this markup shape -- no `data` property anywhere -- has to be a working tree: rendered rows,
// no empty state, a roving tabindex, arrow navigation and correct set-position ARIA.

describe('tree declarative child model', () => {
  const declarative = html`
    <lr-tree label="Docs">
      <lr-tree-item label="Guides">
        <lr-tree-item label="Install"></lr-tree-item>
        <lr-tree-item label="Usage"></lr-tree-item>
      </lr-tree-item>
      <lr-tree-item label="Reference"></lr-tree-item>
    </lr-tree>
  `;

  const press = (el: LyraTree, key: string): void => {
    const base = el.shadowRoot!.querySelector('[part~="base"]') ?? el;
    base.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
  };

  it('renders slotted items instead of the empty state, with no data assigned', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;

    // Never hand chai a DOM node as actual/expected -- compare a boolean instead.
    expect(el.shadowRoot!.querySelector('lr-empty') === null, 'no empty state while items are slotted').to.be
      .true;
    const [guides, reference] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(guides!.getAttribute('aria-level')).to.equal('1');
    expect(guides!.getAttribute('aria-setsize')).to.equal('2');
    expect(guides!.getAttribute('aria-posinset')).to.equal('1');
    expect(reference!.getAttribute('aria-posinset')).to.equal('2');
    expect(guides!.tabIndex, 'the first slotted item owns the roving tabindex').to.equal(0);
    expect(reference!.tabIndex).to.equal(-1);
  });

  it('gives nested slotted items their own depth and set-position ARIA once expanded', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    guides.expand();
    await el.updateComplete;

    const [install, usage] = [...guides.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(install!.getAttribute('aria-level')).to.equal('2');
    expect(install!.getAttribute('aria-setsize')).to.equal('2');
    expect(usage!.getAttribute('aria-posinset')).to.equal('2');
  });

  it('navigates slotted items with the arrow keys, stepping into an expanded branch', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    const [guides, reference] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];

    press(el, 'ArrowRight'); // expand, focus stays put
    await el.updateComplete;
    expect(guides!.expanded).to.be.true;

    press(el, 'ArrowDown'); // step into the first child
    await el.updateComplete;
    const install = guides!.querySelector('lr-tree-item') as LyraTreeItem;
    expect(install.tabIndex).to.equal(0);
    expect(guides!.tabIndex).to.equal(-1);

    press(el, 'End');
    await el.updateComplete;
    expect(reference!.tabIndex).to.equal(0);
  });

  it('expandAll()/collapseAll() reach slotted descendants', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    await el.expandAll();
    expect(guides.expanded).to.be.true;
    await el.collapseAll();
    await el.updateComplete;
    expect(guides.expanded).to.be.false;
  });

  it('skips a disabled slotted item in roving focus and arrow navigation', async () => {
    const el = (await fixture(html`
      <lr-tree label="Docs">
        <lr-tree-item label="Disabled" disabled></lr-tree-item>
        <lr-tree-item label="First enabled"></lr-tree-item>
        <lr-tree-item label="Second enabled"></lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const [disabled, first, second] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];

    expect(disabled!.getAttribute('aria-disabled')).to.equal('true');
    expect(disabled!.tabIndex).to.equal(-1);
    expect(first!.tabIndex, 'the roving stop skips past the disabled item').to.equal(0);

    press(el, 'ArrowDown');
    await el.updateComplete;
    expect(second!.tabIndex).to.equal(0);
    press(el, 'Home');
    await el.updateComplete;
    expect(first!.tabIndex, 'Home lands on the first *enabled* item').to.equal(0);
  });

  it('ignores data while author-written items are present', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    el.data = [{ id: 'from-data', label: 'From data' }];
    await el.updateComplete;

    const tops = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(tops.map((node) => node.label)).to.eql(['Guides', 'Reference']);
    expect(el.shadowRoot!.querySelector('lr-empty') === null, 'still no empty state').to.be.true;
  });

  it('never interleaves generated data items with dynamically-added declarative items', async () => {
    const el = (await fixture(html`<lr-tree label="Docs"></lr-tree>`)) as LyraTree;
    el.data = [{ id: 'from-data', label: 'From data' }];
    await el.updateComplete;
    expect(el.querySelectorAll(':scope > lr-tree-item').length).to.equal(1);

    const authored = document.createElement('lr-tree-item') as LyraTreeItem;
    authored.label = 'Authored';
    el.appendChild(authored);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    let tops = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(tops.map((node) => node.nodeLabel)).to.eql(['Authored']);

    authored.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    tops = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(tops.map((node) => node.item.id)).to.eql(['from-data']);
  });

  it('re-homes the roving tabindex when the active slotted item is removed', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    const [guides, reference] = [...el.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    expect(guides!.tabIndex).to.equal(0);

    guides!.remove();
    await new Promise((resolve) => setTimeout(resolve, 0)); // let slotchange land
    await el.updateComplete;
    expect(reference!.tabIndex, 'the surviving item must keep the tree in the tab order').to.equal(0);
  });

  it('requests a sibling-scoped reorder for a nested slotted item', async () => {
    const el = (await fixture(html`
      <lr-tree label="Docs" reorderable>
        <lr-tree-item label="Guides" expanded>
          <lr-tree-item label="Install"></lr-tree-item>
          <lr-tree-item label="Usage"></lr-tree-item>
        </lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    const [install] = [...guides.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    install!.focus();
    install!.select();
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('lr-reorder', (e) => events.push(e as CustomEvent));
    install!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, ctrlKey: true }),
    );
    await el.updateComplete;

    expect(events.length).to.equal(1);
    expect(events[0]!.detail).to.deep.equal({
      id: install!.nodeId,
      parentId: guides.nodeId,
      fromIndex: 0,
      toIndex: 1,
    });
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement;
    expect((region.shadowRoot?.textContent ?? '').trim()).to.equal('');
  });

  it('announces a nested declarative reorder only after the host moves the requested node', async () => {
    const el = (await fixture(html`
      <lr-tree label="Docs" reorderable>
        <lr-tree-item label="Guides" expanded>
          <lr-tree-item label="Install"></lr-tree-item>
          <lr-tree-item label="Usage"></lr-tree-item>
        </lr-tree-item>
      </lr-tree>
    `)) as LyraTree;
    await el.updateComplete;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    const [install] = [...guides.querySelectorAll(':scope > lr-tree-item')] as LyraTreeItem[];
    install.focus();
    install.select();
    await el.updateComplete;
    el.addEventListener('lr-reorder', () => guides.append(install));

    install.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, ctrlKey: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;

    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement;
    expect(region.shadowRoot?.textContent).to.contain('Install');
    expect(region.shadowRoot?.textContent).to.contain('2');
  });

  it('renders a nested item that a host promotes to the top level', async () => {
    // Its former parent gave it slot="children"; <lr-tree> only has a default slot, so a stale
    // `slot` would leave the promoted node assigned to nothing and rendering nowhere.
    const el = (await fixture(declarative)) as LyraTree;
    const guides = el.querySelector('lr-tree-item') as LyraTreeItem;
    guides.expand();
    await el.updateComplete;
    const install = guides.querySelector('lr-tree-item') as LyraTreeItem;
    expect(install.getAttribute('slot')).to.equal('children');

    el.appendChild(install);
    await new Promise((resolve) => setTimeout(resolve, 0)); // let slotchange land
    await el.updateComplete;

    expect(install.hasAttribute('slot'), 'the stale slot must be cleared').to.be.false;
    expect(install.assignedSlot === null, 'it must be assigned to the default slot').to.be.false;
    expect(install.getAttribute('aria-level')).to.equal('1');
    expect(install.getAttribute('aria-posinset')).to.equal('3');
  });

  it('still tracks new items after being disconnected and reconnected', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    parent.appendChild(el);
    await el.updateComplete;

    const added = document.createElement('lr-tree-item') as LyraTreeItem;
    added.label = 'Appendix';
    el.appendChild(added);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;

    expect(added.getAttribute('aria-posinset')).to.equal('3');
    expect(added.getAttribute('aria-setsize')).to.equal('3');
  });

  it('recreates its child observer in the adopted owner realm and ignores the stale callback', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.updateComplete;
    el.remove();
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      frame.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    const originalMutationObserver = frameWindow.MutationObserver;
    let treeCallback: MutationCallback | undefined;
    let treeObservations = 0;
    let treeDisconnects = 0;
    class OwnerMutationObserver implements MutationObserver {
      private readonly callback: MutationCallback;
      private observesTree = false;
      constructor(callback: MutationCallback) { this.callback = callback; }
      observe(target: Node, options?: MutationObserverInit): void {
        if (target !== el || !options?.attributeFilter?.includes('inert')) return;
        this.observesTree = true;
        treeObservations += 1;
        treeCallback = this.callback;
      }
      takeRecords(): MutationRecord[] { return []; }
      disconnect(): void { if (this.observesTree) treeDisconnects += 1; }
    }
    frameWindow.MutationObserver = OwnerMutationObserver;

    try {
      frameDocument.adoptNode(el);
      expect(treeObservations, 'detached adoption must not arm an observer').to.equal(0);
      frameDocument.body.append(el);
      await el.updateComplete;
      expect(treeObservations, 'the destination window observes the tree').to.equal(1);
      expect(treeCallback).to.be.a('function');
      const staleCallback = treeCallback!;

      document.adoptNode(el);
      document.body.append(el);
      await el.updateComplete;
      expect(treeDisconnects, 'adoption disconnects the destination observer').to.equal(1);

      let requestedUpdates = 0;
      const requestUpdate = el.requestUpdate.bind(el);
      (el as unknown as { requestUpdate(): void }).requestUpdate = () => {
        requestedUpdates += 1;
        requestUpdate();
      };
      staleCallback(
        [{ type: 'attributes', attributeName: 'inert' } as MutationRecord],
        {} as MutationObserver,
      );
      expect(requestedUpdates, 'a callback retained by the old realm is inert after reconnect').to.equal(0);
    } finally {
      frameWindow.MutationObserver = originalMutationObserver;
      if (el.ownerDocument !== document) document.adoptNode(el);
      el.remove();
      frame.remove();
    }
  });

  it('recognizes a tree-item-shaped target from a foreign composed path without instanceof', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) {
      frame.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    const foreignItem = frameDocument.createElement('lr-tree-item') as HTMLElement & { nodeId: string };
    foreignItem.nodeId = 'foreign-item';
    const internals = el as unknown as {
      onTreeFocusIn(event: FocusEvent): void;
      lastFocusedNodeId: string | null;
    };

    try {
      internals.onTreeFocusIn({ composedPath: () => [foreignItem] } as unknown as FocusEvent);
      expect(internals.lastFocusedNodeId).to.equal('foreign-item');
    } finally {
      frame.remove();
    }
  });

  it('is accessible when written declaratively', async () => {
    const el = (await fixture(declarative)) as LyraTree;
    await el.expandAll();
    await expect(el).to.be.accessible();
  });
});
