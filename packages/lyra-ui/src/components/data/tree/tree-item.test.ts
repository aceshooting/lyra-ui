import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './tree-item.js';
import './tree.js';
import { LyraTreeItem } from './tree-item.js';
import {
  configureTreeItemOwner,
  setTreeItemSelection,
  treeItemOwnerContext,
} from './tree-owner-controller.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const item = { id: '1', label: 'Root' };

const configureOwnedItem = (
  el: LyraTreeItem,
  overrides: Partial<Parameters<typeof configureTreeItemOwner>[1]> = {},
): void => {
  configureTreeItemOwner(el, {
    ...treeItemOwnerContext(el),
    activeId: el.nodeId,
    ancestry: [],
    depth: 0,
    setSize: 1,
    posInSet: 1,
    selection: 'single',
    ownsSelection: true,
    expandIcon: null,
    collapseIcon: null,
    ...overrides,
  });
};

/** The text a declarative item actually projects into `[part="label"]` -- its own fallback text plus
 *  whatever the default slot renders. Reads the *rendered* projection, not the light DOM. */
const renderedLabel = (el: LyraTreeItem): string => {
  const label = el.shadowRoot!.querySelector('[part="label"]')!;
  const slot = label.querySelector('slot') as HTMLSlotElement | null;
  const visible = (nodes: Node[]): string[] =>
    // Lit's own marker comments live in here too, and a comment's textContent is that marker.
    nodes
      .filter((n) => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE)
      .map((n) => n.textContent ?? '');
  const slotted = slot ? visible(slot.assignedNodes({ flatten: true })) : [];
  const own = visible([...label.childNodes].filter((n) => n.nodeName !== 'SLOT'));
  return [...own, ...slotted].join('').trim();
};

// `item` is assigned by `<lr-tree>` in the data-driven model, but the tag is registered publicly, so
// a bare `document.createElement('lr-tree-item')` must complete its first update cycle (and later
// ones) without dereferencing the missing item -- it renders as an empty declarative leaf until
// either a `label`/slotted content or an `item` arrives.
it('completes its lifecycle without an item, then renders once one is assigned', async () => {
  const el = document.createElement('lr-tree-item') as LyraTreeItem;
  document.body.appendChild(el);
  try {
    await el.updateComplete;
    expect(renderedLabel(el)).to.equal('');
    expect(el.getAttribute('role')).to.equal('treeitem');
    expect(el.hasChildren).to.be.false;

    el.item = item;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Root');
  } finally {
    el.remove();
  }
});

it('can clear item back to the declarative model without retaining data-owned state', async () => {
  const el = (await fixture(html`<lr-tree-item label="Declarative label"></lr-tree-item>`)) as LyraTreeItem;
  el.item = {
    id: 'data',
    label: 'Data label',
    selected: true,
    lazy: true,
    children: [{ id: 'child', label: 'Child' }],
  };
  await el.updateComplete;
  expect(renderedLabel(el)).to.equal('Data label');

  el.item = undefined;
  await el.updateComplete;
  expect(el.item).to.be.undefined;
  expect(el.selected).to.be.false;
  expect(el.lazy).to.be.false;
  expect(renderedLabel(el)).to.equal('Declarative label');
});

describe('ElementInternals availability', () => {
  it('constructs and renders a standalone item when attachInternals is absent', async () => {
    const original = HTMLElement.prototype.attachInternals;
    let el: LyraTreeItem | undefined;
    // @ts-expect-error -- simulating a downstream DOM shim without ElementInternals support
    delete HTMLElement.prototype.attachInternals;
    try {
      expect(() => {
        el = new LyraTreeItem();
      }).to.not.throw();
      document.body.append(el!);
      await el!.updateComplete;
      expect(el!.getAttribute('role')).to.equal('treeitem');
    } finally {
      HTMLElement.prototype.attachInternals = original;
      el?.remove();
    }
  });

  it('constructs and renders generated items when attachInternals throws', async () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
      if (this.localName === 'lr-tree-item') {
        throw new DOMException('ElementInternals unavailable', 'NotSupportedError');
      }
      return original.call(this);
    };
    try {
      const tree = await fixture(html`
        <lr-tree .data=${[{ id: 'root', label: 'Root' }]}></lr-tree>
      `);
      await (tree as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      const generated = tree.querySelector('lr-tree-item') as LyraTreeItem | null;
      expect(generated !== null).to.equal(true);
      await generated!.updateComplete;
      expect(generated!.getAttribute('role')).to.equal('treeitem');
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });

  it('constructs and renders when a partial polyfill returns no internals object', async () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
      if (this.localName === 'lr-tree-item') return undefined as unknown as ElementInternals;
      return original.call(this);
    };
    try {
      const el = (await fixture(html`<lr-tree-item label="Leaf"></lr-tree-item>`)) as LyraTreeItem;
      await el.updateComplete;
      expect(renderedLabel(el)).to.equal('Leaf');
      expect(el.getAttribute('role')).to.equal('treeitem');
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

// The declarative child model. `<lr-tree-item>` mirrors `wa-tree-item`/`sl-tree-item`, whose whole
// child model is markup: the default slot carries the label and nested `<lr-tree-item>` elements
// carry the hierarchy. A migration codemod only renames the tag, so markup that arrives with no
// `.item` object assigned has to render on its own -- these lock that contract.
describe('tree-item declarative child model', () => {
  it('renders the label attribute when no item object is assigned', async () => {
    const el = (await fixture(html`<lr-tree-item label="Docs"></lr-tree-item>`)) as LyraTreeItem;
    expect(renderedLabel(el)).to.equal('Docs');
    expect(el.hasChildren).to.be.false;
  });

  it('renders slotted label content, so mechanically renamed markup is never blank', async () => {
    const el = (await fixture(html`<lr-tree-item>Docs</lr-tree-item>`)) as LyraTreeItem;
    expect(renderedLabel(el)).to.equal('Docs');
  });

  it('updates the rendered label and internal checkbox name for direct descendant mutations', async () => {
    const el = (await fixture(html`<lr-tree-item label="Fallback"></lr-tree-item>`)) as LyraTreeItem;
    const assigned = el.ownerDocument.createTextNode(' ');
    el.append(assigned);
    configureOwnedItem(el, { selection: 'multiple' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;
    };

    expect(renderedLabel(el), 'an empty element does not suppress the label fallback').to.equal('Fallback');
    expect(el.nodeLabel).to.equal('Fallback');
    expect(el.shadowRoot!.querySelector('[part="checkbox"]')!.getAttribute('aria-hidden')).to.equal('true');

    assigned.data = 'Direct tree label';
    await settle();
    expect(renderedLabel(el)).to.equal('Direct tree label');
    expect(el.nodeLabel).to.equal('Direct tree label');

    assigned.data = ' ';
    await settle();
    expect(renderedLabel(el)).to.equal('Fallback');
    expect(el.nodeLabel).to.equal('Fallback');
  });

  it('resamples cached label and child presence after delayed mutations while detached', async () => {
    const mount = (await fixture(html`<div>
      <lr-tree-item label="Fallback" expanded>
        <lr-tree-item label="Original child"></lr-tree-item>
      </lr-tree-item>
    </div>`)) as HTMLDivElement;
    const el = mount.querySelector('lr-tree-item') as LyraTreeItem;
    await el.updateComplete;
    expect(renderedLabel(el)).to.equal('Fallback');
    expect(el.shadowRoot!.querySelector('[part="group"]') !== null).to.equal(true);

    el.remove();
    // Ensure the mutation occurs after disconnectedCallback() has torn down the observer rather
    // than inside the same mutation checkpoint as removal.
    await new Promise((resolve) => setTimeout(resolve, 0));
    el.querySelector('lr-tree-item')!.remove();
    el.append(el.ownerDocument.createTextNode('Detached label'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    mount.append(el);
    await el.updateComplete;
    expect(renderedLabel(el)).to.equal('Detached label');
    expect(el.hasChildren).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="group"]') === null).to.equal(true);
    expect(el.hasAttribute('aria-expanded')).to.be.false;
  });

  it('tracks flattened accessible labels through a forwarding slot and keeps host naming authoritative', async () => {
    const details = (await fixture(html`
      <details open>
        <summary>Forwarded tree fixture</summary>
        <div></div>
      </details>
    `)) as HTMLDetailsElement;
    const wrapper = details.querySelector('div')!;
    const assignedText = wrapper.ownerDocument.createTextNode(' ');
    wrapper.append(assignedText);
    const root = wrapper.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host(.hide-forwarded-label) slot::slotted([data-label]) { display: none; }
        slot::slotted([data-label]) {
          visibility: var(--forwarded-label-visibility, visible);
        }
      </style>
      <lr-tree-item label="Fallback">
        <slot><span>Forwarding fallback</span></slot>
      </lr-tree-item>
    `;
    const el = root.querySelector('lr-tree-item') as LyraTreeItem;
    configureOwnedItem(el, { selection: 'multiple' });
    const forwardingSlot = el.querySelector('slot')!;
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;
    };

    await settle();
    expect(renderedLabel(el), 'an empty assignment suppresses slot fallback').to.equal('Fallback');
    expect(el.nodeLabel).to.equal('Fallback');

    assignedText.data = 'Forwarded tree label';
    await settle();
    expect(renderedLabel(el)).to.equal('Forwarded tree label');
    expect(el.nodeLabel).to.equal('Forwarded tree label');

    wrapper.setAttribute('aria-hidden', ' TRUE ');
    await settle();
    expect(
      el.nodeLabel,
      'a hard-hidden composed parent prunes a forwarded root Text node'
    ).to.equal('Fallback');

    wrapper.removeAttribute('aria-hidden');
    await settle();
    expect(el.nodeLabel).to.equal('Forwarded tree label');

    details.open = false;
    await settle();
    expect(
      el.nodeLabel,
      'a closed details ancestor prunes a forwarded root Text node'
    ).to.equal('Fallback');

    details.open = true;
    await settle();
    expect(el.nodeLabel).to.equal('Forwarded tree label');

    assignedText.data = ' ';
    await settle();
    expect(renderedLabel(el)).to.equal('Fallback');

    const assigned = wrapper.ownerDocument.createElement('span');
    assigned.setAttribute('data-label', '');
    assigned.setAttribute('aria-label', 'Forwarded accessible name');
    assignedText.replaceWith(assigned);
    await settle();
    expect(el.nodeLabel).to.equal('Forwarded accessible name');
    expect(el.nodeLabel).to.equal('Forwarded accessible name');

    assigned.textContent = 'Decorative tree glyph';
    assigned.setAttribute('aria-hidden', ' TRUE ');
    await settle();
    expect(
      el.shadowRoot!.querySelector('[part="label"] slot') !== null,
      'aria-hidden visual content still selects the authored slot'
    ).to.be.true;
    expect(el.nodeLabel).to.equal('Fallback');

    assigned.removeAttribute('aria-hidden');
    assigned.style.display = 'none';
    await settle();
    expect(el.shadowRoot!.querySelector('[part="label"] slot') !== null).to.be.true;
    expect(el.nodeLabel).to.equal('Fallback');

    assigned.style.removeProperty('display');
    assigned.hidden = true;
    await settle();
    expect(el.shadowRoot!.querySelector('[part="label"] slot') !== null).to.be.true;
    expect(el.nodeLabel).to.equal('Fallback');

    assigned.hidden = false;
    await settle();
    expect(el.nodeLabel).to.equal('Forwarded accessible name');

    wrapper.classList.add('hide-forwarded-label');
    await settle();
    expect(
      el.nodeLabel,
      'a forwarding-host class mutation refreshes the checkbox name'
    ).to.equal('Fallback');

    wrapper.classList.remove('hide-forwarded-label');
    await settle();
    expect(el.nodeLabel).to.equal('Forwarded accessible name');

    wrapper.style.setProperty('--forwarded-label-visibility', 'hidden');
    await settle();
    expect(
      el.nodeLabel,
      'a forwarding-host style mutation refreshes the checkbox name'
    ).to.equal('Fallback');

    wrapper.style.removeProperty('--forwarded-label-visibility');
    await settle();
    expect(el.nodeLabel).to.equal('Forwarded accessible name');

    forwardingSlot.setAttribute('aria-hidden', 'true');
    await settle();
    expect(el.nodeLabel).to.equal('Fallback');

    forwardingSlot.removeAttribute('aria-hidden');
    forwardingSlot.style.display = 'none';
    await settle();
    expect(el.nodeLabel).to.equal('Fallback');

    forwardingSlot.style.removeProperty('display');
    await settle();
    expect(el.nodeLabel).to.equal('Forwarded accessible name');

    el.setAttribute('aria-label', 'Explicit tree item name');
    await el.updateComplete;
    assigned.textContent = 'Later visible text';
    await settle();
    expect(el.nodeLabel, 'the consumer host name keeps precedence').to.equal(
      'Explicit tree item name'
    );

    el.removeAttribute('aria-label');
    const reassigned = new Promise<void>((resolve) =>
      forwardingSlot.addEventListener('slotchange', () => resolve(), {
        once: true,
      })
    );
    assigned.remove();
    await reassigned;
    await settle();
    expect(renderedLabel(el)).to.equal('Forwarding fallback');
    expect(el.nodeLabel).to.equal('Forwarding fallback');
  });

  it('constructs its child-label observer in the adopted owner realm', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameWindow = frame.contentWindow!;
    const frameDocument = frame.contentDocument!;
    const observerDescriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
    const NativeMutationObserver = frameWindow.MutationObserver;
    let constructions = 0;
    let adoptedTarget: LyraTreeItem | undefined;
    let labelHostObservations = 0;
    class TrackingMutationObserver extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        constructions += 1;
      }
      override observe(target: Node, options?: MutationObserverInit): void {
        if (target === adoptedTarget && options?.childList && options.characterData && options.subtree)
          labelHostObservations += 1;
        super.observe(target, options);
      }
    }
    Object.defineProperty(frameWindow, 'MutationObserver', {
      configurable: true,
      value: TrackingMutationObserver,
    });
    const el = (await fixture(html`
      <lr-tree-item label="Fallback"><span>Parent label</span></lr-tree-item>
    `)) as LyraTreeItem;
    adoptedTarget = el;
    el.remove();
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      expect(constructions).to.be.greaterThan(1);
      expect(labelHostObservations).to.be.greaterThan(0);
      expect(el.nodeLabel).to.equal('Parent label');
    } finally {
      el.remove();
      if (observerDescriptor) {
        Object.defineProperty(frameWindow, 'MutationObserver', observerDescriptor);
      } else {
        Reflect.deleteProperty(frameWindow, 'MutationObserver');
      }
      frame.remove();
    }
  });

  it('retains the timer owner while adopting and reads motion state from the new owner realm', async () => {
    const frame = document.createElement('iframe');
    const loaded = oneEvent(frame, 'load');
    frame.srcdoc = '<!doctype html><html><body></body></html>';
    document.body.append(frame);
    await loaded;

    const frameWindow = frame.contentWindow!;
    const frameDocument = frame.contentDocument!;
    const originalParentSetTimeout = window.setTimeout;
    const originalParentClearTimeout = window.clearTimeout;
    const originalFrameSetTimeout = frameWindow.setTimeout;
    const originalFrameClearTimeout = frameWindow.clearTimeout;
    const originalFrameMatchMedia = frameWindow.matchMedia;
    const originalFrameGetComputedStyle = frameWindow.getComputedStyle;
    const parentCallbacks = new Map<number, VoidFunction>();
    const frameCallbacks = new Map<number, VoidFunction>();
    const parentSchedules: Array<{ handle: number; delay: number }> = [];
    const frameSchedules: Array<{ handle: number; delay: number }> = [];
    const parentClears: number[] = [];
    const frameClears: number[] = [];
    let parentHandle = 801;
    let frameHandle = 901;
    let frameMotionQueries = 0;
    let frameStyleReads = 0;
    let el: LyraTreeItem | undefined;

    window.setTimeout = ((handler: TimerHandler, delay = 0) => {
      if (typeof handler !== 'function') throw new TypeError('Expected a timer callback.');
      const handle = parentHandle++;
      parentCallbacks.set(handle, handler as VoidFunction);
      parentSchedules.push({ handle, delay });
      return handle;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) parentClears.push(handle);
    }) as typeof window.clearTimeout;
    frameWindow.setTimeout = ((handler: TimerHandler, delay = 0) => {
      if (typeof handler !== 'function') throw new TypeError('Expected a timer callback.');
      const handle = frameHandle++;
      frameCallbacks.set(handle, handler as VoidFunction);
      frameSchedules.push({ handle, delay });
      return handle;
    }) as typeof frameWindow.setTimeout;
    frameWindow.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) frameClears.push(handle);
    }) as typeof frameWindow.clearTimeout;
    frameWindow.matchMedia = ((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') frameMotionQueries += 1;
      return { matches: false, media: query } as MediaQueryList;
    }) as typeof frameWindow.matchMedia;
    frameWindow.getComputedStyle = ((element: Element, pseudo?: string | null) => {
      if (element === el) frameStyleReads += 1;
      return originalFrameGetComputedStyle.call(frameWindow, element, pseudo);
    }) as typeof frameWindow.getComputedStyle;

    try {
      el = (await fixture(html`
        <lr-tree-item label="Parent" style="--show-duration: 19ms; --hide-duration: 23ms">
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
      `)) as LyraTreeItem;
      await el.updateComplete;

      let afterExpand = 0;
      let afterCollapse = 0;
      el.addEventListener('lr-after-expand', () => afterExpand++);
      el.addEventListener('lr-after-collapse', () => afterCollapse++);

      el.expand();
      await el.updateComplete;
      await Promise.resolve();
      expect(parentSchedules.map(({ delay }) => delay)).to.eql([19]);
      const oldTimer = parentSchedules[0]!.handle;
      const staleCallback = parentCallbacks.get(oldTimer)!;

      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      expect(parentClears, 'disconnect cancels through the retained old timer owner').to.include(oldTimer);

      el.collapse();
      await el.updateComplete;
      await Promise.resolve();
      expect(parentSchedules, 'the adopted item never schedules another parent timer').to.have.length(1);
      expect(frameMotionQueries, 'reduced-motion state comes from the adopted window').to.be.greaterThan(0);
      expect(frameStyleReads, 'motion custom properties come from the adopted window').to.be.greaterThan(0);

      staleCallback();
      expect(afterExpand, 'a canceled old-realm callback stays stale after adoption').to.equal(0);
      if (frameSchedules.length > 0) {
        expect(frameSchedules.map(({ delay }) => delay)).to.eql([23]);
        expect(afterCollapse).to.equal(0);
        frameCallbacks.get(frameSchedules[0]!.handle)!();
      }
      await el.updateComplete;
      await Promise.resolve();
      expect(afterCollapse).to.equal(1);
    } finally {
      el?.remove();
      window.setTimeout = originalParentSetTimeout;
      window.clearTimeout = originalParentClearTimeout;
      frameWindow.setTimeout = originalFrameSetTimeout;
      frameWindow.clearTimeout = originalFrameClearTimeout;
      frameWindow.matchMedia = originalFrameMatchMedia;
      frameWindow.getComputedStyle = originalFrameGetComputedStyle;
      frame.remove();
    }
  });

  it('projects nested items into the group slot rather than the label, and offers a toggle', async () => {
    const el = (await fixture(html`
      <lr-tree-item label="Parent">
        <lr-tree-item label="Child"></lr-tree-item>
      </lr-tree-item>
    `)) as LyraTreeItem;

    expect(renderedLabel(el), 'a nested item must not leak into the label').to.equal('Parent');
    expect(el.hasChildren).to.be.true;
    expect(el.getAttribute('aria-expanded')).to.equal('false');
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!;
    expect(toggle.hidden).to.be.false;
    // Never hand chai a DOM node as actual/expected -- compare a boolean instead.
    expect(el.shadowRoot!.querySelector('[part="group"]') === null, 'collapsed: no group').to.be.true;

    el.expand();
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="group"]')!;
    expect(group.getAttribute('role')).to.equal('group');
    const groupSlot = group.querySelector('slot') as HTMLSlotElement;
    expect(groupSlot.assignedElements().map((child) => child.getAttribute('label'))).to.eql(['Child']);
    expect(el.getAttribute('aria-expanded')).to.equal('true');
  });

  it('emits lr-node-toggle and lr-node-select with a generated id for a declarative item', async () => {
    const el = (await fixture(html`
      <lr-tree-item label="Parent"><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
    `)) as LyraTreeItem;
    expect(el.nodeId).to.be.a('string').and.to.have.length.greaterThan(0);

    const toggled = oneEvent(el, 'lr-node-toggle');
    el.expand();
    expect((await toggled).detail).to.eql({ nodeId: el.nodeId, expanded: true });

    const selected = oneEvent(el, 'lr-node-select');
    el.select();
    expect((await selected).detail).to.eql({ nodeId: el.nodeId });
  });

  it('reflects declarative disabled/selected state into ARIA and keeps a disabled item inert', async () => {
    const el = (await fixture(html`
      <lr-tree-item label="Parent" disabled selected><lr-tree-item label="Child"></lr-tree-item></lr-tree-item>
    `)) as LyraTreeItem;

    expect(el.getAttribute('aria-disabled')).to.equal('true');
    expect(el.getAttribute('aria-selected')).to.equal('true');
    expect(el.isDisabled).to.be.true;

    let selections = 0;
    el.addEventListener('lr-node-select', () => selections++);
    el.select();
    el.expand();
    await el.updateComplete;
    expect(selections).to.equal(0);
    expect(el.expanded).to.be.false;
  });

  it('renders both aria-selected states, never dropping the attribute for an unselected item', async () => {
    const el = (await fixture(html`<lr-tree-item label="Parent"></lr-tree-item>`)) as LyraTreeItem;
    expect(el.getAttribute('aria-selected')).to.equal('false');
    el.selected = true;
    await el.updateComplete;
    expect(el.getAttribute('aria-selected')).to.equal('true');
  });

  it('leaves a host-authored aria-label alone in the declarative model', async () => {
    const el = (await fixture(
      html`<lr-tree-item label="Docs" aria-label="Documentation folder"></lr-tree-item>`
    )) as LyraTreeItem;
    expect(el.getAttribute('aria-label')).to.equal('Documentation folder');
  });

  it('keeps an initial host-authored aria-label authoritative after data-model assignment', async () => {
    const el = (await fixture(html`<lr-tree-item aria-label="Author name"></lr-tree-item>`)) as LyraTreeItem;

    el.item = {
      id: 'data',
      label: 'Visible data label',
      accessibleLabel: 'Data name',
    };
    await el.updateComplete;

    expect(el.getAttribute('aria-label')).to.equal('Author name');
    expect(el.nodeLabel).to.equal('Author name');
  });

  it('preserves a late host-authored aria-label across data refreshes and restores data naming after removal', async () => {
    const el = (await fixture(html`<lr-tree-item></lr-tree-item>`)) as LyraTreeItem;
    el.item = {
      id: 'data',
      label: 'Visible data label',
      accessibleLabel: 'Initial data name',
    };
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('Initial data name');

    el.setAttribute('aria-label', 'Late author name');
    await el.updateComplete;
    el.item = {
      id: 'data',
      label: 'Refreshed label',
      accessibleLabel: 'Refreshed data name',
    };
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('Late author name');
    expect(el.nodeLabel).to.equal('Late author name');

    el.item = { id: 'data', label: 'Label-only fallback' };
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('Late author name');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(el.hasAttribute('aria-label')).to.equal(false);
    expect(el.nodeLabel).to.equal('Label-only fallback');
  });

  it('lets an assigned item object win over the declarative attributes', async () => {
    const el = (await fixture(html`<lr-tree-item label="Declarative"></lr-tree-item>`)) as LyraTreeItem;
    el.item = { id: 'data', label: 'From data' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('From data');
    expect(el.nodeId).to.equal('data');
  });

  it('picks up a nested item appended after the first render', async () => {
    const el = (await fixture(html`<lr-tree-item label="Parent"></lr-tree-item>`)) as LyraTreeItem;
    expect(el.hasChildren).to.be.false;

    const child = document.createElement('lr-tree-item') as LyraTreeItem;
    child.label = 'Late child';
    el.appendChild(child);
    await el.updateComplete;
    expect(el.hasChildren).to.be.true;
    expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.hidden).to.be.false;
  });

  it('is accessible as a declarative branch inside a tree', async () => {
    const wrapper = await fixture(html`
      <div role="tree" aria-label="Docs">
        <lr-tree-item label="Parent" expanded style="--show-duration: 0ms">
          <lr-tree-item label="Child"></lr-tree-item>
        </lr-tree-item>
      </div>
    `);
    const node = wrapper.querySelector('lr-tree-item') as LyraTreeItem;
    await node.updateComplete;
    expect(node.getAttribute('role')).to.equal('treeitem');
    await expect(node).to.be.accessible();
  });
});

describe('recursive data-model CSS parts', () => {
  const publicParts = [
    'base',
    'tree-item',
    'row',
    'toggle',
    'icon',
    'content',
    'label',
    'description',
    'badge',
    'group',
    'item',
    'item--disabled',
    'item--expanded',
    'item--indeterminate',
    'item--selected',
    'indentation',
    'expand-button',
    'spinner',
    'spinner__base',
    'children',
    'checkbox',
    'checkbox__base',
    'checkbox__control',
    'checkbox__control--checked',
    'checkbox__control--indeterminate',
    'checkbox__checked-icon',
    'checkbox__indeterminate-icon',
    'checkbox__label',
  ];

  it('applies mirrored item state parts to the painted row box', async () => {
    const style = document.createElement('style');
    style.textContent = `
      lr-tree-item.state-part-probe::part(item--selected) {
        background: rgb(1, 2, 3);
      }
    `;
    document.head.append(style);
    try {
      const el = (await fixture(html`<lr-tree-item
        class="state-part-probe"
        .item=${{ id: 'selected', label: 'Selected item', selected: true }}
      ></lr-tree-item>`)) as LyraTreeItem;
      const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="row"]')!;
      const statePart = el.shadowRoot!.querySelector<HTMLElement>('[part~="item--selected"]')!;

      expect(getComputedStyle(statePart).backgroundColor).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(row).backgroundColor).to.equal('rgb(1, 2, 3)');
      expect(statePart.getBoundingClientRect().width).to.be.greaterThan(0);
    } finally {
      style.remove();
    }
  });

  it('forwards every public part and lets one consumer rule style rows at three depths', async () => {
    const style = document.createElement('style');
    style.textContent = `
      lr-tree-item.nested-parts-probe::part(row) { padding-block-start: 13px; }
      lr-tree-item.nested-parts-probe::part(label) { letter-spacing: 3px; }
    `;
    document.head.append(style);
    try {
      const root = (await fixture(html`<lr-tree-item
        class="nested-parts-probe"
        .item=${{
          id: 'root',
          label: 'Root',
          children: [
            {
              id: 'child',
              label: 'Child',
              children: [{ id: 'grandchild', label: 'Grandchild' }],
            },
          ],
        }}
      ></lr-tree-item>`)) as LyraTreeItem;
      await root.updateComplete;
      expect(root.getChildrenItems()).to.have.length(0);
      root.expand();
      await root.updateComplete;

      const child = root.shadowRoot!.querySelector<LyraTreeItem>('lr-tree-item');
      expect(child !== null).to.equal(true);
      await child!.updateComplete;
      child!.expand();
      await child!.updateComplete;
      const grandchild = child!.shadowRoot!.querySelector<LyraTreeItem>('lr-tree-item');
      expect(grandchild !== null).to.equal(true);
      await grandchild!.updateComplete;

      for (const nested of [child!, grandchild!]) {
        const exported = new Set(
          (nested.getAttribute('exportparts') ?? '')
            .split(',')
            .map((mapping) => mapping.trim().split(':')[0]!.trim())
            .filter(Boolean),
        );
        for (const part of publicParts) {
          expect(exported.has(part), `${nested.item!.id} exports ${part}`).to.equal(true);
        }
      }

      for (const item of [root, child!, grandchild!]) {
        const row = item.shadowRoot!.querySelector<HTMLElement>('[part~="row"]')!;
        const label = item.shadowRoot!.querySelector<HTMLElement>('[part~="label"]')!;
        expect(getComputedStyle(row).paddingBlockStart, `${item.item!.id} row`).to.equal('13px');
        expect(getComputedStyle(label).letterSpacing, `${item.item!.id} label`).to.equal('3px');
      }
    } finally {
      style.remove();
    }
  });
});

// Owner-only structural inputs are normalized at the private controller boundary, so malformed
// internal work can never leak invalid values into the public ARIA contract.
it('clamps owner depth to a finite integer >= 0, keeping aria-level positive', async () => {
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

  configureOwnedItem(el, { depth: NaN });
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('1');

  configureOwnedItem(el, { depth: -5 });
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('1');

  configureOwnedItem(el, { depth: 2.7 });
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('3');
});

it('applies all five mirrored indentation custom properties on the item that renders them', async () => {
  const el = (await fixture(html`
    <lr-tree-item
      label="Nested item"
      style="
        --indent-size: 24px;
        --indent-guide-color: rgb(1, 2, 3);
        --indent-guide-offset: 4px;
        --indent-guide-style: dashed;
        --indent-guide-width: 3px;
      "
    ></lr-tree-item>
  `)) as LyraTreeItem;
  configureOwnedItem(el, { depth: 2 });
  await el.updateComplete;

  const indentation = el.shadowRoot!.querySelector<HTMLElement>('[part="indentation"]')!;
  const computed = getComputedStyle(indentation);
  expect(computed.inlineSize).to.equal('48px');
  expect(computed.borderInlineEndColor).to.equal('rgb(1, 2, 3)');
  expect(computed.insetBlockStart).to.equal('4px');
  expect(computed.insetBlockEnd).to.equal('4px');
  expect(computed.borderInlineEndStyle).to.equal('dashed');
  expect(computed.borderInlineEndWidth).to.equal('3px');
});

it('clamps owner set size to a positive integer while preserving the ARIA -1 sentinel', async () => {
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

  configureOwnedItem(el, { setSize: NaN });
  await el.updateComplete;
  expect(el.getAttribute('aria-setsize')).to.equal('1');

  configureOwnedItem(el, { setSize: -5 });
  await el.updateComplete;
  expect(el.getAttribute('aria-setsize')).to.equal('1');

  configureOwnedItem(el, { setSize: -1 });
  await el.updateComplete;
  expect(el.getAttribute('aria-setsize')).to.equal('-1');
});

it('clamps owner position in set to a finite integer >= 1', async () => {
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

  configureOwnedItem(el, { posInSet: NaN });
  await el.updateComplete;
  expect(el.getAttribute('aria-posinset')).to.equal('1');

  configureOwnedItem(el, { posInSet: -3 });
  await el.updateComplete;
  expect(el.getAttribute('aria-posinset')).to.equal('1');
});

it('does not expose owner controller plumbing on the public item instance', async () => {
  const el = (await fixture(html`<lr-tree-item label="Leaf"></lr-tree-item>`)) as LyraTreeItem;
  for (const member of [
    'activeId',
    'ancestry',
    'depth',
    'setSize',
    'posInSet',
    'setTreeContext',
    'setTreeIdentityContext',
    'setSelectionState',
  ]) {
    expect(member in el, member).to.equal(false);
  }
});

it('gives the expand/collapse toggle the shared minimum tappable size', async () => {
  const withChildren = { ...item, children: [{ id: '1.1', label: 'Child' }] };
  const el = (await fixture(html`<lr-tree-item .item=${withChildren}></lr-tree-item>`)) as LyraTreeItem;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(getComputedStyle(toggle).minInlineSize).to.equal('40px');
  expect(getComputedStyle(toggle).minBlockSize).to.equal('40px');
});

it('gives the expand/collapse toggle distinct pointer-hover feedback', async function () {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
  const el = (await fixture(html`<lr-tree-item
    style="--lr-color-surface-hover: rgb(7, 8, 9)"
    .item=${{ id: 'branch', label: 'Branch', children: [{ id: 'leaf', label: 'Leaf' }] }}
  ></lr-tree-item>`)) as LyraTreeItem;
  const toggle = el.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!;
  const rect = toggle.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(() => getComputedStyle(toggle).backgroundColor === 'rgb(7, 8, 9)');
  } finally {
    await resetMouse();
  }
});

it('gives the expand/collapse toggle pressed feedback distinct from hover', async function () {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
  this.timeout(10_000);
  const el = (await fixture(html`<lr-tree-item
    style="--lr-color-surface-hover: rgb(7, 8, 9); --lr-color-mix-partner: rgb(40, 50, 60); --lr-color-mix-active: 100%"
    .item=${{ id: 'branch', label: 'Branch', children: [{ id: 'leaf', label: 'Leaf' }] }}
  ></lr-tree-item>`)) as LyraTreeItem;
  const toggle = el.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!;
  const rect = toggle.getBoundingClientRect();
  let pressed = false;
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(() => getComputedStyle(toggle).backgroundColor === 'rgb(7, 8, 9)');
    const hovered = getComputedStyle(toggle).backgroundColor;

    await sendMouse({ type: 'down' });
    pressed = true;
    await waitUntil(
      () =>
        toggle.hasAttribute('data-pressed') &&
        getComputedStyle(toggle).backgroundColor !== hovered,
      'the disclosure toggle never painted a distinct pressed fill',
    );
    expect(getComputedStyle(toggle).backgroundColor).to.not.equal(hovered);
    await sendMouse({ type: 'up' });
    pressed = false;
    await waitUntil(() => !toggle.hasAttribute('data-pressed'));
  } finally {
    if (pressed) await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('themes checked and indeterminate checkbox paint independently from the shared brand', async () => {
  const wrapper = await fixture(html`
    <div
      role="tree"
      style="--lr-color-brand:rgb(40, 41, 42); --lr-tree-checkbox-checked-border-color:rgb(1, 2, 3); --lr-tree-checkbox-checked-bg:rgb(4, 5, 6); --lr-tree-checkbox-checked-color:rgb(7, 8, 9); --lr-tree-checkbox-indeterminate-border-color:rgb(10, 11, 12); --lr-tree-checkbox-indeterminate-bg:rgb(13, 14, 15); --lr-tree-checkbox-indeterminate-color:rgb(16, 17, 18)"
    >
      <lr-tree-item label="Checked"></lr-tree-item>
      <lr-tree-item label="Mixed"></lr-tree-item>
    </div>
  `);
  const [checked, mixed] = [...wrapper.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  for (const item of [checked!, mixed!]) {
    configureOwnedItem(item, { selection: 'multiple' });
  }
  setTreeItemSelection(checked!, true, false);
  setTreeItemSelection(mixed!, false, true);
  await checked!.updateComplete;
  await mixed!.updateComplete;

  const checkedControl = checked!.shadowRoot!.querySelector('[part~="checkbox__control"]') as HTMLElement;
  const mixedControl = mixed!.shadowRoot!.querySelector('[part~="checkbox__control"]') as HTMLElement;
  const checkedStyle = getComputedStyle(checkedControl);
  const mixedStyle = getComputedStyle(mixedControl);
  expect([checkedStyle.borderColor, checkedStyle.backgroundColor, checkedStyle.color]).to.deep.equal([
    'rgb(1, 2, 3)',
    'rgb(4, 5, 6)',
    'rgb(7, 8, 9)',
  ]);
  expect([mixedStyle.borderColor, mixedStyle.backgroundColor, mixedStyle.color]).to.deep.equal([
    'rgb(10, 11, 12)',
    'rgb(13, 14, 15)',
    'rgb(16, 17, 18)',
  ]);
});

it('keeps a disabled branch toggle inert and does not move focus to the disabled treeitem', async () => {
  const disabledBranch = {
    ...item,
    disabled: true,
    children: [{ id: '1.1', label: 'Child' }],
  };
  const wrapper = await fixture(html`
    <div role="tree">
      <button id="before">Before</button>
      <lr-tree-item .item=${disabledBranch}></lr-tree-item>
    </div>
  `);
  const before = wrapper.querySelector<HTMLButtonElement>('#before')!;
  const el = wrapper.querySelector('lr-tree-item') as LyraTreeItem;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!;

  expect(toggle.disabled).to.be.true;
  expect(getComputedStyle(toggle).cursor).to.equal('default');
  before.focus();
  toggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
  expect(document.activeElement === before).to.equal(true);
});

// A `role="treeitem"` host is only ARIA-valid nested inside a `role="tree"`/`role="group"`
// ancestor (the WAI-ARIA required-parent rule) -- <lr-tree-item> is never used standalone in
// practice (see the class doc), so this wraps it the same way <lr-tree> itself always does,
// while still asserting accessibility on the node's own instance, expanded/badged/described so
// every own-ARIA code path (role/aria-level/aria-setsize/aria-posinset, the badge/icon/
// description markup) is exercised.
it('is accessible with a realistic, expanded, badged item', async () => {
  const populated = {
    id: '1',
    label: 'Root',
    description: 'A helpful secondary line',
    badges: [{ text: '3' }, { text: 'New', tone: 'brand' as const }],
    children: [{ id: '1.1', label: 'Child A' }],
  };
  const wrapper = await fixture(
    html`<div role="tree">
      <lr-tree-item .item=${populated} expanded></lr-tree-item>
    </div>`
  );
  const node = wrapper.querySelector('lr-tree-item') as LyraTreeItem;
  await node.updateComplete;
  expect(node.getAttribute('role')).to.equal('treeitem');
  // Rendering pre-expanded starts `[part='children']`'s lr-tree-show fade-in (see
  // tree-item.styles.ts) right away. Left running, axe's color-contrast check factors in the
  // element's current (transitional) opacity, so sampling the DOM mid-fade blends "Child A"'s
  // text and background toward each other and reports a false "serious" violation -- exactly
  // what intermittently failed WebKit's full-engine shard. Finishing the animation outright
  // matches the idiom overlay.test.ts already uses for this same kind of reveal animation.
  const children = node.shadowRoot!.querySelector('[part="children"]');
  children?.getAnimations().forEach((animation) => animation.finish());
  await expect(node).to.be.accessible();
});

// `:host([aria-selected='true']) [part='row']` is (0,3,0), which a bare `[part='row']:active`
// ((0,2,0)) cannot reach -- hence the second, :host()-matched arm on the pressed rule. A selected
// item is the one a user presses next, so it must not be the single row with no press feedback.
// Rendered assertion only: the selector is exactly the kind of thing that reads correct and matches
// nothing.
it('shows a pressed fill on a selected row, and none on a disabled one', async function () {
  // Two complete Playwright pointer gestures require several browser-command round-trips. Keep
  // their full-sweep contention budget scoped to this rendered contract.
  this.timeout(15_000);
  const wrapper = await fixture(
    html`<div role="tree">
      <lr-tree-item .item=${{ id: 's', label: 'Selected', selected: true }}></lr-tree-item>
      <lr-tree-item .item=${{ id: 'd', label: 'Disabled', disabled: true }}></lr-tree-item>
    </div>`
  );
  const [selectedItem, disabledItem] = [...wrapper.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  await selectedItem!.updateComplete;
  await disabledItem!.updateComplete;

  const press = async (
    host: LyraTreeItem,
    expectChange: boolean,
  ): Promise<{ resting: string; pressed: string }> => {
    const row = host.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    row.scrollIntoView();
    const fill = (): string => getComputedStyle(row).backgroundColor;
    const resting = fill();
    const rect = row.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await sendMouse({ type: 'down' });
      // Firefox may resolve the remote mouse command before the pointer pseudo-class is reflected
      // in rendered style under full-suite load. Hold the button while polling the real state.
      await waitUntil(
        () => row.matches(':active') && (expectChange ? fill() !== resting : fill() === resting),
        expectChange
          ? 'the selected row never painted its pressed fill'
          : 'the disabled row did not remain inert while pointer-active',
      );
      return { resting, pressed: fill() };
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  };

  const selected = await press(selectedItem!, true);
  expect(selected.pressed, 'a selected row must still acknowledge the press').to.not.equal(selected.resting);

  const disabled = await press(disabledItem!, false);
  expect(disabled.pressed, 'a disabled row must stay inert under the pointer').to.equal(disabled.resting);
});

it('settles a pending lazy expansion when lazy loading is disabled', async () => {
  const el = await fixture<LyraTreeItem>(html`
    <lr-tree-item label="Lazy branch" lazy></lr-tree-item>
  `);
  const states: boolean[] = [];
  el.addEventListener('lr-lazy-change', (event) => {
    states.push((event as CustomEvent<{ loading: boolean }>).detail.loading);
  });
  el.expand();
  await el.updateComplete;
  expect(el.loading).to.equal(true);

  el.lazy = false;
  await el.updateComplete;

  expect(el.loading).to.equal(false);
  expect(el.expanded).to.equal(false);
  expect(states).to.deep.equal([true, false]);
});

it('contains checkbox clicks while selecting through the item contract', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div><lr-tree-item .item=${item}></lr-tree-item></div>
  `);
  const el = wrapper.querySelector('lr-tree-item') as LyraTreeItem;
  configureOwnedItem(el, { selection: 'multiple' });
  await el.updateComplete;
  let leakedClicks = 0;
  wrapper.addEventListener('click', () => leakedClicks++);
  const selected = oneEvent(el, 'lr-node-select');

  el.shadowRoot!.querySelector<HTMLElement>('[part="checkbox"]')!.click();

  expect((await selected).detail).to.deep.equal({ nodeId: '1' });
  expect(leakedClicks).to.equal(0);
});

// `:host([aria-selected='true']) [part='row']` is (0,3,0), which a bare `[part='row']:hover`
// ((0,2,0)) cannot reach -- the same specificity gap the pressed-fill fix above already solves for
// :active. Without a matching :host()-matched arm on the hover rule, hovering an already-selected
// item is a visual no-op. Rendered assertion only: the selector is exactly the kind of thing that
// reads correct and matches nothing.
it('shows a hover fill on a selected row, distinct from the resting selected fill', async () => {
  const wrapper = await fixture(
    html`<div role="tree">
      <lr-tree-item .item=${{ id: 's', label: 'Selected', selected: true }}></lr-tree-item>
    </div>`
  );
  const [selectedItem] = [...wrapper.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  await selectedItem!.updateComplete;

  const row = selectedItem!.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  row.scrollIntoView();
  const resting = getComputedStyle(row).backgroundColor;
  const rect = row.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(row).backgroundColor).to.not.equal(resting);
  } finally {
    await resetMouse();
  }
});
