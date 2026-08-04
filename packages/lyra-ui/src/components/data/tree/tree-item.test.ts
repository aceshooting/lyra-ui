import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tree-item.js';
import type { LyraTreeItem } from './tree-item.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const item = { id: '1', label: 'Root' };

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
    el.setTreeContext({ selection: 'multiple', expandIcon: null, collapseIcon: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    const checkbox = (): HTMLElement =>
      el.shadowRoot!.querySelector<HTMLElement>('[part="checkbox"]')!;
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;
    };

    expect(renderedLabel(el), 'an empty element does not suppress the label fallback').to.equal(
      'Fallback',
    );
    expect(checkbox().getAttribute('aria-label')).to.equal('Fallback');

    assigned.data = 'Direct tree label';
    await settle();
    expect(renderedLabel(el)).to.equal('Direct tree label');
    expect(el.nodeLabel).to.equal('Direct tree label');
    expect(checkbox().getAttribute('aria-label')).to.equal('Direct tree label');

    assigned.data = ' ';
    await settle();
    expect(renderedLabel(el)).to.equal('Fallback');
    expect(checkbox().getAttribute('aria-label')).to.equal('Fallback');
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
    el.setTreeContext({ selection: 'multiple', expandIcon: null, collapseIcon: null });
    const forwardingSlot = el.querySelector('slot')!;
    const checkbox = (): HTMLElement =>
      el.shadowRoot!.querySelector<HTMLElement>('[part="checkbox"]')!;
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;
    };

    await settle();
    expect(renderedLabel(el), 'an empty assignment suppresses slot fallback').to.equal('Fallback');
    expect(checkbox().getAttribute('aria-label')).to.equal('Fallback');

    assignedText.data = 'Forwarded tree label';
    await settle();
    expect(renderedLabel(el)).to.equal('Forwarded tree label');
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarded tree label');

    wrapper.setAttribute('aria-hidden', ' TRUE ');
    await settle();
    expect(
      checkbox().getAttribute('aria-label'),
      'a hard-hidden composed parent prunes a forwarded root Text node',
    ).to.equal('Fallback');

    wrapper.removeAttribute('aria-hidden');
    await settle();
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarded tree label');

    details.open = false;
    await settle();
    expect(
      checkbox().getAttribute('aria-label'),
      'a closed details ancestor prunes a forwarded root Text node',
    ).to.equal('Fallback');

    details.open = true;
    await settle();
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarded tree label');

    assignedText.data = ' ';
    await settle();
    expect(renderedLabel(el)).to.equal('Fallback');

    const assigned = wrapper.ownerDocument.createElement('span');
    assigned.setAttribute('data-label', '');
    assigned.setAttribute('aria-label', 'Forwarded accessible name');
    assignedText.replaceWith(assigned);
    await settle();
    expect(el.nodeLabel).to.equal('Forwarded accessible name');
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarded accessible name');

    assigned.textContent = 'Decorative tree glyph';
    assigned.setAttribute('aria-hidden', ' TRUE ');
    await settle();
    expect(
      el.shadowRoot!.querySelector('[part="label"] slot') !== null,
      'aria-hidden visual content still selects the authored slot',
    ).to.be.true;
    expect(checkbox().getAttribute('aria-label')).to.equal('Fallback');

    assigned.removeAttribute('aria-hidden');
    assigned.style.display = 'none';
    await settle();
    expect(el.shadowRoot!.querySelector('[part="label"] slot') !== null).to.be.true;
    expect(checkbox().getAttribute('aria-label')).to.equal('Fallback');

    assigned.style.removeProperty('display');
    assigned.hidden = true;
    await settle();
    expect(el.shadowRoot!.querySelector('[part="label"] slot') !== null).to.be.true;
    expect(checkbox().getAttribute('aria-label')).to.equal('Fallback');

    assigned.hidden = false;
    await settle();
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarded accessible name');

    wrapper.classList.add('hide-forwarded-label');
    await settle();
    expect(
      checkbox().getAttribute('aria-label'),
      'a forwarding-host class mutation refreshes the checkbox name',
    ).to.equal('Fallback');

    wrapper.classList.remove('hide-forwarded-label');
    await settle();
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarded accessible name');

    wrapper.style.setProperty('--forwarded-label-visibility', 'hidden');
    await settle();
    expect(
      checkbox().getAttribute('aria-label'),
      'a forwarding-host style mutation refreshes the checkbox name',
    ).to.equal('Fallback');

    wrapper.style.removeProperty('--forwarded-label-visibility');
    await settle();
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarded accessible name');

    forwardingSlot.setAttribute('aria-hidden', 'true');
    await settle();
    expect(checkbox().getAttribute('aria-label')).to.equal('Fallback');

    forwardingSlot.removeAttribute('aria-hidden');
    forwardingSlot.style.display = 'none';
    await settle();
    expect(checkbox().getAttribute('aria-label')).to.equal('Fallback');

    forwardingSlot.style.removeProperty('display');
    await settle();
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarded accessible name');

    el.setAttribute('aria-label', 'Explicit tree item name');
    await el.updateComplete;
    assigned.textContent = 'Later visible text';
    await settle();
    expect(checkbox().getAttribute('aria-label'), 'the consumer host name keeps precedence').to.equal(
      'Explicit tree item name',
    );

    el.removeAttribute('aria-label');
    const reassigned = new Promise<void>((resolve) =>
      forwardingSlot.addEventListener('slotchange', () => resolve(), { once: true }),
    );
    assigned.remove();
    await reassigned;
    await settle();
    expect(renderedLabel(el)).to.equal('Forwarding fallback');
    expect(checkbox().getAttribute('aria-label')).to.equal('Forwarding fallback');
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
        if (
          target === adoptedTarget &&
          options?.childList &&
          options.characterData &&
          options.subtree
        ) labelHostObservations += 1;
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
        delete (frameWindow as Window & { MutationObserver?: typeof MutationObserver })
          .MutationObserver;
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
        <lr-tree-item
          label="Parent"
          style="--show-duration: 19ms; --hide-duration: 23ms"
        >
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
      expect(parentClears, 'disconnect cancels through the retained old timer owner').to.include(
        oldTimer,
      );

      el.collapse();
      await el.updateComplete;
      await Promise.resolve();
      expect(frameSchedules.map(({ delay }) => delay)).to.eql([23]);
      expect(parentSchedules, 'the adopted item never schedules another parent timer').to.have
        .length(1);
      expect(frameMotionQueries, 'reduced-motion state comes from the adopted window').to.be
        .greaterThan(0);
      expect(frameStyleReads, 'motion custom properties come from the adopted window').to.be
        .greaterThan(0);

      staleCallback();
      expect(afterExpand, 'a canceled old-realm callback stays stale after adoption').to.equal(0);
      expect(afterCollapse).to.equal(0);

      frameCallbacks.get(frameSchedules[0]!.handle)!();
      expect(afterCollapse).to.equal(1);
      expect(frameClears).to.eql([]);
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
    expect((await toggled).detail).to.eql({ id: el.nodeId, expanded: true });

    const selected = oneEvent(el, 'lr-node-select');
    el.select();
    expect((await selected).detail).to.eql({ id: el.nodeId });
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
      html`<lr-tree-item label="Docs" aria-label="Documentation folder"></lr-tree-item>`,
    )) as LyraTreeItem;
    expect(el.getAttribute('aria-label')).to.equal('Documentation folder');
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

// Regression tests for `depth`/`setSize`/`posInSet`: these feed `aria-level`/`aria-setsize`/
// `aria-posinset` directly in `willUpdate()`. Per the ARIA spec those attributes must be positive
// integers (aria-setsize additionally permits the `-1` "unknown" sentinel) -- a NaN/negative value
// here would produce invalid ARIA output. All three are now sanitized via `finiteInteger` at
// assignment time, so the rendered attributes are always sane regardless of what's assigned.
it('clamps a NaN/negative depth to a finite integer >= 0, keeping aria-level a positive integer', async () => {
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

  el.depth = NaN;
  expect(el.depth).to.equal(0);
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('1');

  el.depth = -5;
  expect(el.depth).to.equal(0);
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('1');

  el.depth = 2.7;
  expect(el.depth).to.equal(2); // truncated, not rounded
  await el.updateComplete;
  expect(el.getAttribute('aria-level')).to.equal('3');
});

it('clamps a NaN/negative setSize to a finite integer >= 1, but preserves the -1 "unknown" ARIA sentinel', async () => {
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

  el.setSize = NaN;
  expect(el.setSize).to.equal(1);
  await el.updateComplete;
  expect(el.getAttribute('aria-setsize')).to.equal('1');

  el.setSize = -5;
  expect(el.setSize).to.equal(1);

  el.setSize = -1;
  expect(el.setSize).to.equal(-1); // the ARIA-legal "unknown" sentinel, not clamped away
  await el.updateComplete;
  expect(el.getAttribute('aria-setsize')).to.equal('-1');
});

it('clamps a NaN/negative posInSet to a finite integer >= 1', async () => {
  const el = (await fixture(html`<lr-tree-item .item=${item}></lr-tree-item>`)) as LyraTreeItem;

  el.posInSet = NaN;
  expect(el.posInSet).to.equal(1);
  await el.updateComplete;
  expect(el.getAttribute('aria-posinset')).to.equal('1');

  el.posInSet = -3;
  expect(el.posInSet).to.equal(1);
  await el.updateComplete;
  expect(el.getAttribute('aria-posinset')).to.equal('1');
});

it('gives the expand/collapse toggle the shared minimum tappable size', async () => {
  const withChildren = { ...item, children: [{ id: '1.1', label: 'Child' }] };
  const el = (await fixture(html`<lr-tree-item .item=${withChildren}></lr-tree-item>`)) as LyraTreeItem;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  expect(getComputedStyle(toggle).minInlineSize).to.equal('40px');
  expect(getComputedStyle(toggle).minBlockSize).to.equal('40px');
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
  expect(document.activeElement).to.equal(before);
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
    badge: 3,
    badges: [{ text: 'New', tone: 'brand' as const }],
    children: [{ id: '1.1', label: 'Child A' }],
  };
  const wrapper = await fixture(
    html`<div role="tree">
      <lr-tree-item .item=${populated} expanded .setSize=${1} .posInSet=${1}></lr-tree-item>
    </div>`,
  );
  const node = wrapper.querySelector('lr-tree-item') as LyraTreeItem;
  await node.updateComplete;
  expect(node.getAttribute('role')).to.equal('treeitem');
  await expect(node).to.be.accessible();
});

// `:host([aria-selected='true']) [part='row']` is (0,3,0), which a bare `[part='row']:active`
// ((0,2,0)) cannot reach -- hence the second, :host()-matched arm on the pressed rule. A selected
// item is the one a user presses next, so it must not be the single row with no press feedback.
// Rendered assertion only: the selector is exactly the kind of thing that reads correct and matches
// nothing.
it('shows a pressed fill on a selected row, and none on a disabled one', async () => {
  const wrapper = await fixture(
    html`<div role="tree">
      <lr-tree-item .item=${{ id: 's', label: 'Selected', selected: true }} .setSize=${2} .posInSet=${1}></lr-tree-item>
      <lr-tree-item .item=${{ id: 'd', label: 'Disabled', disabled: true }} .setSize=${2} .posInSet=${2}></lr-tree-item>
    </div>`,
  );
  const [selectedItem, disabledItem] = [...wrapper.querySelectorAll('lr-tree-item')] as LyraTreeItem[];
  await selectedItem!.updateComplete;
  await disabledItem!.updateComplete;

  const press = async (host: LyraTreeItem): Promise<{ resting: string; pressed: string }> => {
    const row = host.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    row.scrollIntoView();
    const resting = getComputedStyle(row).backgroundColor;
    const rect = row.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await sendMouse({ type: 'down' });
      return { resting, pressed: getComputedStyle(row).backgroundColor };
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  };

  const selected = await press(selectedItem!);
  expect(selected.pressed, 'a selected row must still acknowledge the press').to.not.equal(selected.resting);

  const disabled = await press(disabledItem!);
  expect(disabled.pressed, 'a disabled row must stay inert under the pointer').to.equal(disabled.resting);
});

// `:host([aria-selected='true']) [part='row']` is (0,3,0), which a bare `[part='row']:hover`
// ((0,2,0)) cannot reach -- the same specificity gap the pressed-fill fix above already solves for
// :active. Without a matching :host()-matched arm on the hover rule, hovering an already-selected
// item is a visual no-op. Rendered assertion only: the selector is exactly the kind of thing that
// reads correct and matches nothing.
it('shows a hover fill on a selected row, distinct from the resting selected fill', async () => {
  const wrapper = await fixture(
    html`<div role="tree">
      <lr-tree-item .item=${{ id: 's', label: 'Selected', selected: true }} .setSize=${1} .posInSet=${1}></lr-tree-item>
    </div>`,
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
