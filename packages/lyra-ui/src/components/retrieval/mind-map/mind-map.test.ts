import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './mind-map.js';
import type { LyraMindMap, LyraTopic } from './mind-map.js';
import { styles } from './mind-map.styles.js';

const topics: LyraTopic[] = [
  {
    id: 'root',
    label: 'Knowledge Graph RAG',
    children: [
      { id: 'kg', label: 'Knowledge graphs' },
      { id: 'rag', label: 'Retrieval', children: [{ id: 'chunking', label: 'Chunking' }] },
    ],
  },
];

it('defaults to empty topics, empty label, expandDepth=1', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  expect(el.topics).to.deep.equal([]);
  expect(el.label).to.equal('');
  expect(el.expandDepth).to.equal(1);
});

it('renders one [part="node"] per visible topic -- root plus its expandDepth-1 children', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3); // root + kg + rag; chunking stays collapsed
});

it('emits lr-topic-select when a leaf node is clicked', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const kgNode = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find((n) => n.textContent?.includes('Knowledge graphs'))!;
  const listener = oneEvent(el, 'lr-topic-select');
  kgNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'kg' });
});

it('emits lr-topic-toggle when a parent node is clicked, and reveals its children', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const ragNode = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find((n) => n.textContent?.includes('Retrieval'))!;
  const listener = oneEvent(el, 'lr-topic-toggle');
  ragNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'rag', expanded: true });
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(4); // chunking now visible
});

it('wraps multiple root topics in an implicit hub labeled from the label property', async () => {
  const el = (await fixture(html`<lr-mind-map label="My Topics"></lr-mind-map>`)) as LyraMindMap;
  el.topics = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
  await el.updateComplete;
  const labels = [...el.shadowRoot!.querySelectorAll('[part="node-label"]')].map((n) => n.textContent);
  expect(labels).to.include('My Topics');
});

it('keyboard: ArrowDown descends into children, auto-expanding a collapsed parent', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;

  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); // focus root
  await el.updateComplete;
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); // descend to root's first child (kg)
  await el.updateComplete;
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); // move to next sibling (rag)
  await el.updateComplete;

  const listener = oneEvent(el, 'lr-topic-toggle');
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); // rag is collapsed -- auto-expands
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'rag', expanded: true });
});

it('has a single [part="svg"] tab stop, not per-node tabbing', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('tabindex')).to.equal('0');
  el.shadowRoot!.querySelectorAll('[part="node"]').forEach((n) => expect(n.hasAttribute('tabindex')).to.be.false);
});

it('reads --lr-transition-base for node-position transitions (collapses to near-zero under reduced motion globally)', async () => {
  const el = (await fixture(html`<lr-mind-map style="--lr-transition-base: 42ms linear"></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const g = el.shadowRoot!.querySelector('[part="node"]') as SVGGElement;
  expect(getComputedStyle(g).transitionDuration).to.equal('0.042s');
});

it('shows the noData empty state when topics is empty', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No data');
});

it('normalizes a NaN expandDepth instead of silently collapsing every ring (falls back to the default of 1)', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  el.expandDepth = NaN;
  await el.updateComplete;
  // A raw NaN would make every `depth < expandDepth` comparison false, collapsing even the root's
  // own children -- guarded, it must render the same as the default expandDepth=1 (root + 2 children).
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3);
});

it('resolves the default svg accessible name through a .strings override for mindMapLabel when label is unset', async () => {
  // label stays at its '' default, so the `this.label || this.localize('mindMapLabel')`
  // aria-label must fall through to the .strings/registry path.
  const el = (await fixture(
    html`<lr-mind-map .strings=${{ mindMapLabel: 'Carte mentale' }}></lr-mind-map>`,
  )) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('aria-label')).to.equal('Carte mentale');
});

it('is accessible with an expanded, multi-level tree', async () => {
  const el = (await fixture(html`<lr-mind-map expand-depth="2"></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('exposes the visible topic hierarchy as a nested ARIA tree', async () => {
  const el = (await fixture(html`<lr-mind-map expand-depth="2" .topics=${topics}></lr-mind-map>`)) as LyraMindMap;
  const tree = el.shadowRoot!.querySelector('[role="tree"]')!;
  const root = tree.querySelector(':scope > [role="treeitem"]')!;
  expect(root.textContent).to.include('Knowledge Graph RAG');
  expect(root.getAttribute('aria-level')).to.equal('1');
  expect(root.getAttribute('aria-expanded')).to.equal('true');
  const group = root.querySelector(':scope > [role="group"]')!;
  expect(group.querySelectorAll(':scope > [role="treeitem"]').length).to.equal(2);
});

it('reconciles keyboard focus when the focused topic disappears', async () => {
  const el = (await fixture(html`<lr-mind-map .topics=${topics}></lr-mind-map>`)) as LyraMindMap;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal('kg');
  el.topics = [{ ...topics[0]!, children: topics[0]!.children!.filter((topic) => topic.id !== 'kg') }];
  await el.updateComplete;
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal('root');
});

it('does not recompute the O(n) radial layout for focus-only keyboard updates', async () => {
  const el = (await fixture(html`<lr-mind-map .topics=${topics}></lr-mind-map>`)) as LyraMindMap;
  const internals = el as unknown as { relayout(): void };
  const original = internals.relayout.bind(el);
  let calls = 0;
  internals.relayout = () => {
    calls++;
    original();
  };
  el.shadowRoot!.querySelector('[part="svg"]')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
  );
  await el.updateComplete;
  expect(calls).to.equal(0);
});

it('recomputes the implicit hub when locale strings change after mount', async () => {
  const el = (await fixture(
    html`<lr-mind-map .topics=${[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]}></lr-mind-map>`,
  )) as LyraMindMap;
  expect(el.shadowRoot!.querySelector('[part="node-label"]')!.textContent).to.equal('Mind map');
  el.strings = { mindMapLabel: 'Carte mentale' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="node-label"]')!.textContent).to.equal('Carte mentale');
});

it('recomputes token-derived geometry when its allocation changes', async () => {
  const OriginalResizeObserver = window.ResizeObserver;
  let notify: ResizeObserverCallback | undefined;
  class TestResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notify = callback;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    TestResizeObserver as unknown as typeof ResizeObserver;
  try {
    const el = (await fixture(html`<lr-mind-map .topics=${topics}></lr-mind-map>`)) as LyraMindMap;
    const beforeRoot = nodePosition(el, 'Knowledge Graph RAG');
    const beforeChild = nodePosition(el, 'Knowledge graphs');
    const before = Math.hypot(beforeChild.x - beforeRoot.x, beforeChild.y - beforeRoot.y);
    el.style.setProperty('--lr-mind-map-ring-gap', '8rem');
    expect(typeof notify).to.equal('function');
    notify!(
      [{ contentRect: { width: 321, height: 240 } } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await el.updateComplete;
    const afterRoot = nodePosition(el, 'Knowledge Graph RAG');
    const afterChild = nodePosition(el, 'Knowledge graphs');
    const after = Math.hypot(afterChild.x - afterRoot.x, afterChild.y - afterRoot.y);
    expect(after).to.be.greaterThan(before);
  } finally {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = OriginalResizeObserver;
  }
});

function nodePosition(el: LyraMindMap, labelSubstring: string): { x: number; y: number } {
  const nodeEl = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find((n) =>
    n.textContent?.includes(labelSubstring),
  )!;
  const match = nodeEl.getAttribute('style')!.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)!;
  return { x: parseFloat(match[1]!), y: parseFloat(match[2]!) };
}

it('reads a live root font-size for a rem-unit --lr-mind-map-ring-gap, matching lr-table\'s own minimumResizeWidth() rem-to-px fix', async () => {
  const originalFontSize = document.documentElement.style.fontSize;
  document.documentElement.style.fontSize = '32px';
  try {
    const el = (await fixture(html`<lr-mind-map .topics=${topics}></lr-mind-map>`)) as LyraMindMap;
    await el.updateComplete;
    const root = nodePosition(el, 'Knowledge Graph RAG');
    const child = nodePosition(el, 'Knowledge graphs'); // a depth-1 ring node, one ringGap away
    const distance = Math.hypot(child.x - root.x, child.y - root.y);
    // Default --lr-mind-map-ring-gap is 6rem; at a 32px root font-size that's 192px. A hardcoded
    // `* 16` multiplier would instead produce 96px regardless of the live root font-size.
    expect(distance).to.be.closeTo(192, 0.5);
  } finally {
    document.documentElement.style.fontSize = originalFontSize;
  }
});

describe('lifecycle super calls', () => {
  it('calls super.willUpdate() (regression guard: a future mixin layered under LyraMindMap must still run)', async () => {
    const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
    // The immediate prototype of an instance is LyraElement.prototype -- the exact object
    // `super.willUpdate()` resolves against from inside this component's own override.
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(el)) as Record<string, unknown>;
    const originalWillUpdate = proto.willUpdate as ((changed: unknown) => void) | undefined;
    let willUpdateCalls = 0;
    proto.willUpdate = function (this: unknown, changed: unknown) {
      willUpdateCalls++;
      return originalWillUpdate?.call(this, changed);
    };
    try {
      el.topics = topics;
      await el.updateComplete;
      expect(willUpdateCalls).to.be.greaterThan(0);
    } finally {
      delete proto.willUpdate;
    }
  });
});

describe('hover feedback on [part="node"]', () => {
  // :hover cannot be synthesized in this test runner (no real pointer), so per this repo's
  // documented exception for genuinely-unsynthesizable pseudo-classes, this asserts against the
  // stylesheet source instead of a rendered/computed effect.
  it("declares a [part='node']:hover rule, giving mouse users the same 'clickable' feedback keyboard users get from the drawn focus ring", () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='node'\]:hover/);
  });
});
