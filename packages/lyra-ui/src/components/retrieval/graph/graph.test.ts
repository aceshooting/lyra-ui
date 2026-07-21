import { fixture, expect, html, waitUntil, aTimeout, oneEvent } from '@open-wc/testing';
import { select } from 'd3-selection';
import './graph.js';
import { LyraGraph } from './graph.js';
import { layeredLayout } from '../../../internal/layered-layout.js';
import { styles } from './graph.styles.js';

const nodes = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];
const links = [{ source: 'a', target: 'b' }];

// d3-force's internal timer runs on requestAnimationFrame, which Chromium
// throttles heavily on backgrounded tabs when many test files run
// concurrently — give it generous headroom so the full suite isn't flaky.
const NODE_COUNT_TIMEOUT = 5000;
// forceSimulation()'s *default* alphaDecay/alphaMin (unconfigured here, so
// this is the real production default) needs ~300 ticks to decay from
// alpha=1 to alphaMin — at rAF's nominal ~16.7ms/tick that's already ~5000ms
// with zero slack, so waiting for a full settle (as opposed to just the
// first paint NODE_COUNT_TIMEOUT above covers) needs its own, larger budget
// or it fails on every run, not just loaded ones.
const ALPHA_SETTLE_TIMEOUT = 15_000;

interface FakeIntersectionObserverInstance {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  disconnected: boolean;
}

/** Stubs the global `IntersectionObserver` with a fully fake, manually-driven implementation so
 *  the canvas visibility-gating tests control exactly when (and whether) intersection is
 *  reported -- the same spy-the-observer-constructor technique `animation.test.ts`/`map.test.ts`
 *  use, since a real IntersectionObserver reports an on-screen fixture as intersecting almost
 *  immediately in the headless test page, making these scenarios impossible to reproduce
 *  deterministically. Duplicated locally rather than shared, matching those same two files'
 *  own per-file copy of this exact helper. */
function stubIntersectionObserver() {
  const original = window.IntersectionObserver;
  const observedTargets: Element[] = [];
  const instances: FakeIntersectionObserverInstance[] = [];
  class FakeIntersectionObserver implements FakeIntersectionObserverInstance {
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    disconnected = false;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
      instances.push(this);
    }
    observe(target: Element): void {
      observedTargets.push(target);
    }
    unobserve(): void {}
    disconnect(): void {
      this.disconnected = true;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  return {
    instances,
    observedTargets,
    restore(): void {
      (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = original;
    },
  };
}

// MUST stay the very first test in this file: `getScratchCtx()` (src/internal/canvas.ts) memoizes
// its canvas 2D context at module scope for the lifetime of this page, on first call, forever -- a
// later call can never observe a null context again once any earlier test has already resolved it
// to a real one (several showEdgeLabels-driven tests further down do exactly that). Stubbing
// `getContext` to null here, before anything else in the file has ever touched it, is the only way
// to exercise edgeLabelWidth()'s `!ctx` branch at all. The long-label/short-edge declutter-gate
// test later in this file still passes under the resulting heuristic width (a 51-character label
// is huge under either measurement, so it still clears that test's gate) -- verified by running the
// full file after adding this.
it('edgeLabelWidth falls back to a character-count heuristic when getScratchCtx() returns null (no canvas 2D context available)', async () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
    function (this: HTMLCanvasElement) {
      return null;
    };
  try {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const internal = el as unknown as { edgeLabelWidth: (t: string) => number; edgeLabelFontPx: () => number };
    const text = 'no-ctx-fallback-probe';
    const width = internal.edgeLabelWidth(text);
    expect(width).to.equal(text.length * internal.edgeLabelFontPx() * 0.6);
  } finally {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  }
});

it('shows a loading skeleton and aria-busy while d3 loads, then swaps to the svg', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('svg')).to.not.exist;

  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('svg')).to.exist;
});

it('renders an svg with a circle per node once d3 loads', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  expect(el.shadowRoot!.querySelectorAll('[part="link"]').length).to.equal(1);
});

it('forwards a host aria-label to the semantic graph svg', async () => {
  const el = (await fixture(html`
    <lr-graph aria-label="Citation relationships"></lr-graph>
  `)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal(
    'Citation relationships',
  );
});

it('emits lr-node-click when a node is activated', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  let detail: { id: string; x: number; y: number } | undefined;
  el.addEventListener('lr-node-click', (e) => (detail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="node"]') as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  );
  expect(detail).to.exist;
  expect(detail!.id).to.equal('a');
  expect(detail!.x).to.be.a('number');
  expect(detail!.y).to.be.a('number');
});

it('emits lr-link-click with the source/target ids when a link is activated', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  let detail: { source: string; target: string } | undefined;
  el.addEventListener('lr-link-click', (e) => (detail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="link"]') as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  );
  expect(detail).to.deep.equal({ source: 'a', target: 'b' });
});

it('exposes resolved node coordinates for click-anchored overlays', async () => {
  const el = (await fixture(html`<lr-graph seed="7"></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const position = el.getNodePosition('a');
  expect(position).to.exist;
  expect(position!.x).to.be.a('number');
  expect(position!.y).to.be.a('number');
  expect(el.getNodePosition('missing')).to.be.undefined;
});

describe('hover events', () => {
  it('emits lr-node-enter/lr-node-leave and toggles data-hovered on the node element', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    let enterDetail: { id: string } | undefined;
    let leaveDetail: { id: string } | undefined;
    el.addEventListener('lr-node-enter', (e) => (enterDetail = (e as CustomEvent).detail));
    el.addEventListener('lr-node-leave', (e) => (leaveDetail = (e as CustomEvent).detail));

    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(enterDetail).to.deep.equal({ id: 'a' });
    expect(nodeEl.hasAttribute('data-hovered')).to.be.true;

    nodeEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(leaveDetail).to.deep.equal({ id: 'a' });
    expect(nodeEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('emits lr-link-enter/lr-link-leave with source/target ids and toggles data-hovered on the link element', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const linkEl = el.shadowRoot!.querySelector('[part="link"]') as SVGElement;

    let enterDetail: { source: string; target: string } | undefined;
    el.addEventListener('lr-link-enter', (e) => (enterDetail = (e as CustomEvent).detail));

    linkEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(enterDetail).to.deep.equal({ source: 'a', target: 'b' });
    expect(linkEl.hasAttribute('data-hovered')).to.be.true;

    linkEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(linkEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('suppresses hover events and the data-hovered attribute while a drag is in progress', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    (el as unknown as { isDragging: boolean }).isDragging = true;
    let fired = false;
    el.addEventListener('lr-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
    expect(nodeEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('suppresses hover events while panning', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    (el as unknown as { isPanning: boolean }).isPanning = true;
    let fired = false;
    el.addEventListener('lr-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('suppresses hover events during a programmatic camera tween (regression)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    (el as unknown as { isCameraTweening: boolean }).isCameraTweening = true;
    let fired = false;
    el.addEventListener('lr-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('does not fire lr-link-enter/lr-link-leave or set data-hovered for a dangling-stub link', async () => {
    // A dangling stub's `target` is a synthetic stand-in that never resolves to a real node (see
    // SimLink.dangling) -- emitting a link-identity hover event for it would hand a consumer an id
    // guaranteed to never match anything in `nodes`, so the stub is deliberately excluded from
    // hover wiring the same way it's excluded from click/focus/keydown/tooltip/accessible-list.
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes; // ids: a, b
    el.links = [...links, { source: 'a', target: 'does-not-exist' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const stub = el.shadowRoot!.querySelector('[part="link"][data-dangling]') as SVGLineElement;
    expect(stub).to.exist;

    let fired = false;
    el.addEventListener('lr-link-enter', () => (fired = true));
    el.addEventListener('lr-link-leave', () => (fired = true));

    stub.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
    expect(stub.hasAttribute('data-hovered')).to.be.false;

    stub.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(fired).to.be.false;
    expect(stub.hasAttribute('data-hovered')).to.be.false;
  });

  it('suppresses lr-link-enter/lr-link-leave and data-hovered while dragging (onLinkEnter/onLinkLeave twin of the node guard)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const linkEl = el.shadowRoot!.querySelector('[part="link"]') as SVGElement;

    (el as unknown as { isDragging: boolean }).isDragging = true;
    let fired = false;
    el.addEventListener('lr-link-enter', () => (fired = true));
    el.addEventListener('lr-link-leave', () => (fired = true));

    linkEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
    expect(linkEl.hasAttribute('data-hovered')).to.be.false;

    linkEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(fired).to.be.false;
    expect(linkEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('includes the link\'s explicit id in lr-link-enter/lr-link-leave detail when the link has one', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = [{ id: 'e1', source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const linkEl = el.shadowRoot!.querySelector('[part="link"]') as SVGElement;

    let enterDetail: { source: string; target: string; id?: string } | undefined;
    let leaveDetail: { source: string; target: string; id?: string } | undefined;
    el.addEventListener('lr-link-enter', (e) => (enterDetail = (e as CustomEvent).detail));
    el.addEventListener('lr-link-leave', (e) => (leaveDetail = (e as CustomEvent).detail));

    linkEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(enterDetail).to.deep.equal({ source: 'a', target: 'b', id: 'e1' });

    linkEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(leaveDetail).to.deep.equal({ source: 'a', target: 'b', id: 'e1' });
  });
});

it('renders directed links with arrowheads shortened to the target radius', async () => {
  const el = (await fixture(html`<lr-graph seed="42"></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = [{ source: 'a', target: 'b', directed: true }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const link = el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
  const target = el.shadowRoot!.querySelectorAll('[part="node"]')[1] as SVGCircleElement;
  expect(link.getAttribute('marker-end')).to.match(/^url\(#lr-graph-arrow-/);
  expect(link.getAttribute('x2')).to.not.equal(target.getAttribute('cx'));
  expect(el.shadowRoot!.querySelector('[part="arrowhead"]')).to.exist;
});

it('uses rich accessible labels/descriptions and carries a stable link id through activation', async () => {
  const el = (await fixture(html`<lr-graph seed="42"></lr-graph>`)) as LyraGraph;
  el.nodes = [
    { id: 'a', label: 'A', accessibleLabel: 'Document A, 12 citations', description: 'Primary authority' },
    { id: 'b', label: 'B' },
  ];
  el.links = [
    {
      id: 'citation-7',
      source: 'a',
      target: 'b',
      label: 'cites',
      accessibleLabel: 'Document A cites document B seven times',
      description: 'Seven citations',
    },
  ];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const firstNode = el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement;
  const link = el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
  expect(firstNode.getAttribute('aria-label')).to.equal('Document A, 12 citations');
  expect(firstNode.querySelector('title')?.textContent).to.equal('Primary authority');
  expect(link.getAttribute('aria-label')).to.equal('Document A cites document B seven times');
  expect(link.querySelector('title')?.textContent).to.equal('Seven citations');
  let detail: { source: string; target: string; id?: string } | undefined;
  el.addEventListener('lr-link-click', (e) => (detail = (e as CustomEvent).detail));
  link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(detail).to.deep.equal({ source: 'a', target: 'b', id: 'citation-7' });
});

it('applies sanitized per-link color and numeric dash styling', async () => {
  const el = (await fixture(html`<lr-graph seed="42"></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = [{ source: 'a', target: 'b', color: '#ff0000', dash: [4, 2] }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const link = el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
  expect(getComputedStyle(link).stroke).to.equal('rgb(255, 0, 0)');
  expect(link.getAttribute('stroke-dasharray')).to.equal('4 2');

  el.links = [{ source: 'a', target: 'b', color: 'red; position: fixed', dash: [4, -2, Number.NaN] }];
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement).style.position).to.equal('');
  expect((el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement).hasAttribute('stroke-dasharray')).to.be.false;
});

it('emits lr-node-click when a node is activated via keyboard (Enter/Space)', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  let detail: { id: string; x: number; y: number } | undefined;
  el.addEventListener('lr-node-click', (e) => (detail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="node"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
  expect(detail?.id).to.equal('a');
  expect(detail?.x).to.be.a('number');
  expect(detail?.y).to.be.a('number');
});

it('emits lr-link-click when a link is activated via keyboard (Enter/Space)', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  let detail: { source: string; target: string } | undefined;
  el.addEventListener('lr-link-click', (e) => (detail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="link"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
  );
  expect(detail).to.deep.equal({ source: 'a', target: 'b' });
});

it('gives the svg an accessible name summarizing the diagram, and hides duplicate node labels from assistive tech', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  expect(svgEl.getAttribute('aria-label')).to.match(/2 nodes/);
  const label = el.shadowRoot!.querySelector('[part="label"]') as SVGTextElement;
  expect(label.getAttribute('aria-hidden')).to.equal('true');
});

it('uses one roving tab stop with arrow/Home/End navigation and a data-list alternative', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.strings = { graphItemAnnouncement: '{item}, position {index} sur {total}' };
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const items = () =>
    [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
      ...el.shadowRoot!.querySelectorAll('[part="link"]'),
    ] as SVGElement[];
  expect(items().filter((item) => item.getAttribute('tabindex') === '0')).to.have.length(1);
  expect(items().filter((item) => item.getAttribute('tabindex') === '-1')).to.have.length(2);

  items()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(items()[1]!.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('position 2 sur 3');

  items()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(items()[2]!.getAttribute('tabindex')).to.equal('0');
  items()[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(items()[0]!.getAttribute('tabindex')).to.equal('0');

  expect(el.shadowRoot!.querySelectorAll('[part="data-list"] li')).to.have.length(3);
});

it('preserves existing node positions across an incremental nodes/links update instead of restarting the whole layout', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  // Let a few ticks run so node 'a' settles away from its initial random start.
  await aTimeout(200);
  const beforeA = (el.shadowRoot!.querySelectorAll('[part="node"]')[0] as SVGCircleElement).getAttribute('cx');

  // Append a new node — e.g. a live/streaming data feed pushing one incremental update.
  el.nodes = [...nodes, { id: 'c', label: 'C' }];
  el.links = [...links, { source: 'a', target: 'c' }];
  await el.updateComplete;

  const afterA = (el.shadowRoot!.querySelectorAll('[part="node"]')[0] as SVGCircleElement).getAttribute('cx');
  expect(afterA).to.equal(beforeA);
});

it('applies a per-node GraphNode.color as the actual rendered fill', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = [
    { id: 'a', label: 'A', color: '#ff0000' },
    { id: 'b', label: 'B' },
  ];
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const [coloredEl, defaultEl] = [...el.shadowRoot!.querySelectorAll('[part="node"]')];
  // A stylesheet rule always beats a bare presentation attribute in the SVG/CSS
  // cascade, so this must actually change the computed fill (not just the
  // attribute) to prove the per-node color isn't silently overridden.
  expect(getComputedStyle(coloredEl).fill).to.equal('rgb(255, 0, 0)');
  expect(getComputedStyle(coloredEl).fill).to.not.equal(getComputedStyle(defaultEl).fill);
});

describe('node typing (J1)', () => {
  const nodeTypes = [
    { id: 'person', label: 'Person', shape: 'square' as const },
    { id: 'doc', label: 'Document', color: '#112233', shape: 'diamond' as const },
    { id: 'concept', label: 'Concept' }, // no color, no shape -> categorical fallback + circle
  ];
  const typedNodes = [
    { id: 'a', label: 'A', type: 'person' },
    { id: 'b', label: 'B', type: 'doc' },
    { id: 'c', label: 'C', type: 'concept' },
    { id: 'd', label: 'D', type: 'unknown-type' }, // falls back to untyped
    { id: 'e', label: 'E', type: 'concept', color: '#ff0000' }, // node.color wins
  ];
  const typedLinks = [{ source: 'a', target: 'b' }];

  async function mountTyped(): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = nodeTypes;
    el.nodes = typedNodes;
    el.links = typedLinks;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 5, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    return el;
  }

  it('renders circle/square/diamond shape elements per nodeTypes entry, untyped/unknown-type as circle', async () => {
    const el = await mountTyped();
    const items = el.shadowRoot!.querySelectorAll('[part="node"]');
    expect(items[0]!.tagName).to.equal('path'); // a: person -> square
    expect(items[1]!.tagName).to.equal('path'); // b: doc -> diamond
    expect(items[2]!.tagName).to.equal('circle'); // c: concept -> circle (no shape given)
    expect(items[3]!.tagName).to.equal('circle'); // d: unknown-type -> untyped circle
    expect(items[4]!.tagName).to.equal('circle'); // e: concept -> circle
  });

  it('resolves fill precedence: node.color > type.color > categorical palette by nodeTypes index > default token', async () => {
    const el = await mountTyped();
    const items = [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGElement[];
    expect(items[1]!.getAttribute('style')).to.include('--lr-node-fill:#112233'); // b: doc.color
    expect(items[2]!.getAttribute('style') ?? '').to.include('--lr-graph-cat-3'); // c: concept is nodeTypes[2]
    expect(items[3]!.hasAttribute('style')).to.be.false; // d: unknown type -> no inline fill override
    expect(items[4]!.getAttribute('style')).to.include('--lr-node-fill:#ff0000'); // e: node.color wins over type
  });

  it('wraps the categorical index at the 9th nodeTypes entry (typeIndex % 8)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, label: `T${i}` }));
    el.nodes = [
      { id: 'first', type: 't0' },
      { id: 'ninth', type: 't8' },
    ];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const items = [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGElement[];
    expect(items[0]!.getAttribute('style')).to.include('--lr-graph-cat-1'); // index 0 % 8 -> slot 1
    expect(items[1]!.getAttribute('style')).to.include('--lr-graph-cat-1'); // index 8 % 8 -> slot 1 again
  });

  it('positions square/diamond shapes via a per-tick transform, not cx/cy', async () => {
    const el = await mountTyped();
    const squareEl = el.shadowRoot!.querySelector('[part="node"]') as SVGPathElement;
    await aTimeout(50);
    expect(squareEl.getAttribute('transform')).to.match(/^translate\(-?\d+(\.\d+)?,-?\d+(\.\d+)?\)$/);
    expect(squareEl.hasAttribute('cx')).to.be.false;
  });

  it('wraps typed node spoken text via graphTypedNode', async () => {
    const el = await mountTyped();
    const items = [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGElement[];
    expect(items[0]!.getAttribute('aria-label')).to.equal('A (Person)');
    expect(items[2]!.getAttribute('aria-label')).to.equal('C (Concept)');
    expect(items[3]!.getAttribute('aria-label')).to.equal('D'); // unknown type -> unwrapped
  });

  it('is accessible with typed, mixed-shape nodes', async () => {
    const el = await mountTyped();
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no type/nodeTypes set renders identical circles and unwrapped labels', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const items = [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGElement[];
    expect(items.every((i) => i.tagName === 'circle')).to.be.true;
    expect(items[0]!.getAttribute('aria-label')).to.equal('A');
    expect(items[0]!.hasAttribute('cx')).to.be.true;
    expect(items[0]!.hasAttribute('style')).to.be.false;
  });

  it('refreshes the cached nodeEls when nodeTypes alone changes a shape post-mount (regression)', async () => {
    // A consumer mutating nodeTypes without also reassigning nodes/links (e.g.
    // flipping one type's shape from the default circle to 'square') swaps the
    // rendered element (different tag = different DOM node) via Lit's own
    // template diffing. applyInteractions()'s node/link/label DOM cache must
    // be refreshed in that case too, or it keeps pointing at the stale,
    // now-detached element -- see this file's guard in applyInteractions().
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'concept', label: 'Concept' }]; // no shape -> defaults to circle
    el.nodes = [{ id: 'a', label: 'A', type: 'concept' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelector('[part="node"]')!.tagName).to.equal('circle');

    // Mutate nodeTypes ALONE -- nodes/links are not reassigned.
    el.nodeTypes = [{ id: 'concept', label: 'Concept', shape: 'square' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="node"]')?.tagName === 'path', undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    const currentNodeEl = el.shadowRoot!.querySelectorAll('[part="node"]')[0];
    // Compare identity as a boolean rather than handing two DOM elements
    // straight to expect(...).to.equal(...) -- per this file's own testing
    // conventions (see AGENTS.md), a *failing* element/element equality
    // assertion can hang the whole file under wtr's Playwright reporter.
    const cacheRefreshed = currentNodeEl === (el as any).nodeEls[0];
    expect(cacheRefreshed).to.be.true;
  });
});

describe('drawn edge labels (J2)', () => {
  const labeledLinks = [{ source: 'a', target: 'b', label: 'cites' }];

  async function mountLabeled(showEdgeLabels = true): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.showEdgeLabels = showEdgeLabels;
    el.nodes = nodes;
    el.links = labeledLinks;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    return el;
  }

  it('defaults showEdgeLabels to false and renders no link-label text', async () => {
    const el = await mountLabeled(false);
    expect(el.shadowRoot!.querySelector('[part="link-label"]')).to.not.exist;
  });

  it('draws a link-label per labeled link when showEdgeLabels is set, aria-hidden and text-anchor middle', async () => {
    const el = await mountLabeled(true);
    const label = el.shadowRoot!.querySelector('[part="link-label"]') as SVGTextElement;
    expect(label).to.exist;
    expect(label.textContent).to.equal('cites');
    expect(label.getAttribute('aria-hidden')).to.equal('true');
    expect(label.getAttribute('text-anchor')).to.equal('middle');
  });

  it('does not draw a link-label for a link with no label text', async () => {
    const el = (await fixture(html`<lr-graph show-edge-labels></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links; // no .label set
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelector('[part="link-label"]')).to.not.exist;
  });

  it('hides all edge labels below edgeLabelMinZoom via a data-edge-labels-hidden toggle on the zoomed g, without a Lit re-render', async () => {
    const el = await mountLabeled(true);
    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    expect(g.hasAttribute('data-edge-labels-hidden')).to.be.false;
    (el as unknown as { updateEdgeLabelZoomGate: (k: number) => void }).updateEdgeLabelZoomGate(0.3);
    expect(g.getAttribute('data-edge-labels-hidden')).to.equal('');
    (el as unknown as { updateEdgeLabelZoomGate: (k: number) => void }).updateEdgeLabelZoomGate(1);
    expect(g.hasAttribute('data-edge-labels-hidden')).to.be.false;
  });

  it('applies the edge-label zoom gate at initial mount, before any pan/zoom gesture (regression)', async () => {
    // edgeLabelMinZoom set above the initial identity transform's k=1 -- the gate must already be
    // applied by the time the graph first paints, not only reactively after the user's first
    // pan/zoom gesture (see updateEdgeLabelZoomGate()'s own doc comment).
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.showEdgeLabels = true;
    el.edgeLabelMinZoom = 2;
    el.nodes = nodes;
    el.links = labeledLinks;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    expect(g.hasAttribute('data-edge-labels-hidden')).to.be.true;
  });

  it('spoken output (link accessible name) is identical whether showEdgeLabels is on or off', async () => {
    const off = await mountLabeled(false);
    const on = await mountLabeled(true);
    const offLink = off.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
    const onLink = on.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
    expect(offLink.getAttribute('aria-label')).to.equal(onLink.getAttribute('aria-label'));
  });

  it('is accessible with edge labels drawn', async () => {
    const el = await mountLabeled(true);
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: showEdgeLabels unset draws nothing and every existing link/node assertion still holds', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelectorAll('[part="link-label"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('g')!.hasAttribute('data-edge-labels-hidden')).to.be.false;
  });

  it('does not wrap a link in an extra per-link <g> when showEdgeLabels is unset (byte-for-byte link DOM, regression)', async () => {
    // The link must remain a direct child of the outer zoomed <g transform=""> (the only <g> in
    // this part of the template that carries a transform attribute) -- not nested inside a
    // per-link <g> introduced for the (here, unused) drawn-edge-label <text> sibling.
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    const linkEl = el.shadowRoot!.querySelector('[part="link"]:not([data-dangling])')!;
    expect(linkEl.parentElement?.getAttribute('transform')).to.equal('');
  });

  it('refreshes the cached linkLabelEls when showEdgeLabels toggles true post-mount (regression)', async () => {
    // Flipping showEdgeLabels false -> true without reassigning nodes/links triggers a normal
    // Lit re-render that creates the <text part="link-label"> element, but applyInteractions()'s
    // node/link/label DOM cache must be refreshed for a showEdgeLabels-only change too -- or
    // linkLabelEls stays stuck at its pre-toggle (all-null) snapshot and onTick() silently skips
    // repositioning the label on every subsequent tick (e.g. a node drag) forever. See this
    // file's nodeEls regression test above for the analogous nodeTypes-only case.
    const el = await mountLabeled(false);
    expect(el.shadowRoot!.querySelector('[part="link-label"]')).to.not.exist;

    el.showEdgeLabels = true;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="link-label"]'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    const currentLabelEl = el.shadowRoot!.querySelector('[part="link-label"]');
    // Compare identity as a boolean rather than handing two DOM elements straight to
    // expect(...).to.equal(...) -- per this file's own testing conventions (see AGENTS.md), a
    // *failing* element/element equality assertion can hang the whole file under wtr's
    // Playwright reporter.
    const cacheRefreshed = currentLabelEl === (el as any).linkLabelEls[0];
    expect(cacheRefreshed).to.be.true;
  });
});

describe('expand affordance (J3)', () => {
  it('dblclick on a node emits exactly one lr-node-expand after two lr-node-click events, and stops propagation', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let clickCount = 0;
    let expandDetail: { id: string } | undefined;
    let expandCount = 0;
    el.addEventListener('lr-node-click', () => clickCount++);
    el.addEventListener('lr-node-expand', (e) => {
      expandCount++;
      expandDetail = (e as CustomEvent).detail;
    });
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    nodeEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    expect(clickCount).to.equal(2);
    expect(expandCount).to.equal(1);
    expect(expandDetail).to.deep.equal({ id: 'a' });
  });

  it('background dblclick (not on a node) still reaches the svg for d3-zoom default zoom-in (event not stopped)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    expect(g.getAttribute('transform')).to.equal('');
    // d3-zoom's own dblclick handler calls stopImmediatePropagation() on the matched element (see
    // d3-zoom's `noevent()`), so a sibling listener added after the graph mounts would never
    // observe the event either way -- assert the actual, observable effect instead (matching how
    // this file's wheel-zoom test above verifies zoom took effect): d3-zoom's default
    // double-click-to-zoom-in still applies its own scale transform, proving onNodeDblClick()'s
    // own `stopPropagation()` (bound only on node elements) never reaches a background dblclick.
    // Unlike the wheel handler, d3-zoom's dblclick handler animates the transform via a
    // `.transition()` (its own default 250ms duration) rather than applying it synchronously, so
    // this waits out that transition before reading the resulting attribute.
    svgEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await aTimeout(350);
    expect(g.getAttribute('transform')).to.match(/scale\(/);
  });

  it('double-Enter within 500ms on the same focused node emits lr-node-expand; outside the window it does not', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let expandCount = 0;
    el.addEventListener('lr-node-expand', () => expandCount++);
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(expandCount).to.equal(1);

    // Outside the window: reset by waiting past EXPAND_KEY_INTERVAL_MS.
    await aTimeout(600);
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(expandCount).to.equal(1); // first of a new pair, not yet a second
  });

  it('renders a "+" expand-indicator only for nodes with expandable: true, tracked per tick', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A', expandable: true },
      { id: 'b', label: 'B' },
    ];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelectorAll('[part="expand-indicator"]').length).to.equal(1);
    const indicator = el.shadowRoot!.querySelector('[part="expand-indicator"]') as SVGGElement;
    expect(indicator.getAttribute('aria-hidden')).to.equal('true');
    await aTimeout(50);
    expect(indicator.getAttribute('transform')).to.match(/^translate\(-?\d+(\.\d+)?,-?\d+(\.\d+)?\)$/);
  });

  it('wraps expandable node spoken text via graphExpandableItem, composing with the J1 typed wrap', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'doc', label: 'Document' }];
    el.nodes = [{ id: 'a', label: 'A', type: 'doc', expandable: true }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.getAttribute('aria-label')).to.equal('A (Document), expandable');
  });

  it('a new node linked to an already-settled node spawns near that neighbor instead of a random position', async () => {
    const el = (await fixture(html`<lr-graph seed="7" link-distance="100"></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const before = el.simNodes.find((n) => n.id === 'a')!;
    const aX = before.x!;
    const aY = before.y!;

    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.links = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    // Reduced-motion / seeded settles happen synchronously inside rebuildSimulation(), so the new
    // node's spawn position is assigned before this await resolves; assert immediately.
    const spawnedB = el.simNodes.find((n) => n.id === 'b')!;
    const distance = Math.hypot(spawnedB.x! - aX, spawnedB.y! - aY);
    // Within a small multiple of linkDistance/2 (the documented jitter radius) -- nowhere close to
    // a fully random position across the whole width/height canvas.
    expect(distance).to.be.lessThan(el.linkDistance);
    // 'a' itself must not have moved (only nodes with no carried-over position are affected).
    expect(el.simNodes.find((n) => n.id === 'a')!.x).to.equal(aX);
    expect(el.simNodes.find((n) => n.id === 'a')!.y).to.equal(aY);
  });

  it('is accessible with an expandable node', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A', expandable: true }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no expandable set never emits lr-node-expand and renders no indicator', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelectorAll('[part="expand-indicator"]').length).to.equal(0);
    let fired = false;
    el.addEventListener('lr-node-expand', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="node"]') as SVGElement).dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true }),
    );
    expect(fired).to.be.true; // dblclick always emits, regardless of `expandable` (an affordance flag, not a gate)
  });
});

describe('focus & fit (J4 camera)', () => {
  async function mountWide(): Promise<LyraGraph> {
    const el = (await fixture(
      html`<lr-graph width="800" height="600" min-zoom="0.1" max-zoom="8"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.links = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    return el;
  }

  it('focusNode resolves false for an unknown id without moving the camera', async () => {
    const el = await mountWide();
    const result = await el.focusNode('does-not-exist');
    expect(result).to.be.false;
  });

  it('focusNode resolves true and centers the requested node at the viewport center for the given zoom', async () => {
    const el = await mountWide();
    const target = el.simNodes.find((n) => n.id === 'a')!;
    const ok = await el.focusNode('a', { zoom: 2 });
    expect(ok).to.be.true;
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const transform = svgEl.querySelector('g')!.getAttribute('transform')!;
    const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+)\)/);
    expect(match, `unexpected transform string: ${transform}`).to.exist;
    const [, tx, ty, k] = match!.map(Number);
    expect(k).to.be.closeTo(2, 0.01);
    // The node's world position, transformed by (k, tx, ty), must land at the viewport center.
    expect(k * target.x! + tx).to.be.closeTo(400, 1);
    expect(k * target.y! + ty).to.be.closeTo(300, 1);
  });

  it('focusNode clamps an out-of-range zoom to minZoom/maxZoom', async () => {
    const el = await mountWide();
    await el.focusNode('a', { zoom: 100 });
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const transform = svgEl.querySelector('g')!.getAttribute('transform')!;
    const k = Number(transform.match(/scale\(([-\d.]+)\)/)![1]);
    expect(k).to.be.closeTo(8, 0.01); // max-zoom
  });

  it('focusNode announces graphNodeFocused via the live region', async () => {
    const el = await mountWide();
    await el.focusNode('a');
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('Centered on A');
  });

  it('jumps in a single transform write under prefers-reduced-motion (no rAF tween)', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as typeof window.matchMedia;
    try {
      const el = await mountWide();
      let rafCalls = 0;
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
        rafCalls++;
        return originalRaf(cb);
      }) as typeof window.requestAnimationFrame;
      try {
        await el.focusNode('a');
      } finally {
        window.requestAnimationFrame = originalRaf;
      }
      // Exactly one -- the single coalesced lr-viewport-change signal the jump's own zoom handler
      // schedules (see scheduleViewportChange()), not a recurring tween loop. A real tween would
      // request a fresh frame from inside each previous one and rack up far more than one call.
      expect(rafCalls).to.equal(1);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('emits lr-viewport-change with the live camera transform after a focusNode jump', async () => {
    // Reduced-motion writes the transform in one synchronous jump (see the test above), so the
    // single lr-viewport-change it schedules is guaranteed to reflect the arrived-at transform --
    // a real tween instead emits progressively across every frame, and this only needs to prove
    // the payload shape/value, not the tween's own settling behavior.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as typeof window.matchMedia;
    try {
      const el = await mountWide();
      const changed = oneEvent(el, 'lr-viewport-change');
      await el.focusNode('a', { zoom: 2 });
      const detail = (await changed).detail as { k: number; x: number; y: number };
      expect(detail.k).to.be.closeTo(2, 0.01);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('coalesces a real pan/zoom gesture into a single lr-viewport-change per frame', async () => {
    const el = await mountWide();
    let changeCount = 0;
    el.addEventListener('lr-viewport-change', () => changeCount++);
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    // Two wheel events land well within the same animation frame -- both should fold into one
    // scheduled emission rather than firing twice.
    svgEl.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 10, clientY: 10 }));
    svgEl.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 10, clientY: 10 }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(changeCount).to.equal(1);
  });

  it('disconnect cancels an in-flight camera tween instead of animating a detached tree (regression)', async () => {
    const el = await mountWide();
    const call = el.focusNode('a');
    el.remove();
    // cancelCameraTween() both stops the rAF loop (no more frames scheduled against the detached
    // tree) and settles the caller's Promise with `false` instead of leaving it hanging.
    expect(await call).to.be.false;
    expect((el as unknown as { cameraTweenId?: number }).cameraTweenId).to.be.undefined;
  });

  it('a superseded focusNode() call resolves false instead of hanging (regression)', async () => {
    const el = await mountWide();
    const firstCall = el.focusNode('a');
    const secondCall = el.focusNode('b');
    expect(await firstCall).to.be.false;
    expect(await secondCall).to.be.true;
  });

  it('a real user pan/zoom gesture interrupting focusNode() resolves it false instead of hanging (regression)', async () => {
    const el = await mountWide();
    const call = el.focusNode('a');
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    svgEl.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 10, clientY: 10 }),
    );
    expect(await call).to.be.false;
  });

  it('fit() frames the bounding box of all visible node positions within width/height minus padding', async () => {
    const el = await mountWide();
    el.fit({ padding: 10 });
    await aTimeout(400); // let the default (non-reduced-motion) tween settle
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const transform = svgEl.querySelector('g')!.getAttribute('transform')!;
    const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+)\)/);
    expect(match, `unexpected transform string: ${transform}`).to.exist;
    const [, tx, ty, k] = match!.map(Number);
    // Both nodes' world positions, transformed by (k, tx, ty), must land within [10, width/height-10].
    for (const n of el.simNodes) {
      const sx = k * n.x! + tx;
      const sy = k * n.y! + ty;
      expect(sx).to.be.within(-1, 801);
      expect(sy).to.be.within(-1, 601);
    }
  });

  it('focusId declaratively centers once when it first resolves, and does not fight later panning', async () => {
    const el = (await fixture(
      html`<lr-graph width="800" height="600" focus-id="b"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await aTimeout(400);
    const halo = el.shadowRoot!.querySelector('[part="focus-halo"]') as SVGCircleElement;
    expect(halo.hasAttribute('hidden')).to.be.false;
    const target = el.simNodes.find((n) => n.id === 'b')!;
    expect(Number(halo.getAttribute('cx'))).to.be.closeTo(target.x!, 0.5);
  });

  it('focus-halo is hidden when focusId is unset or unresolved', async () => {
    const el = await mountWide();
    const halo = el.shadowRoot!.querySelector('[part="focus-halo"]') as SVGCircleElement;
    expect(halo.hasAttribute('hidden')).to.be.true;
  });

  it('is accessible with focusId set', async () => {
    const el = (await fixture(html`<lr-graph focus-id="a"></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no focusId set never shows the halo and the transform stays untouched by mount', async () => {
    const el = await mountWide();
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    expect(svgEl.querySelector('g')!.getAttribute('transform')).to.equal('');
  });
});

describe('selection (J4)', () => {
  async function mountSelectable(mode: 'single' | 'multiple'): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.selectionMode = mode;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    return el;
  }

  it('defaults selectionMode to none: no aria-pressed/data-selected, no lr-selection-change on click', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('aria-pressed')).to.be.false;
    let fired = false;
    el.addEventListener('lr-selection-change', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('single mode: clicking an unselected node emits a replace intent; clicking it again emits clear', async () => {
    const el = await mountSelectable('single');
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let detail: { nodeIds: string[]; linkIds: string[] } | undefined;
    el.addEventListener('lr-selection-change', (e) => (detail = (e as CustomEvent).detail));
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ nodeIds: ['a'], linkIds: [] });

    el.selectedNodeIds = ['a']; // host reflects the controlled prop back, per the contract
    await el.updateComplete;
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ nodeIds: [], linkIds: [] });
  });

  it('multiple mode: plain click replaces; Ctrl/Meta-click toggles, preserving other selected ids', async () => {
    const el = await mountSelectable('multiple');
    const [nodeA, nodeB] = [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGElement[];
    let detail: { nodeIds: string[]; linkIds: string[] } | undefined;
    el.addEventListener('lr-selection-change', (e) => (detail = (e as CustomEvent).detail));

    nodeA!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ nodeIds: ['a'], linkIds: [] });

    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    nodeB!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(detail).to.deep.equal({ nodeIds: ['a', 'b'], linkIds: [] });

    el.selectedNodeIds = ['a', 'b'];
    await el.updateComplete;
    nodeA!.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }));
    expect(detail).to.deep.equal({ nodeIds: ['b'], linkIds: [] });
  });

  it('Ctrl+Enter toggles in multiple mode the same way as Ctrl-click', async () => {
    const el = await mountSelectable('multiple');
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let detail: { nodeIds: string[]; linkIds: string[] } | undefined;
    el.addEventListener('lr-selection-change', (e) => (detail = (e as CustomEvent).detail));
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ctrlKey: true }));
    expect(detail).to.deep.equal({ nodeIds: ['a'], linkIds: [] });
  });

  it('background click and Escape clear the selection in multiple mode', async () => {
    const el = await mountSelectable('multiple');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    let detail: { nodeIds: string[]; linkIds: string[] } | undefined;
    el.addEventListener('lr-selection-change', (e) => (detail = (e as CustomEvent).detail));
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    svgEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ nodeIds: [], linkIds: [] });

    detail = undefined;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    svgEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(detail).to.deep.equal({ nodeIds: [], linkIds: [] });
  });

  it('reflects controlled selectedNodeIds/selectedLinkIds as data-selected + aria-pressed, and never self-mutates them', async () => {
    const el = await mountSelectable('single');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('data-selected')).to.be.true;
    expect(nodeEl.getAttribute('aria-pressed')).to.equal('true');
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true })); // emits clear, but component doesn't self-apply
    expect(el.selectedNodeIds).to.deep.equal(['a']); // unchanged -- host owns the prop
  });

  it('announces graphSelectionCount when the controlled props change', async () => {
    const el = await mountSelectable('single');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('1 selected');
  });

  it('does not announce "0 selected" on mount (selectedNodeIds/selectedLinkIds default to []), so the mount-time focused-item fallback still speaks', async () => {
    // selectedNodeIds/selectedLinkIds both default to `[]`, a non-undefined default -- Lit marks
    // a property "changed" on the component's very first update whenever it has one, so an
    // unguarded willUpdate() would set graphLiveText to the localized "0 selected" immediately on
    // mount and permanently block render()'s `this.graphLiveText || graphItemAnnouncement(...)`
    // fallback for the focused node/link/community, even with no selection ever made.
    const el = await mountSelectable('single');
    const liveText = el.shadowRoot!.querySelector('[part="live-region"]')!.textContent;
    expect(liveText).to.not.contain('0 selected');
    expect(liveText).to.contain('Node A');
  });

  it('is accessible with a selection applied', async () => {
    const el = await mountSelectable('multiple');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: lr-node-click/lr-link-click still fire unchanged alongside selection', async () => {
    const el = await mountSelectable('single');
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let clickDetail: { id: string; x: number; y: number } | undefined;
    el.addEventListener('lr-node-click', (e) => (clickDetail = (e as CustomEvent).detail));
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clickDetail?.id).to.equal('a');
    expect(clickDetail?.x).to.be.a('number');
    expect(clickDetail?.y).to.be.a('number');
  });
});

describe('type filtering (J5)', () => {
  const typedFilterNodes = [
    { id: 'a', label: 'A', type: 'person' },
    { id: 'b', label: 'B', type: 'doc' },
    { id: 'c', label: 'C' }, // untyped -- never hidden by hiddenTypes
  ];
  const typedFilterLinks = [
    { source: 'a', target: 'b' }, // incident to a hidden 'person' node when 'person' is hidden
    { source: 'b', target: 'c' },
  ];

  async function mountFiltered(hiddenTypes: string[] = []): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.hiddenTypes = hiddenTypes;
    el.nodes = typedFilterNodes;
    el.links = typedFilterLinks;
    await el.updateComplete;
    const expectedVisible = typedFilterNodes.filter(
      (n) => n.type == null || !hiddenTypes.includes(n.type),
    ).length;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === expectedVisible,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT },
    );
    return el;
  }

  it('defaults hiddenTypes to empty and renders every node/link', async () => {
    const el = await mountFiltered();
    expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3);
    expect(el.shadowRoot!.querySelectorAll('[part="link"]:not([data-dangling])').length).to.equal(2);
  });

  it('hides every node whose raw type is listed, plus incident links, from the DOM/simulation/data-list/aria counts', async () => {
    const el = await mountFiltered(['person']);
    const ids = el.simNodes.map((n) => n.id);
    expect(ids).to.not.include('a');
    expect(ids).to.have.members(['b', 'c']);
    expect(el.simLinks.length).to.equal(1); // only b-c survives; a-b is incident to hidden 'a'
    expect(el.shadowRoot!.querySelectorAll('[part="data-list"] li').length).to.equal(3); // 2 nodes + 1 link
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    expect(svgEl.getAttribute('aria-label')).to.match(/2 nodes/);
  });

  it('filters by a raw type string with no matching nodeTypes entry', async () => {
    const el = await mountFiltered(['doc']);
    expect(el.simNodes.map((n) => n.id)).to.have.members(['a', 'c']);
  });

  it('announces graphNodesHidden on change, including "0 of N" when cleared', async () => {
    const el = await mountFiltered(['person']);
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('1 of 3 nodes hidden');
    el.hiddenTypes = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('0 of 3 nodes hidden');
  });

  it('hide then re-show restores each node at its remembered settled position (distance ~ 0)', async () => {
    const el = await mountFiltered();
    await aTimeout(400); // let the force layout settle
    const before = new Map(el.simNodes.map((n) => [n.id, { x: n.x!, y: n.y! }]));

    el.hiddenTypes = ['person'];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    el.hiddenTypes = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const after = el.simNodes.find((n) => n.id === 'a')!;
    const beforePos = before.get('a')!;
    const distance = Math.hypot(after.x! - beforePos.x, after.y! - beforePos.y);
    expect(distance).to.be.lessThan(1);
  });

  it('prunes the remembered-position cache when a node is removed from nodes entirely (not just hidden)', async () => {
    const el = await mountFiltered();
    await aTimeout(400);
    el.nodes = typedFilterNodes.filter((n) => n.id !== 'a');
    el.links = typedFilterLinks.filter((l) => l.source !== 'a' && l.target !== 'a');
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(
      (el as unknown as { lastPositionById: Map<string, { x: number; y: number }> }).lastPositionById.has('a'),
    ).to.be.false;
  });

  it('clamps the roving index when the active item is hidden', async () => {
    const el = await mountFiltered();
    (el.shadowRoot!.querySelector('[part="node"]') as SVGElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    ); // no-op for focus, just mount interaction; roving index defaults to 0 ('a')
    el.hiddenTypes = ['person']; // hides index 0's node
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
      ...el.shadowRoot!.querySelectorAll('[part="link"]'),
    ] as SVGElement[];
    expect(items.filter((i) => i.getAttribute('tabindex') === '0')).to.have.length(1);
  });

  it('is accessible with a type hidden', async () => {
    const el = await mountFiltered(['person']);
    await expect(el).to.be.accessible();
  });

  it('hides the persistent focus-halo when the focused node\'s type is hidden, and restores it when shown again', async () => {
    const el = (await fixture(html`<lr-graph focus-id="a"></lr-graph>`)) as LyraGraph;
    el.nodes = typedFilterNodes;
    el.links = typedFilterLinks;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await aTimeout(400);
    const halo = el.shadowRoot!.querySelector('[part="focus-halo"]') as SVGCircleElement;
    expect(halo.hasAttribute('hidden')).to.be.false;

    el.hiddenTypes = ['person'];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(halo.hasAttribute('hidden')).to.be.true;

    el.hiddenTypes = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(halo.hasAttribute('hidden')).to.be.false;
  });

  it('does not let a selected/focused node id linger after its type is hidden -- it simply stops rendering, unmutated, and resumes if shown again', async () => {
    const el = await mountFiltered();
    el.selectionMode = 'single';
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    el.hiddenTypes = ['person'];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    // The controlled selectedNodeIds array is untouched by the component -- it's the host's to own.
    expect(el.selectedNodeIds).to.deep.equal(['a']);
    expect(el.shadowRoot!.querySelector('[data-selected]')).to.be.null; // hidden node can't render selected

    el.hiddenTypes = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeA = el.shadowRoot!.querySelector('[data-selected]') as SVGElement;
    expect(nodeA.getAttribute('aria-label')).to.contain('A');
  });

  it('existing graph usage unaffected: no hiddenTypes set renders every node/link exactly as before', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelectorAll('[part="link"]:not([data-dangling])').length).to.equal(1);
  });
});

describe('community hulls (J6)', () => {
  const communityNodes = [
    { id: 'a', label: 'A', communityId: 'team-1' },
    { id: 'b', label: 'B', communityId: 'team-1' },
    { id: 'c', label: 'C' },
  ];
  const communities = [{ id: 'team-1', label: 'Team One', memberIds: [] }];

  async function mountHulls(): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.communities = communities;
    el.nodes = communityNodes;
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    return el;
  }

  it('renders no hull when communities is empty', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelector('[part="hull"]')).to.not.exist;
  });

  it('renders one hull per community, membership = union of memberIds and matching communityId', async () => {
    const el = await mountHulls();
    expect(el.shadowRoot!.querySelectorAll('[part="hull"]').length).to.equal(1);
    const hull = el.shadowRoot!.querySelector('[part="hull"]') as SVGPathElement;
    expect(hull.getAttribute('d')).to.not.equal('');
  });

  it('renders no hull for a community whose members are all hidden', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'x', label: 'X' }];
    el.hiddenTypes = ['x'];
    el.communities = [{ id: 'team-1', label: 'Team', memberIds: ['a', 'b'] }];
    el.nodes = [
      { id: 'a', label: 'A', type: 'x' },
      { id: 'b', label: 'B', type: 'x' },
    ];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 0, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelector('[part="hull"]')).to.not.exist;
  });

  it('a 1-member community draws a degenerate (zero-length) hull path', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.communities = [{ id: 'solo', memberIds: ['a'] }];
    el.nodes = [{ id: 'a', label: 'A' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const hull = el.shadowRoot!.querySelector('[part="hull"]') as SVGPathElement;
    expect(hull.getAttribute('d')).to.match(/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/);
  });

  it('hulls stack before links/nodes in DOM order', async () => {
    const el = await mountHulls();
    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    const children = [...g.children].map((c) => c.querySelector('[part]')?.getAttribute('part') ?? c.getAttribute('part'));
    const hullIndex = children.findIndex((p) => p === 'hull');
    const nodeIndex = children.findIndex((p) => p === 'node');
    expect(hullIndex).to.be.lessThan(nodeIndex);
  });

  it('click and Enter/Space on a hull emit lr-community-click', async () => {
    const el = await mountHulls();
    const hull = el.shadowRoot!.querySelector('[part="hull"]') as SVGPathElement;
    let detail: { id: string; x: number; y: number } | undefined;
    el.addEventListener('lr-community-click', (e) => (detail = (e as CustomEvent).detail));
    hull.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ id: 'team-1' });
    detail = undefined;
    hull.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({ id: 'team-1' });
  });

  it('hulls join the roving ring after nodes and links, with a matching data-list entry', async () => {
    const el = await mountHulls();
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
      ...el.shadowRoot!.querySelectorAll('[part="link"]'),
      ...el.shadowRoot!.querySelectorAll('[part="hull"]'),
    ] as SVGElement[];
    expect(items[items.length - 1]!.getAttribute('part')).to.equal('hull');
    expect(el.shadowRoot!.querySelectorAll('[part="data-list"] li')).to.have.length(4); // 3 nodes + 1 hull
  });

  it('fit() bounding box accounts for hull padding when communities render', async () => {
    const el = await mountHulls();
    el.fit({ padding: 10 });
    await aTimeout(400);
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const transform = svgEl.querySelector('g')!.getAttribute('transform')!;
    expect(transform).to.match(/translate\([-\d.]+,\s*[-\d.]+\)\s*scale\([-\d.]+\)/);
  });

  it('is accessible with hulls rendered', async () => {
    const el = await mountHulls();
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no communities set renders no hulls and an unchanged roving ring', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
      ...el.shadowRoot!.querySelectorAll('[part="link"]'),
    ] as SVGElement[];
    expect(items.filter((i) => i.getAttribute('tabindex') === '0')).to.have.length(1);
  });

  it('memoizes the per-community member walk once per structural update instead of once per graphItemCount() call site', async () => {
    const el = await mountHulls();
    type WithCommunityMembers = { communityMembers: (c: unknown) => unknown };
    let calls = 0;
    const original = (el as unknown as WithCommunityMembers).communityMembers.bind(el);
    (el as unknown as WithCommunityMembers).communityMembers = (c: unknown) => {
      calls++;
      return original(c);
    };
    // A structural change (a genuinely new nodes array) is the only thing that should force a fresh
    // recompute -- the render this triggers reads the community/member walk from many places (every
    // node/link/hull tabindex expression, the outer <svg> tabindex, the live-region branch, the
    // hull/data-list templates), all of which must share one cached result instead of each
    // independently re-walking `communities` × `simNodes`.
    el.nodes = [...communityNodes, { id: 'd', label: 'D', communityId: 'team-1' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 4, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(calls).to.equal(communities.length);
  });
});

describe('layered layout (J7)', () => {
  const chainLinks = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];

  it('defaults layout to force (unchanged today behavior)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    expect(el.layout).to.equal('force');
  });

  it('layout="layered" positions nodes deterministically, top-to-bottom by longest path, without a settle animation', async () => {
    const el = (await fixture(html`<lr-graph layout="layered" width="800" height="600"></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    el.links = chainLinks;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const b = el.simNodes.find((n) => n.id === 'b')!;
    const c = el.simNodes.find((n) => n.id === 'c')!;
    expect(a.y!).to.be.lessThan(b.y!);
    expect(b.y!).to.be.lessThan(c.y!);
  });

  it('node drag is disabled in layered mode (no d3-drag bound)', async () => {
    const el = (await fixture(html`<lr-graph layout="layered"></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    const before = { x: nodeEl.getAttribute('cx'), y: nodeEl.getAttribute('cy') };
    // `view: window` matches a real user-dispatched event (jsdom/browsers leave it `null` on a
    // bare synthetic MouseEvent) -- with no d3-drag bound to intercept and stop propagation, this
    // mousedown now bubbles to the svg's own d3-zoom pan-start handler, which reads
    // `event.view.document` internally and throws on a `null` view.
    nodeEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0, view: window }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100, view: window }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window }));
    await el.updateComplete;
    expect(nodeEl.getAttribute('cx')).to.equal(before.x);
    expect(nodeEl.getAttribute('cy')).to.equal(before.y);
  });

  it('linkDistance retunes the layer gap in layered mode', async () => {
    const tight = (await fixture(
      html`<lr-graph layout="layered" link-distance="20" width="800" height="600"></lr-graph>`,
    )) as LyraGraph;
    tight.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    tight.links = [{ source: 'a', target: 'b' }];
    await tight.updateComplete;
    await waitUntil(() => tight.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const gapBefore = tight.simNodes.find((n) => n.id === 'b')!.y! - tight.simNodes.find((n) => n.id === 'a')!.y!;
    tight.linkDistance = 300;
    await tight.updateComplete;
    await waitUntil(
      () => tight.simNodes.find((n) => n.id === 'b')!.y! - tight.simNodes.find((n) => n.id === 'a')!.y! !== gapBefore,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT },
    );
    const gapAfter = tight.simNodes.find((n) => n.id === 'b')!.y! - tight.simNodes.find((n) => n.id === 'a')!.y!;
    expect(gapAfter).to.be.greaterThan(gapBefore);
  });

  it('keyboard roving/announcements are identical in layered mode', async () => {
    const el = (await fixture(html`<lr-graph layout="layered"></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.links = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const items = () => [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGElement[];
    items()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(items()[1]!.getAttribute('tabindex')).to.equal('0');
  });

  it('both lr-graph and the shared util produce the same node ordering (no forked algorithm)', async () => {
    const el = (await fixture(html`<lr-graph layout="layered" width="800" height="600"></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.links = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const direct = layeredLayout({
      nodes: [
        { id: 'a', width: 30, height: 30 },
        { id: 'b', width: 30, height: 30 },
      ],
      edges: [{ source: 'a', target: 'b' }],
      options: { gapX: 12, gapY: el.linkDistance },
    });
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const b = el.simNodes.find((n) => n.id === 'b')!;
    // Same relative gap (component centers the drawing, so compare deltas, not absolute coords).
    expect(b.y! - a.y!).to.be.closeTo(direct.get('b')!.y - direct.get('a')!.y, 0.01);
  });

  it('is accessible in layered mode', async () => {
    const el = (await fixture(html`<lr-graph layout="layered"></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await expect(el).to.be.accessible();
  });

  it('hiddenTypes filtering announces graphNodesHidden in layered mode too, same as force mode', async () => {
    const el = (await fixture(html`<lr-graph layout="layered"></lr-graph>`)) as LyraGraph;
    el.hiddenTypes = ['person'];
    el.nodes = [
      { id: 'a', label: 'A', type: 'person' },
      { id: 'b', label: 'B' },
    ];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('1 of 2 nodes hidden');
  });

  it('existing graph usage unaffected: layout unset uses the untouched force-directed path', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect((el as unknown as { simulation?: unknown }).simulation).to.exist;
  });
});

describe('canvas renderer — static draw', () => {
  async function mountCanvas(): Promise<LyraGraph> {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50); // let the draw rAF fire
    return el;
  }

  it('defaults renderer to svg', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    expect(el.renderer).to.equal('svg');
    expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;
  });

  it('renderer="canvas" renders a canvas element instead of an svg, no [part="node"]/[part="link"] elements', async () => {
    const el = await mountCanvas();
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
    expect(el.shadowRoot!.querySelector('svg')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="node"]')).to.not.exist;
  });

  it('sizes the backing store to CSS size * devicePixelRatio', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    expect(canvas.width).to.equal(Math.round(canvas.clientWidth * dpr));
    expect(canvas.height).to.equal(Math.round(canvas.clientHeight * dpr));
  });

  it('every event/method/prop still works identically in canvas mode (selectionMode, hiddenTypes, showEdgeLabels)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" show-edge-labels selection-mode="single" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = [{ source: 'a', target: 'b', label: 'cites' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    const ok = await el.focusNode('a');
    expect(ok).to.be.true;
  });

  it('is accessible in canvas mode', async () => {
    const el = await mountCanvas();
    await expect(el).to.be.accessible();
  });

  it('canvas mode\'s live-region announces the first graph item via graphItemAnnouncement before anything is focused/hidden', async () => {
    // graphLiveText (the `||` left side of render()'s canvas-mode live-region expression) starts
    // out empty and activeGraphItem defaults to 0, so a fresh mount with items present already
    // exercises the `normalizedGraphItem() >= 0` true side of the ternary on its own, with no
    // focus/hiddenTypes interaction needed.
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    // graphItemCount() === simNodes.length(2) + simLinks.length(1) + communities(0) === 3.
    expect(liveRegion.textContent).to.contain('(1 of 3)');
  });

  it('switching renderer back to svg tears down the canvas resize watcher (no observer stacking across round trips, regression)', async () => {
    const el = await mountCanvas();
    expect((el as unknown as { canvasResizeObserver?: ResizeObserver }).canvasResizeObserver).to.exist;
    el.renderer = 'svg';
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('svg'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    // Re-entering canvas mode re-arms a fresh observer; leaving it must disconnect the old one,
    // or every canvas -> svg -> canvas round trip would stack another live observer on the host.
    expect((el as unknown as { canvasResizeObserver?: ResizeObserver }).canvasResizeObserver).to.be.undefined;
  });

  it('existing graph usage unaffected: renderer unset renders the untouched svg path', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;
  });

  it('feeds dimmedNodeIds/dimmedLinkIds into the drawn canvas scene', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    el.dimmedNodeIds = ['a'];
    el.style.setProperty('--lr-graph-dimmed-opacity', '0');
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50); // let the draw rAF fire
    await waitUntil(() => (el as unknown as { canvasScene?: { nodes: unknown[] } }).canvasScene?.nodes.length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    type Internals = { canvasScene?: { nodes: { dimmed?: boolean }[]; dimmedOpacity?: number } };
    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.nodes.some((n) => n.dimmed)).to.be.true;
    expect(scene.nodes.some((n) => !n.dimmed)).to.be.true;
    expect(scene.dimmedOpacity).to.equal(0);
  });
});

describe('canvas renderer — interaction and a11y', () => {
  async function mountCanvas(): Promise<LyraGraph> {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(400); // let the force layout settle so node positions are stable for hit-testing
    return el;
  }

  it('clicking a node (via pointer hit-test) emits lr-node-click, same detail shape as svg mode', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + target.x!;
    const clientY = rect.top + target.y!;
    let detail: { id: string; x: number; y: number } | undefined;
    el.addEventListener('lr-node-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX, clientY, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX, clientY, pointerId: 1 }));
    expect(detail?.id).to.equal(target.id);
    expect(detail?.x).to.be.a('number');
    expect(detail?.y).to.be.a('number');
  });

  it('clicking empty canvas space with no hit clears the selection when selectionMode is set', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" selection-mode="single" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(400);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { nodeIds: string[]; linkIds: string[] } | undefined;
    el.addEventListener('lr-selection-change', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + 399, clientY: rect.top + 299, pointerId: 2 }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: rect.left + 399, clientY: rect.top + 299, pointerId: 2 }),
    );
    expect(detail).to.deep.equal({ nodeIds: [], linkIds: [] });
  });

  it('dblclick on a node emits lr-node-expand in canvas mode too', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    let detail: { id: string } | undefined;
    el.addEventListener('lr-node-expand', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, clientX: rect.left + target.x!, clientY: rect.top + target.y! }),
    );
    expect(detail?.id).to.equal(target.id);
    expect(detail).to.deep.equal({ id: target.id });
  });

  // Seeded so the force layout converges synchronously: hover hit-testing is coalesced to one per
  // animation frame and deferred while the simulation is still ticking, so a still-settling mount
  // would never resolve a hover at all.
  async function mountSettledCanvas(): Promise<LyraGraph> {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" seed="7" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50); // let the draw rAF fire so the backing store is sized for hit-testing
    return el;
  }

  it('shows a hover tooltip with the item label on pointer hover, hides it off-item', async () => {
    const el = await mountSettledCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 3,
      }),
    );
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    // Hover hit-testing is coalesced to one per animation frame, so the tooltip appears on the
    // frame after the pointermove, not synchronously within its dispatch.
    await waitUntil(() => !tooltip.hasAttribute('hidden'), 'coalesced hover should resolve on the next frame');
    // nodeAccessibleText() is private -- read it via the same `unknown` cast this file already
    // uses elsewhere for private-member assertions, to compute the exact expected label.
    const expectedLabel = (el as unknown as { nodeAccessibleText: (n: unknown) => string }).nodeAccessibleText(target);
    expect(tooltip.textContent).to.equal(expectedLabel);

    canvas.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: rect.left + 399, clientY: rect.top + 299, pointerId: 3 }),
    );
    await waitUntil(() => tooltip.hasAttribute('hidden'), 'off-item hover should hide the tooltip on the next frame');
  });

  it('positions the hover tooltip from the physical left edge so it tracks the cursor under dir="rtl" (regression)', async () => {
    const container = (await fixture(html`
      <div dir="rtl">
        <lr-graph renderer="canvas" seed="7" width="400" height="300" style="width:400px;height:300px"></lr-graph>
      </div>
    `)) as HTMLElement;
    const el = container.querySelector('lr-graph') as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 9,
      }),
    );
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    await waitUntil(() => !tooltip.hasAttribute('hidden'), 'coalesced hover should resolve on the next frame');
    // The offset is computed from the canvas's physical left edge, so it must land on the physical
    // `left` property -- `inset-inline-start` maps to `right` under RTL, which would mirror the
    // tooltip across the canvas instead of placing it at the cursor.
    expect(parseFloat(tooltip.style.left)).to.be.closeTo(target.x!, 1);
    expect(parseFloat(tooltip.style.top)).to.be.closeTo(target.y!, 1);
    expect(tooltip.style.insetInlineStart).to.equal('');
  });

  it('renders one offscreen cursor-item button per node/link, in the same roving order as svg mode, driving the same keyboard/announcement logic', async () => {
    const el = await mountCanvas();
    const items = [...el.shadowRoot!.querySelectorAll('[part="cursor-item"]')] as HTMLButtonElement[];
    expect(items).to.have.length(3); // 2 nodes + 1 link
    expect(items.filter((i) => i.getAttribute('tabindex') === '0')).to.have.length(1);
    items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(items[1]!.getAttribute('tabindex')).to.equal('0');
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.not.equal('');
  });

  it('Enter/Space on a cursor-item activates the same click handler as pointer interaction', async () => {
    const el = await mountCanvas();
    const items = [...el.shadowRoot!.querySelectorAll('[part="cursor-item"]')] as HTMLButtonElement[];
    let detail: { id: string; x: number; y: number } | undefined;
    el.addEventListener('lr-node-click', (e) => (detail = (e as CustomEvent).detail));
    items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail?.id).to.equal(el.simNodes[0]!.id);
    expect(detail?.x).to.be.a('number');
    expect(detail?.y).to.be.a('number');
  });

  it('is accessible with interactions and a selection applied in canvas mode', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" selection-mode="multiple" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await expect(el).to.be.accessible();
  });

  it('starts in the shared loading state before any renderer-specific markup, same as svg mode', () => {
    // The existing peer-missing fallback (graph-loader.ts's console.warn path) is renderer-
    // agnostic -- render()'s loading branch is checked before the renderer==='canvas' branch, and
    // this.loading never resolves false without this.d3, so canvas mode shows the same loading
    // skeleton, never a partially-initialized canvas. Asserted on the class-field default directly
    // (rather than after an async fixture()+mount) because this file has, by this point, already
    // resolved the module-level lazy d3 loader for earlier tests -- a fresh element's loadD3()
    // .then() callback could plausibly settle before a later assertion runs, making "still loading
    // right after mount" an unreliable thing to assert on here specifically.
    const el = document.createElement('lr-graph') as LyraGraph;
    el.renderer = 'canvas';
    expect((el as unknown as { loading: boolean }).loading).to.be.true;
  });
});

it('does not let a GraphNode.color value inject extra CSS declarations via the node style attribute', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = [
    { id: 'a', label: 'A', color: 'red; position: fixed; top: 0px' },
    { id: 'b', label: 'B' },
  ];
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const [coloredEl] = [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGCircleElement[];
  // Read the parsed inline style declaration directly (not getComputedStyle,
  // which reports 'static' for SVG shape elements regardless of what's
  // declared) — this is what actually detects a second CSS declaration
  // having been injected into the style attribute via string concatenation.
  expect(coloredEl.style.position).to.equal('');
  expect(coloredEl.style.top).to.equal('');
});

it('wires up d3-drag on each node (draggable, per the Interfaces spec)', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement;
  expect(select(nodeEl).on('mousedown.drag')).to.be.a('function');
});

it('wires up d3-zoom pan/zoom on the svg (per the Interfaces spec)', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;
  expect(select(svgEl).on('wheel.zoom')).to.be.a('function');
  expect(g.getAttribute('transform')).to.equal('');

  svgEl.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 10, clientY: 10 }),
  );
  await el.updateComplete;
  expect(g.getAttribute('transform')).to.match(/scale\(/);
});

it('bounds zoom to a sane scaleExtent instead of zooming in unbounded', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;

  // A single huge wheel delta would zoom far past any sane bound if
  // scaleExtent isn't set.
  svgEl.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100000, clientX: 10, clientY: 10 }),
  );
  await el.updateComplete;
  const match = /scale\(([^)]+)\)/.exec(g.getAttribute('transform') ?? '');
  expect(match).to.exist;
  expect(Number(match![1])).to.be.at.most(8);
});

it('retunes the live zoom scaleExtent when minZoom/maxZoom change after the svg has already been bound', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  // The svg is already bound to d3-zoom (with the default 0.1–8 scaleExtent)
  // by this point — this is the post-mount case that used to be a no-op.
  el.minZoom = 1;
  el.maxZoom = 2;
  await el.updateComplete;

  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;

  // A huge wheel delta would zoom well past 2 if the live scaleExtent hadn't
  // actually been retuned.
  svgEl.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100000, clientX: 10, clientY: 10 }),
  );
  await el.updateComplete;
  const match = /scale\(([^)]+)\)/.exec(g.getAttribute('transform') ?? '');
  expect(match).to.exist;
  expect(Number(match![1])).to.be.at.most(2);
});

it('updates the charge/link forces in place when chargeStrength/linkDistance change after mount', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  el.chargeStrength = -900;
  el.linkDistance = 250;
  await el.updateComplete;

  const chargeForce = (el as any).chargeForce as { strength: () => () => number };
  const linkForce = (el as any).linkForce as { distance: () => () => number };
  expect(chargeForce.strength()()).to.equal(-900);
  expect(linkForce.distance()()).to.equal(250);
});

it('still retunes chargeStrength/linkDistance when width/height change in the same update batch', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  // Setting both in the same synchronous batch used to mean only the
  // width/height branch ran (they were joined with `else if`), silently
  // dropping the chargeStrength retune.
  el.width = 1000;
  el.chargeStrength = -900;
  await el.updateComplete;

  const chargeForce = (el as any).chargeForce as { strength: () => () => number };
  expect(chargeForce.strength()()).to.equal(-900);
});

it('recenters the simulation and bumps alpha when width/height change post-mount', async function () {
  // Waiting for a *full* default-alphaDecay settle (ALPHA_SETTLE_TIMEOUT
  // below) genuinely takes close to 5s on its own -- raise this test's own
  // Mocha timeout (web-test-runner.config.js sets a 6s default for every
  // test) so that wait isn't cut off by the runner before it gets the
  // chance to finish.
  this.timeout(20_000);
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const simulation = (el as any).simulation as {
    alpha: () => number;
    alphaMin: () => number;
    force: (name: string) => { x: () => number; y: () => number };
  };
  // Let the initial settle finish so the alpha bump below is unambiguous.
  await waitUntil(() => simulation.alpha() <= simulation.alphaMin(), undefined, {
    timeout: ALPHA_SETTLE_TIMEOUT,
  });

  el.width = 1000;
  el.height = 400;
  await el.updateComplete;

  const center = simulation.force('center');
  expect(center.x()).to.equal(500);
  expect(center.y()).to.equal(200);
  expect(simulation.alpha()).to.be.greaterThan(simulation.alphaMin());
});

// Regression coverage for the shared finite-number normalization layer (`src/internal/numbers.ts`)
// not previously wired up for width/height/min-zoom/max-zoom/charge-strength/link-distance -- an
// invalid attribute value used to flow straight into forceCenter()/d3-force's strength()/
// distance()/scaleExtent() and the SVG viewBox, poisoning the simulation and rendered geometry
// with NaN instead of being clamped like every other numeric property in this library.
it('normalizes non-finite/non-positive width or height so the viewBox and force-center stay finite', async () => {
  const el = (await fixture(html`<lr-graph width="NaN" height="-100"></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  expect(svgEl.getAttribute('viewBox')).to.not.match(/NaN|Infinity|-100/);

  const simulation = (el as any).simulation as { force: (name: string) => { x: () => number; y: () => number } };
  const center = simulation.force('center');
  expect(Number.isFinite(center.x())).to.be.true;
  expect(Number.isFinite(center.y())).to.be.true;
});

it('normalizes non-finite/negative min-zoom or max-zoom so the live scaleExtent and zoomed scale stay finite', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  el.minZoom = NaN;
  el.maxZoom = Infinity;
  await el.updateComplete;
  const zoomBehavior = (el as any).zoomBehavior as { scaleExtent: () => [number, number] };
  let [lo, hi] = zoomBehavior.scaleExtent();
  expect(Number.isFinite(lo)).to.be.true;
  expect(Number.isFinite(hi)).to.be.true;
  expect(lo).to.be.greaterThan(0);

  el.minZoom = -Infinity;
  el.maxZoom = -5; // a negative upper zoom bound is meaningless
  await el.updateComplete;
  [lo, hi] = zoomBehavior.scaleExtent();
  expect(Number.isFinite(lo)).to.be.true;
  expect(Number.isFinite(hi)).to.be.true;
  expect(hi).to.be.greaterThan(0);

  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;
  svgEl.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100000, clientX: 10, clientY: 10 }),
  );
  await el.updateComplete;
  const match = /scale\(([^)]+)\)/.exec(g.getAttribute('transform') ?? '');
  expect(match).to.exist;
  expect(Number.isFinite(Number(match![1]))).to.be.true;
});

it('normalizes non-finite charge-strength and non-finite/negative link-distance so the live d3-force objects never receive NaN', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  el.chargeStrength = NaN;
  el.linkDistance = -250; // a negative link distance has no sane geometric meaning
  await el.updateComplete;

  const chargeForce = (el as any).chargeForce as { strength: () => () => number };
  const linkForce = (el as any).linkForce as { distance: () => () => number };
  expect(Number.isFinite(chargeForce.strength()())).to.be.true;
  const distance = linkForce.distance()();
  expect(Number.isFinite(distance)).to.be.true;
  expect(distance).to.be.at.least(0);

  el.chargeStrength = Infinity;
  await el.updateComplete;
  expect(Number.isFinite(chargeForce.strength()())).to.be.true;
});

it('normalizes a non-finite seed to a finite integer instead of poisoning the deterministic spawn hash', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.seed = Number.NaN;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  for (const n of el.nodes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = (el as any).simNodes.find((s: { id: string }) => s.id === n.id);
    expect(Number.isFinite(sim.x)).to.be.true;
    expect(Number.isFinite(sim.y)).to.be.true;
  }

  el.seed = Infinity;
  el.links = [...links];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  for (const n of el.nodes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = (el as any).simNodes.find((s: { id: string }) => s.id === n.id);
    expect(Number.isFinite(sim.x)).to.be.true;
    expect(Number.isFinite(sim.y)).to.be.true;
  }
});

it('leaves seed undefined (unseeded/random) alone -- only a defined-but-non-finite seed is normalized', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  expect(el.seed).to.be.undefined;
  expect((el as any).safeSeed).to.be.undefined;
});

it('normalizes a non-finite edge-label-min-zoom so the live edge-label visibility gate keeps working instead of never hiding', async () => {
  const el = (await fixture(html`<lr-graph show-edge-labels></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = [{ source: 'a', target: 'b', label: 'A to B' }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  el.edgeLabelMinZoom = Number.NaN;
  await el.updateComplete;
  expect(Number.isFinite((el as any).safeEdgeLabelMinZoom)).to.be.true;

  // Un-normalized, `k < NaN` is always false, so the labels would never hide no matter how far
  // out the camera zooms -- zoom out past the (fallback-normalized) default threshold and confirm
  // the gate still engages.
  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;
  svgEl.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100000, clientX: 10, clientY: 10 }),
  );
  await el.updateComplete;
  expect(g.hasAttribute('data-edge-labels-hidden')).to.be.true;
});

it('does not reassign simNodes/simLinks references on tick, only positions (avoids a full Lit re-render every animation frame)', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simNodesRef = (el as any).simNodes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simLinksRef = (el as any).simLinks;
  const initialCx = (el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement).getAttribute('cx');

  // Let the simulation tick for a while.
  await aTimeout(300);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).simNodes).to.equal(simNodesRef);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).simLinks).to.equal(simLinksRef);
  // Positions still actually update (via direct DOM writes, not Lit
  // re-renders) — this isn't a frozen simulation, ticks just no longer
  // reassign the reactive simNodes/simLinks array references.
  const laterCx = (el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement).getAttribute('cx');
  expect(laterCx).to.not.equal(initialCx);
});

it('skips the settle animation under prefers-reduced-motion (jumps straight to a converged layout)', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;

  try {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    const simulation = (el as any).simulation as { alpha: () => number; alphaMin: () => number };
    expect(simulation.alpha()).to.be.at.most(simulation.alphaMin());
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('seeded layout: two separate instances with the same nodes/links/seed converge to bit-identical final positions', async () => {
  const seededNodes = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  const seededLinks = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];

  const positionsOf = (el: LyraGraph) =>
    Array.from(el.shadowRoot!.querySelectorAll('[part="node"]')).map((n) => ({
      cx: n.getAttribute('cx'),
      cy: n.getAttribute('cy'),
    }));

  const elA = (await fixture(html`<lr-graph seed="42"></lr-graph>`)) as LyraGraph;
  elA.nodes = seededNodes;
  elA.links = seededLinks;
  await elA.updateComplete;
  await waitUntil(() => elA.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const elB = (await fixture(html`<lr-graph seed="42"></lr-graph>`)) as LyraGraph;
  // Deliberately reorder the nodes array between the two instances — a
  // reproducible seeded layout must be keyed by node id, not array index.
  elB.nodes = [seededNodes[2], seededNodes[0], seededNodes[1]];
  elB.links = seededLinks;
  await elB.updateComplete;
  await waitUntil(() => elB.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  // Match up positions by node id (not DOM order, since elB's nodes were
  // supplied in a different order) via the aria-label, which is set to the
  // node's label/id.
  const byLabel = (el: LyraGraph) => {
    const map = new Map<string, { cx: string | null; cy: string | null }>();
    el.shadowRoot!.querySelectorAll('[part="node"]').forEach((n) => {
      map.set(n.getAttribute('aria-label')!, { cx: n.getAttribute('cx'), cy: n.getAttribute('cy') });
    });
    return map;
  };
  const mapA = byLabel(elA);
  const mapB = byLabel(elB);
  expect(mapA.size).to.equal(3);
  for (const [label, posA] of mapA) {
    const posB = mapB.get(label);
    expect(posB, `missing node ${label} in elB`).to.exist;
    expect(posB).to.deep.equal(posA);
  }
  // Sanity: positions actually recorded, this isn't vacuously true.
  expect(positionsOf(elA).every((p) => p.cx != null && p.cy != null)).to.be.true;
});

it('seeded layout: different seeds produce different final positions', async () => {
  const seededNodes = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  const seededLinks = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];

  const elA = (await fixture(html`<lr-graph seed="1"></lr-graph>`)) as LyraGraph;
  elA.nodes = seededNodes;
  elA.links = seededLinks;
  await elA.updateComplete;
  await waitUntil(() => elA.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const elB = (await fixture(html`<lr-graph seed="2"></lr-graph>`)) as LyraGraph;
  elB.nodes = seededNodes;
  elB.links = seededLinks;
  await elB.updateComplete;
  await waitUntil(() => elB.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const posA = Array.from(elA.shadowRoot!.querySelectorAll('[part="node"]')).map((n) => [
    n.getAttribute('cx'),
    n.getAttribute('cy'),
  ]);
  const posB = Array.from(elB.shadowRoot!.querySelectorAll('[part="node"]')).map((n) => [
    n.getAttribute('cx'),
    n.getAttribute('cy'),
  ]);
  expect(posA).to.not.deep.equal(posB);
});

it('seeded layout: settles synchronously (like prefers-reduced-motion) so the layout is reproducible without waiting on animation frames', async () => {
  const el = (await fixture(html`<lr-graph seed="7"></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const simulation = (el as any).simulation as { alpha: () => number; alphaMin: () => number };
  expect(simulation.alpha()).to.be.at.most(simulation.alphaMin());
});

it('seed unset: layout is unaffected (still uses forceSimulation()s own random initial start, not the deterministic PRNG)', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  // Without a seed, the simulation still animates its settle instead of
  // jumping straight to alphaMin — the existing (pre-seed-feature) behavior.
  const simulation = (el as any).simulation as { alpha: () => number; alphaMin: () => number };
  expect(simulation.alpha()).to.be.greaterThan(simulation.alphaMin());
});

it('user-initiated drag still works normally after a seeded synchronous settle', async () => {
  const el = (await fixture(html`<lr-graph seed="7"></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement;
  expect(select(nodeEl).on('mousedown.drag')).to.be.a('function');
});

it('changing seed after nodes/links already have positions is a documented no-op (does not retroactively reposition)', async () => {
  const seededNodes = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];
  const seededLinks = [{ source: 'a', target: 'b' }];

  const el = (await fixture(html`<lr-graph seed="1"></lr-graph>`)) as LyraGraph;
  el.nodes = seededNodes;
  el.links = seededLinks;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const before = Array.from(el.shadowRoot!.querySelectorAll('[part="node"]')).map((n) => [
    n.getAttribute('cx'),
    n.getAttribute('cy'),
  ]);

  // A different seed, supplied after nodes/links already assigned every
  // node a settled position, must not reshuffle the existing layout.
  el.seed = 999;
  await el.updateComplete;

  const after = Array.from(el.shadowRoot!.querySelectorAll('[part="node"]')).map((n) => [
    n.getAttribute('cx'),
    n.getAttribute('cy'),
  ]);
  expect(after).to.deep.equal(before);
});

it('clamps an out-of-range GraphNode.radius so the node still renders visibly-sized and focusable', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = [
    { id: 'a', label: 'A', radius: 0 },
    { id: 'b', label: 'B', radius: -50 },
    { id: 'c', label: 'C', radius: 1000 },
  ];
  el.links = [];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const circles = Array.from(el.shadowRoot!.querySelectorAll('[part="node"]')) as SVGCircleElement[];
  for (const [index, circle] of circles.entries()) {
    const r = Number(circle.getAttribute('r'));
    expect(r).to.be.at.least(6);
    expect(r).to.be.at.most(24);
    expect(circle.getAttribute('tabindex')).to.equal(index === 0 ? '0' : '-1');
    expect(circle.getAttribute('role')).to.equal('button');
  }
});

it('stops the force simulation on disconnect so a detached instance stops ticking', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simulation = (el as any).simulation;
  let stopped = false;
  const originalStop = simulation.stop.bind(simulation);
  simulation.stop = (...args: unknown[]) => {
    stopped = true;
    return originalStop(...args);
  };

  el.remove();
  expect(stopped, 'disconnectedCallback should call simulation.stop()').to.be.true;

  // With the timer actually stopped, alpha can no longer decay via further
  // ticks — a still-running simulation would keep animating a detached
  // instance indefinitely.
  const alphaAfterDisconnect = simulation.alpha();
  await aTimeout(200);
  expect(simulation.alpha()).to.equal(alphaAfterDisconnect);
});

it('does not restart the simulation from scratch on a reconnect (e.g. a drag-and-drop reparent)', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simulation = (el as any).simulation as { alpha: () => number; alphaMin: () => number };
  await waitUntil(() => simulation.alpha() <= simulation.alphaMin(), undefined, {
    timeout: ALPHA_SETTLE_TIMEOUT,
  });

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  otherContainer.appendChild(el); // reparenting an already-connected node fires disconnectedCallback then connectedCallback synchronously

  // A buggy connectedCallback kicks off its rebuild from an already-resolved
  // `loadD3()` promise's `.then()` — that callback lands on a later
  // microtask/task, not synchronously within this reparent — so give it a
  // moment to run before asserting nothing changed.
  await aTimeout(50);

  // A from-scratch rebuild would swap in a brand-new forceSimulation()
  // instance (starting at alpha=1, restarting the ~300-tick settle
  // animation) — the same, already-settled instance must be reused instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).simulation).to.equal(simulation);
  expect(simulation.alpha()).to.be.at.most(simulation.alphaMin());

  otherContainer.remove();
});

it('renders a dangling-target link as a stub off the source instead of dropping it', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes; // ids: a, b
  el.links = [...links, { source: 'a', target: 'does-not-exist' }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  await aTimeout(200);

  const linkEls = [...el.shadowRoot!.querySelectorAll('[part="link"]')];
  expect(linkEls).to.have.length(2); // the real a-b link, plus a dangling stub off 'a'
  const stub = linkEls.find((l) => l.hasAttribute('data-dangling'))!;
  expect(stub).to.exist;
  expect(stub.getAttribute('aria-hidden')).to.equal('true');
});

it('keeps a dangling stub synced to its source node across ticks, instead of freezing at its initial position', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes; // ids: a, b
  el.links = [...links, { source: 'a', target: 'does-not-exist' }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const sourceCircle = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find(
    (c) => c.getAttribute('aria-label') === 'A',
  ) as SVGCircleElement;
  const stub = el.shadowRoot!.querySelector('[part="link"][data-dangling]') as SVGLineElement;

  await aTimeout(50);
  const firstSourceX = sourceCircle.getAttribute('cx');
  expect(stub.getAttribute('x1')).to.equal(firstSourceX);
  expect(stub.getAttribute('y1')).to.equal(sourceCircle.getAttribute('cy'));

  await aTimeout(200); // let the settle continue moving the source node
  const laterSourceX = sourceCircle.getAttribute('cx');
  expect(laterSourceX, 'sanity check: the source node keeps moving while the simulation settles').to.not.equal(
    firstSourceX,
  );
  // Before the fix, onTick() recomputed the stub's synthetic target but never wrote x1/y1/x2/y2
  // to its <line> element, so the stub stayed rendered at its very first tick's position while
  // the source node it hangs off kept animating away from it.
  expect(stub.getAttribute('x1')).to.equal(laterSourceX);
  expect(stub.getAttribute('y1')).to.equal(sourceCircle.getAttribute('cy'));
});

it('silently drops a link whose source id has no matching node, without throwing, and still renders the valid links', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes; // ids: a, b
  el.links = [...links, { source: 'does-not-exist', target: 'b' }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  await aTimeout(200);

  const linkEls = el.shadowRoot!.querySelectorAll('[part="link"]');
  expect(linkEls.length).to.equal(1);
  expect((linkEls[0] as SVGLineElement).getAttribute('aria-label')).to.equal('Link from A to B');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  await expect(el).to.be.accessible();
});

describe('data-list aria-label localization', () => {
  it('defaults the data-list aria-label to the built-in English "Graph data"', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const list = el.shadowRoot!.querySelector('[part="data-list"]') as HTMLElement;
    expect(list.getAttribute('aria-label')).to.equal('Graph data');
  });

  it('localizes the data-list aria-label via .strings (graphDataList)', async () => {
    const el = (await fixture(
      html`<lr-graph .strings=${{ graphDataList: 'Données du graphe' }}></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const list = el.shadowRoot!.querySelector('[part="data-list"]') as HTMLElement;
    expect(list.getAttribute('aria-label')).to.equal('Données du graphe');
  });
});

describe('RTL keyboard navigation', () => {
  // Matches the `forwardKey`/`backwardKey` swap this library's other
  // "physical arrow key drives sequential previous/next" components
  // (lr-tabs, lr-slider, lr-segmented) apply under dir="rtl": the
  // physical ArrowLeft becomes "next" and ArrowRight becomes "previous".
  it('swaps ArrowLeft/ArrowRight roving-tabindex navigation under dir="rtl"', async () => {
    const wrapper = (await fixture(
      html`<div dir="rtl"><lr-graph></lr-graph></div>`,
    )) as HTMLDivElement;
    const el = wrapper.querySelector('lr-graph') as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    const items = () =>
      [
        ...el.shadowRoot!.querySelectorAll('[part="node"]'),
        ...el.shadowRoot!.querySelectorAll('[part="link"]'),
      ] as SVGElement[];

    // ArrowRight is the "backward" physical key under RTL -- from index 0
    // it stays clamped at the first item instead of advancing.
    items()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(items()[0]!.getAttribute('tabindex')).to.equal('0');

    // ArrowLeft is the "forward" physical key under RTL -- advances to the next item.
    items()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    expect(items()[1]!.getAttribute('tabindex')).to.equal('0');

    // ArrowRight then moves back to the previous item.
    items()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(items()[0]!.getAttribute('tabindex')).to.equal('0');
  });
});

describe('dimming (adjacency highlight)', () => {
  async function mountDimmable(): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    return el;
  }

  it('defaults dimmedNodeIds/dimmedLinkIds to empty arrays: no data-dimmed anywhere', async () => {
    const el = await mountDimmable();
    expect(el.dimmedNodeIds).to.deep.equal([]);
    expect(el.dimmedLinkIds).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('[data-dimmed]')).to.be.null;
  });

  it('applies data-dimmed to a matching node, not to an unmatched one', async () => {
    const el = await mountDimmable();
    el.dimmedNodeIds = ['b'];
    await el.updateComplete;
    const [nodeA, nodeB] = [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGElement[];
    expect(nodeA!.hasAttribute('data-dimmed')).to.be.false;
    expect(nodeB!.hasAttribute('data-dimmed')).to.be.true;
  });

  it('is visibly dimmed by default -- no host styling required to see the effect', async () => {
    const el = await mountDimmable();
    el.dimmedNodeIds = ['b'];
    await el.updateComplete;
    const nodeB = el.shadowRoot!.querySelectorAll('[part="node"]')[1] as SVGElement;
    const opacity = Number(getComputedStyle(nodeB).opacity);
    expect(opacity).to.be.greaterThan(0);
    expect(opacity).to.be.lessThan(1);
  });

  it('applies data-dimmed to a matching link via its linkKey (id, else source->target)', async () => {
    const el = await mountDimmable();
    el.dimmedLinkIds = ['a->b'];
    await el.updateComplete;
    const linkEl = el.shadowRoot!.querySelector('[part="link"]:not([data-dangling])') as SVGElement;
    expect(linkEl.hasAttribute('data-dimmed')).to.be.true;
  });

  it('never self-mutates dimmedNodeIds/dimmedLinkIds -- purely controlled, like selectedNodeIds', async () => {
    const el = await mountDimmable();
    el.dimmedNodeIds = ['a'];
    el.dimmedLinkIds = ['a->b'];
    await el.updateComplete;
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.dimmedNodeIds).to.deep.equal(['a']);
    expect(el.dimmedLinkIds).to.deep.equal(['a->b']);
  });

  it('data-dimmed and data-selected can coexist on the same element independently', async () => {
    const el = await mountDimmable();
    el.selectionMode = 'multiple';
    el.selectedNodeIds = ['a'];
    el.dimmedNodeIds = ['a'];
    await el.updateComplete;
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('data-selected')).to.be.true;
    expect(nodeEl.hasAttribute('data-dimmed')).to.be.true;
  });

  it('existing rendering is byte-identical when dimmedNodeIds/dimmedLinkIds are left unset', async () => {
    const el = await mountDimmable();
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('data-dimmed')).to.be.false;
    expect(nodeEl.getAttribute('style') || '').to.not.include('dimmed');
  });

  it('is accessible with dimming applied', async () => {
    const el = await mountDimmable();
    el.dimmedNodeIds = ['a'];
    el.dimmedLinkIds = ['a->b'];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

// ---------------------------------------------------------------------------------------------
// Coverage gap-fill: targeted tests for previously-uncovered lines/
// branches in graph.class.ts and graph-canvas.ts, added without touching production code. Grouped
// by area; each test exercises real, reachable behavior (a genuine event/gesture, or -- matching
// this file's own established convention for private internals, see e.g. the J1 nodeEls-cache
// regression test above -- a direct call to a private helper when there's no reasonable way to
// reach it purely through public DOM events).

describe('coverage: canvas lifecycle (reconnect/disconnect edge cases)', () => {
  it('reconnecting a canvas-mode instance (e.g. a drag-and-drop reparent) re-arms the resize watcher and marks the canvas dirty', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50);
    type Internals = { canvasResizeObserver?: ResizeObserver; canvasScene?: unknown };
    const observerBefore = (el as unknown as Internals).canvasResizeObserver;
    expect(observerBefore).to.exist;

    const otherContainer = document.createElement('div');
    document.body.appendChild(otherContainer);
    otherContainer.appendChild(el); // fires disconnectedCallback then connectedCallback synchronously

    expect((el as unknown as Internals).canvasResizeObserver).to.exist;
    // Re-armed, not merely reused -- watchCanvasResize() always builds a fresh observer.
    expect((el as unknown as Internals).canvasResizeObserver).to.not.equal(observerBefore);
    expect((el as unknown as Internals).canvasScene).to.be.undefined; // markCanvasDirty() cleared the cache

    otherContainer.remove();
  });

  it('removing a canvas-mode instance while a hover is still coalesced (pending rAF) cancels the frame instead of leaking it', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" seed="7" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 30,
      }),
    );
    expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.be.a('number');
    el.remove();
    expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.be.undefined;
    // The canceled frame must never fire and resurrect state on a now-detached instance.
    await aTimeout(50);
  });
});

describe('canvas visibility gating (perf)', () => {
  it('gates canvas redraw behind IntersectionObserver visibility -- no draws while off-screen, catches up once visible again', async () => {
    const io = stubIntersectionObserver();
    try {
      // `seed` converges the settle synchronously (see rebuildSimulation()'s own doc comment) --
      // with no ongoing async tick-driven rAF loop after mount, the draw count from the initial
      // settle is stable by the time the `aTimeout` below returns, with no background-tick race
      // against the off-screen assertion window that follows.
      const el = (await fixture(
        html`<lr-graph renderer="canvas" seed="7" width="200" height="200" style="width:200px;height:200px"></lr-graph>`,
      )) as LyraGraph;
      el.nodes = nodes;
      el.links = links;
      await el.updateComplete;
      await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });

      expect(io.observedTargets).to.include(el);
      const latest = io.instances[io.instances.length - 1];

      type Internals = { drawCanvas(): void; markCanvasDirty(): void };
      const internals = el as unknown as Internals;
      const originalDraw = internals.drawCanvas.bind(internals);
      let drawCalls = 0;
      internals.drawCanvas = () => {
        drawCalls++;
        originalDraw();
      };
      await aTimeout(50); // let the settle's single deferred draw fire and its rAF resolve
      drawCalls = 0;

      // Report off-screen, then request a redraw the way a drag/resize would.
      latest.callback(
        [{ isIntersecting: false } as unknown as IntersectionObserverEntry],
        latest as unknown as IntersectionObserver,
      );
      internals.markCanvasDirty();
      await aTimeout(100); // several animation frames' worth of headroom
      expect(drawCalls, 'no redraw should happen while off-screen').to.equal(0);

      // Report back on-screen -- the deferred draw request must be honored, not silently dropped.
      latest.callback(
        [{ isIntersecting: true } as unknown as IntersectionObserverEntry],
        latest as unknown as IntersectionObserver,
      );
      await aTimeout(100);
      expect(drawCalls, 'becoming visible again must issue the deferred draw').to.be.greaterThan(0);
    } finally {
      io.restore();
    }
  });

  it('disconnects the IntersectionObserver on disconnectedCallback', async () => {
    const io = stubIntersectionObserver();
    try {
      const el = (await fixture(html`<lr-graph renderer="canvas"></lr-graph>`)) as LyraGraph;
      await el.updateComplete;
      const latest = io.instances[io.instances.length - 1];
      expect(latest.disconnected).to.be.false;
      el.remove();
      expect(latest.disconnected).to.be.true;
    } finally {
      io.restore();
    }
  });

  it('treats an empty IntersectionObserver entries array as visible (entries[0]?.isIntersecting ?? true fallback)', async () => {
    const io = stubIntersectionObserver();
    try {
      const el = (await fixture(html`<lr-graph renderer="canvas"></lr-graph>`)) as LyraGraph;
      await el.updateComplete;
      const latest = io.instances[io.instances.length - 1];
      const internal = el as unknown as { visible: boolean };

      // Force it false first so the `?? true` fallback's result is actually observable as a flip,
      // not indistinguishable from the field's own `true` initial default.
      latest.callback([{ isIntersecting: false } as unknown as IntersectionObserverEntry], latest as unknown as IntersectionObserver);
      expect(internal.visible).to.be.false;

      // A real IntersectionObserver never invokes its callback with an empty entries array for an
      // observed target, so this can only be exercised by driving the fake observer directly.
      latest.callback([], latest as unknown as IntersectionObserver);
      expect(internal.visible).to.be.true;
    } finally {
      io.restore();
    }
  });
});

describe('lifecycle: super calls', () => {
  it('calls super.willUpdate()/super.updated() so a future shared mixin layered under LyraElement keeps running', async () => {
    // Neither LyraElement nor LitElement override willUpdate/updated today (both are true no-ops
    // on ReactiveElement.prototype), so this can only be proven by spying on the inherited method
    // itself and confirming lr-graph's own override still reaches it via `super.<method>()` --
    // mirrors csv-viewer/docx-viewer/pdf-viewer's identical super.willUpdate() call reaching
    // DocumentAnchorTarget's mixin logic.
    const proto = Object.getPrototypeOf(LyraGraph.prototype) as {
      willUpdate?: (changed: unknown) => void;
      updated?: (changed: unknown) => void;
    };
    const hadOwnWillUpdate = Object.prototype.hasOwnProperty.call(proto, 'willUpdate');
    const hadOwnUpdated = Object.prototype.hasOwnProperty.call(proto, 'updated');
    const originalWillUpdate = proto.willUpdate;
    const originalUpdated = proto.updated;
    let willUpdateCalls = 0;
    let updatedCalls = 0;
    proto.willUpdate = function (this: unknown, changed: unknown) {
      willUpdateCalls++;
      originalWillUpdate?.call(this, changed);
    };
    proto.updated = function (this: unknown, changed: unknown) {
      updatedCalls++;
      originalUpdated?.call(this, changed);
    };
    try {
      const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
      await el.updateComplete;
      expect(willUpdateCalls).to.be.greaterThan(0);
      expect(updatedCalls).to.be.greaterThan(0);
    } finally {
      if (hadOwnWillUpdate) proto.willUpdate = originalWillUpdate;
      else delete proto.willUpdate;
      if (hadOwnUpdated) proto.updated = originalUpdated;
      else delete proto.updated;
    }
  });
});

describe('coverage: private-helper direct branches', () => {
  it('falls back nodeRadius to the clamped default average when radius is non-finite (NaN)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A', radius: Number.NaN }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const r = Number((el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement).getAttribute('r'));
    expect(r).to.be.at.least(6);
    expect(r).to.be.at.most(24);
  });

  it('tweenCamera resolves false without animating when d3/zoomedEl/zoomBehavior are unavailable', async () => {
    // A fresh, never-connected element: this.d3 is still undefined, so tweenCamera()'s own internal
    // guard (the same shape as focusNode()/fit()'s public-facing guards, but exercised directly here
    // since both public callers already gate on the identical condition before ever reaching it).
    const el = document.createElement('lr-graph') as LyraGraph;
    const resolved = await (el as unknown as { tweenCamera: (fn: () => unknown) => Promise<boolean> }).tweenCamera(
      () => ({ k: 1, x: 0, y: 0 }),
    );
    expect(resolved).to.be.false;
  });

  it('linkKey/linkAccessibleText/onLinkClick fall back to String(source/target) for a raw (unresolved) id pair', async () => {
    // Every SimLink this component itself ever constructs (resolveLinksAgainst()) has object
    // source/target -- but the type (SimulationLinkDatum<SimNode>) also allows a bare string id, and
    // these methods' own typeof branch handles it. Exercised directly since there's no public path
    // that ever hands them anything but an already-resolved SimLink.
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const raw = { source: 'raw-a', target: 'raw-b' };
    const key = (el as unknown as { linkKey: (l: unknown) => string }).linkKey(raw);
    expect(key).to.equal('raw-a->raw-b');
    const text = (el as unknown as { linkAccessibleText: (l: unknown) => string }).linkAccessibleText(raw);
    expect(text).to.equal('Link from raw-a to raw-b');

    let detail: { source: string; target: string } | undefined;
    el.addEventListener('lr-link-click', (e) => (detail = (e as CustomEvent).detail));
    (el as unknown as { onLinkClick: (l: unknown) => void }).onLinkClick(raw);
    expect(detail).to.deep.equal({ source: 'raw-a', target: 'raw-b' });
  });

  it('onLinkEnter/onLinkLeave resolve raw string source/target ids the same way', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const raw = { source: 'raw-a', target: 'raw-b' };
    const fakeEl = document.createElement('div');

    let enterDetail: { source: string; target: string } | undefined;
    el.addEventListener('lr-link-enter', (e) => (enterDetail = (e as CustomEvent).detail));
    (el as unknown as { onLinkEnter: (l: unknown, e: unknown) => void }).onLinkEnter(raw, { currentTarget: fakeEl });
    expect(enterDetail).to.deep.equal({ source: 'raw-a', target: 'raw-b' });
    expect(fakeEl.hasAttribute('data-hovered')).to.be.true;

    let leaveDetail: { source: string; target: string } | undefined;
    el.addEventListener('lr-link-leave', (e) => (leaveDetail = (e as CustomEvent).detail));
    (el as unknown as { onLinkLeave: (l: unknown, e: unknown) => void }).onLinkLeave(raw, { currentTarget: fakeEl });
    expect(leaveDetail).to.deep.equal({ source: 'raw-a', target: 'raw-b' });
    expect(fakeEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('linkCoordinates/edgeLabelPosition handle a zero-length link (coincident source/target) without dividing by zero', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const coincident = { source: { x: 5, y: 5 }, target: { x: 5, y: 5 }, directed: true };
    const coords = (
      el as unknown as { linkCoordinates: (l: unknown) => { x1: number; y1: number; x2: number; y2: number } }
    ).linkCoordinates(coincident);
    expect(coords).to.deep.equal({ x1: 5, y1: 5, x2: 5, y2: 5 });

    const pos = (el as unknown as { edgeLabelPosition: (l: unknown) => { x: number; y: number } }).edgeLabelPosition(
      coincident,
    );
    expect(pos).to.deep.equal({ x: 5, y: 5 });
  });

  it('evicts the oldest edgeLabelWidth cache entry once EDGE_LABEL_WIDTH_CACHE_MAX distinct labels have been measured', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const measure = (el as unknown as { edgeLabelWidth: (t: string) => number }).edgeLabelWidth.bind(el);
    const cache = (el as unknown as { edgeLabelWidthCache: Map<string, number> }).edgeLabelWidthCache;
    for (let i = 0; i < 513; i++) measure(`label-${i}`);
    expect(cache.size).to.equal(512);
    expect(cache.has('label-0')).to.be.false; // oldest evicted
    expect(cache.has('label-512')).to.be.true;
  });

  it('edgeLabelFontPx resolves px, rem, and em tokens against their live font sizes', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const fontPx = (el as unknown as { edgeLabelFontPx: () => number }).edgeLabelFontPx.bind(el);
    el.style.setProperty('--lr-font-size-2xs', '12px');
    expect(fontPx()).to.equal(12);
    const previousRootFontSize = document.documentElement.style.fontSize;
    const previousOwnFontSize = el.style.fontSize;
    try {
      document.documentElement.style.fontSize = '20px';
      el.style.setProperty('--lr-font-size-2xs', '0.5rem');
      expect(fontPx()).to.equal(10);
      el.style.fontSize = '24px';
      el.style.setProperty('--lr-font-size-2xs', '0.5em');
      expect(fontPx()).to.equal(12);
    } finally {
      document.documentElement.style.fontSize = previousRootFontSize;
      el.style.fontSize = previousOwnFontSize;
    }
    el.style.setProperty('--lr-font-size-2xs', 'not-a-number');
    expect(fontPx()).to.equal(10);
  });

  it('graphItemText returns an empty string for an out-of-range index (past every node/link/hull)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const text = (el as unknown as { graphItemText: (i: number) => string }).graphItemText(999);
    expect(text).to.equal('');
  });

  it('onGraphItemFocus/focusGraphItem no-op when graphItemCount() is 0 (every node hidden)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'x', label: 'X' }];
    el.hiddenTypes = ['x'];
    el.nodes = [{ id: 'a', label: 'A', type: 'x' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 0, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    type Internals = {
      activeGraphItem: number;
      onGraphItemFocus: (i: number) => void;
      focusGraphItem: (i: number) => void;
      onGraphKeyDown: (e: KeyboardEvent, i: number, activate: (e: KeyboardEvent) => void) => void;
    };
    (el as unknown as Internals).activeGraphItem = 5; // sentinel to detect "left unchanged"
    (el as unknown as Internals).onGraphItemFocus(0);
    expect((el as unknown as Internals).activeGraphItem).to.equal(5);
    (el as unknown as Internals).focusGraphItem(0);
    expect((el as unknown as Internals).activeGraphItem).to.equal(5);

    let fired = false;
    (el as unknown as Internals).onGraphKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }), 0, () => (fired = true));
    expect(fired).to.be.false;
  });

  it('an unhandled key on a node/link falls through onGraphKeyDown without moving the roving tab stop', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await el.updateComplete;
    expect(nodeEl.getAttribute('tabindex')).to.equal('0'); // unchanged -- no branch matched, so onGraphKeyDown just returns
  });

  it('updateEdgeLabelZoomGate no-ops when gEl is unset (canvas mode has no bound <g>)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    expect(() =>
      (el as unknown as { updateEdgeLabelZoomGate: (k: number) => void }).updateEdgeLabelZoomGate(5),
    ).to.not.throw();
  });

  it('graphItemText returns an empty string for a negative index (simNodes[-1] is undefined despite -1 < simNodes.length)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const text = (el as unknown as { graphItemText: (i: number) => string }).graphItemText(-1);
    expect(text).to.equal('');
  });

  it('graphItemText returns an empty string for a fractional index landing past simNodes but short of simLinks.length', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    // simNodes.length === 2, simLinks.length === 1 -- index 2.5 skips the node branch (2.5 is not
    // < 2) but its linkIndex (0.5) is still < simLinks.length(1), so `this.simLinks[0.5]` (a
    // non-integer array index, always undefined) is what's actually exercised here.
    const text = (el as unknown as { graphItemText: (i: number) => string }).graphItemText(2.5);
    expect(text).to.equal('');
  });

  it('onNodeClick emits a fallback (0,0) position for a node with no settled x/y yet', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    let detail: { id: string; x: number; y: number } | undefined;
    el.addEventListener('lr-node-click', (e) => (detail = (e as CustomEvent).detail));
    (el as unknown as { onNodeClick: (n: { id: string }) => void }).onNodeClick({ id: 'unsettled' });
    expect(detail).to.deep.equal({ id: 'unsettled', x: 0, y: 0 });
  });

  it('applyInteractions skips (re)binding a stale node element with no matching simNodes entry (data shrinking ahead of a re-render)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    type Internals = {
      simNodes: { id: string }[];
      boundNodeEls: WeakSet<Element>;
      applyInteractions: (changed: Map<string, unknown>) => void;
    };
    const internal = el as unknown as Internals;
    const fullSimNodes = internal.simNodes;
    // Reset first, the same way rebuildSimulation() itself does, then spy on `.add` to count how
    // many of the 3 already-rendered elements actually get (re)bound.
    internal.boundNodeEls = new WeakSet();
    const originalAdd = internal.boundNodeEls.add.bind(internal.boundNodeEls);
    let addCalls = 0;
    internal.boundNodeEls.add = (value: Element) => {
      addCalls++;
      return originalAdd(value);
    };
    try {
      // The DOM still has 3 <circle> elements (this direct assignment bypasses Lit's own
      // re-render) while `simNodes` has been shrunk to 1 -- the exact "data shrinking below an
      // index" scenario applyInteractions()'s `if (!n) return;` guards against.
      internal.simNodes = fullSimNodes.slice(0, 1);
      internal.applyInteractions(new Map([['simNodes', fullSimNodes]]));
      expect(addCalls).to.equal(1);
    } finally {
      internal.simNodes = fullSimNodes;
      delete (internal.boundNodeEls as unknown as { add?: unknown }).add;
    }
  });

  it('rebuildSimulation defaults a neighbor-jitter spawn anchor\'s missing y to 0 (x is guarded by the search predicate, y is not)', async () => {
    const el = (await fixture(html`<lr-graph link-distance="100"></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'existing', label: 'Existing' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    // Corrupt the settled neighbor's y (keep x) -- the neighbor-jitter spawn path for a brand-new
    // linked node only guards `neighbor.x ?? 0` from a genuinely undefined x, which is structurally
    // impossible here (the search predicate that finds `neighbor` already requires `x != null`);
    // `neighbor.y` has no equivalent guarantee, so corrupting only y is the one way to exercise its
    // `?? 0` twin.
    const existing = el.simNodes.find((n) => n.id === 'existing')!;
    existing.y = undefined;

    el.nodes = [
      { id: 'existing', label: 'Existing' },
      { id: 'newbie', label: 'Newbie' },
    ];
    el.links = [{ source: 'existing', target: 'newbie' }];
    await el.updateComplete;

    const newbie = el.simNodes.find((n) => n.id === 'newbie')!;
    expect(Number.isFinite(newbie.y)).to.be.true;
  });

  it("onTick/linkCoordinates/updateFocusHalo default a node's still-undefined x/y to 0 (seeded settle, then corrupted mid-flight state)", async () => {
    const el = (await fixture(html`<lr-graph seed="7" focus-id="a"></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'sq', label: 'Square', shape: 'square' }];
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', type: 'sq' },
    ];
    el.links = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'ghost' }, // dangling -- "ghost" has no matching node
    ];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    // `seed` converges the settle synchronously and stops the simulation (see this file's own
    // "gates canvas redraw..." precedent comment) -- corrupting positions here is safe from a real
    // background tick racing in and overwriting them before the manual onTick() call below runs.
    const nodeA = el.simNodes.find((n) => n.id === 'a')!;
    const nodeB = el.simNodes.find((n) => n.id === 'b')!;
    nodeA.x = undefined;
    nodeA.y = undefined;
    nodeB.x = undefined;
    nodeB.y = undefined;
    (el as unknown as { onTick: () => void }).onTick();

    const circleA = el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement;
    expect(circleA.getAttribute('cx')).to.equal('0');
    expect(circleA.getAttribute('cy')).to.equal('0');

    const nodeEls = Array.from(el.shadowRoot!.querySelectorAll('[part="node"]'));
    const pathB = nodeEls[1] as SVGPathElement; // shape="square" renders <path>, positioned via transform
    expect(pathB.getAttribute('transform')).to.equal('translate(0,0)');

    const labelA = el.shadowRoot!.querySelector('[part="label"]') as SVGTextElement;
    const radiusA = (el as unknown as { nodeRadius: (n: unknown) => number }).nodeRadius(nodeA);
    expect(labelA.getAttribute('x')).to.equal(String(radiusA + 2));
    expect(labelA.getAttribute('y')).to.equal('0');

    const realLink = el.shadowRoot!.querySelector('[part="link"]:not([data-dangling])') as SVGLineElement;
    expect(realLink.getAttribute('x1')).to.equal('0');
    expect(realLink.getAttribute('y1')).to.equal('0');
    expect(realLink.getAttribute('x2')).to.equal('0');
    expect(realLink.getAttribute('y2')).to.equal('0');

    const danglingLine = el.shadowRoot!.querySelector('[part="link"][data-dangling]') as SVGLineElement;
    expect(danglingLine.getAttribute('x1')).to.equal('0');
    expect(danglingLine.getAttribute('y1')).to.equal('0');
    expect(danglingLine.getAttribute('x2')).to.equal('14'); // source.x??0 (0) + STUB_OFFSET_PX (14)
    expect(danglingLine.getAttribute('y2')).to.equal('14');

    const halo = el.shadowRoot!.querySelector('[part="focus-halo"]') as SVGCircleElement;
    expect(halo.getAttribute('cx')).to.equal('0');
    expect(halo.getAttribute('cy')).to.equal('0');
  });
});

describe('coverage: canvas renderer internals', () => {
  it('re-arms the DPR watcher and marks the canvas dirty when the devicePixelRatio media query changes', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    // Stop the simulation before observing canvasScene: onTick() unconditionally nulls it on every
    // tick (markCanvasDirty()) while the coalesced redraw only fires once per real frame, so under a
    // heavily loaded test run canvasScene is falsy far more often than not while ticking -- polling
    // for it without first stopping the ticking is a race the assertion can lose even with a long
    // timeout. Every other test in this describe block that inspects canvasScene follows the same
    // pattern.
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasDprQuery?: MediaQueryList; canvasScene?: unknown };
    await waitUntil(() => !!(el as unknown as Internals).canvasScene, undefined, { timeout: NODE_COUNT_TIMEOUT });
    const query = (el as unknown as Internals).canvasDprQuery;
    expect(query).to.exist;
    expect((el as unknown as Internals).canvasScene).to.exist;
    query!.dispatchEvent(new Event('change'));
    expect((el as unknown as Internals).canvasScene).to.be.undefined; // markCanvasDirty() cleared it
  });

  it('resolves a var(--x) node/link color to its cascaded value in the canvas scene (categorical fallback + explicit var() link color)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodeTypes = [{ id: 'person', label: 'Person' }]; // no explicit color -> categorical var(--lr-graph-cat-1) fallback
    el.nodes = [
      { id: 'a', label: 'A', type: 'person' },
      { id: 'b', label: 'B' },
    ];
    el.links = [{ source: 'a', target: 'b', color: 'var(--lr-color-danger)' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasScene?: { nodes: { fill: string }[]; links: { color: string }[] } };
    await waitUntil(() => !!(el as unknown as Internals).canvasScene, undefined, { timeout: NODE_COUNT_TIMEOUT });
    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.nodes.length).to.equal(2);
    for (const n of scene.nodes) {
      expect(n.fill).to.not.include('var(');
      expect(n.fill).to.not.equal('');
    }
    expect(scene.links.length).to.equal(1);
    expect(scene.links[0]!.color).to.not.include('var(');
    expect(scene.links[0]!.color).to.not.equal('');
  });

  it('reuses the cached canvas scene on a same-band pan/zoom repaint instead of rebuilding it every frame', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasScene?: unknown };
    await waitUntil(() => !!(el as unknown as Internals).canvasScene, undefined, { timeout: NODE_COUNT_TIMEOUT });
    const sceneBefore = (el as unknown as Internals).canvasScene;
    expect(sceneBefore).to.exist;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // A small in-band zoom (doesn't cross the node-label/edge-label visibility thresholds) triggers
    // markCanvasCameraDirty() -- camera-only, so drawCanvas() reuses the existing scene rather than
    // rebuilding it (see drawCanvas()'s own comment on canvasScene reuse).
    canvas.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -10, clientX: 10, clientY: 10 }),
    );
    await aTimeout(300);
    expect((el as unknown as Internals).canvasScene).to.equal(sceneBefore);
  });

  it('dragging a node in canvas mode live-updates its fx/fy via onCanvasPointerMove, clearing them on release', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    // Stop the simulation and pin a deterministic position (matching this describe block's other
    // pointer-hit-testing tests) so the hit-test target is exact and stable instead of racing a
    // still-ticking layout.
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const target = el.simNodes.find((n) => n.id === 'a')!;
    target.x = 100;
    target.y = 100;
    (el as unknown as { pickDirty: boolean }).pickDirty = true;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const startX = rect.left + target.x;
    const startY = rect.top + target.y;
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: startX, clientY: startY, pointerId: 1 }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: startX + 40, clientY: startY + 20, pointerId: 1 }),
    );
    expect(target.fx).to.be.a('number');
    expect(target.fy).to.be.a('number');
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: startX + 40, clientY: startY + 20, pointerId: 1 }),
    );
    expect(target.fx).to.be.null;
    expect(target.fy).to.be.null;
  });

  it('canvas pointer click resolves a link (not a node) and emits lr-link-click', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.links = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50);
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const b = el.simNodes.find((n) => n.id === 'b')!;
    // Deterministic, well-separated positions so the link midpoint is far from both node circles.
    a.x = 50;
    a.y = 150;
    b.x = 350;
    b.y = 150;
    (el as unknown as { pickDirty: boolean }).pickDirty = true;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { source: string; target: string } | undefined;
    el.addEventListener('lr-link-click', (e) => (detail = (e as CustomEvent).detail));
    const midX = rect.left + 200;
    const midY = rect.top + 150;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: midX, clientY: midY, pointerId: 32 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: midX, clientY: midY, pointerId: 32 }));
    expect(detail).to.deep.equal({ source: 'a', target: 'b' });
  });

  it('canvas pointer click resolves a community hull (not a node/link) and emits lr-community-click', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.communities = [{ id: 'team-1', memberIds: [] }]; // no label -- also exercises the id fallback
    el.nodes = [
      { id: 'a', label: 'A', communityId: 'team-1' },
      { id: 'b', label: 'B', communityId: 'team-1' },
      { id: 'c', label: 'C', communityId: 'team-1' },
    ];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50);
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const [a, b, c] = el.simNodes;
    a!.x = 100;
    a!.y = 100;
    b!.x = 300;
    b!.y = 100;
    c!.x = 200;
    c!.y = 250;
    (el as unknown as { pickDirty: boolean }).pickDirty = true;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { id: string } | undefined;
    el.addEventListener('lr-community-click', (e) => (detail = (e as CustomEvent).detail));
    const cx = rect.left + 200;
    const cy = rect.top + 150; // centroid of the a/b/c triangle, well inside the hull, away from every node
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, pointerId: 33 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy, pointerId: 33 }));
    expect(detail).to.deep.equal({ id: 'team-1' });
  });

  it('pointerleave cancels an in-flight coalesced hover and hides the tooltip (canvas mode)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" seed="7" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 34,
      }),
    );
    // Leave before the coalesced rAF hover has a chance to resolve.
    canvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.be.undefined;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hasAttribute('hidden')).to.be.true;
    await aTimeout(50); // the canceled frame must never fire and re-show it
    expect(tooltip.hasAttribute('hidden')).to.be.true;
  });

  it('nodeAtCanvasPoint finds the nearest node within radius, undefined when nothing is close (dblclick geometric fallback)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" seed="7" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    const nodeAtCanvasPoint = (
      el as unknown as { nodeAtCanvasPoint: (x: number, y: number) => { id: string } | undefined }
    ).nodeAtCanvasPoint.bind(el);
    const found = nodeAtCanvasPoint(rect.left + target.x!, rect.top + target.y!);
    expect(found?.id).to.equal(target.id);
    const miss = nodeAtCanvasPoint(rect.left - 5000, rect.top - 5000);
    expect(miss).to.be.undefined;
  });

  it('canvas mode draws the focus halo in the built scene when focusId resolves', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" focus-id="a" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasScene?: { focusHalo?: { x: number; y: number; r: number } } };
    await waitUntil(() => !!(el as unknown as Internals).canvasScene, undefined, { timeout: NODE_COUNT_TIMEOUT });
    expect((el as unknown as Internals).canvasScene?.focusHalo).to.exist;
  });

  it('canvas mode with zero visible items becomes the tab stop itself, with no keyboard focus ring/halo in the scene', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodeTypes = [{ id: 'x', label: 'X' }];
    el.hiddenTypes = ['x'];
    el.nodes = [{ id: 'a', label: 'A', type: 'x' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasScene?: { keyboardFocusRing?: unknown; focusHalo?: unknown } };
    await waitUntil(() => !!(el as unknown as Internals).canvasScene, undefined, { timeout: NODE_COUNT_TIMEOUT });
    expect(el.simNodes.length).to.equal(0); // sanity: every node is hidden
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.getAttribute('tabindex')).to.equal('0'); // no roving items -- the canvas itself is the tab stop
    // Every node being hidden always produces a "0 of 1"-style hidden-count announcement (see
    // announceHiddenNodeCount()) -- graphLiveText is therefore never empty here, so this doesn't
    // (and can't, through any public API) exercise the live-region's own empty-string fallback.
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('1 of 1 nodes hidden');
    expect((el as unknown as Internals).canvasScene?.keyboardFocusRing).to.be.undefined;
    expect((el as unknown as Internals).canvasScene?.focusHalo).to.be.undefined;
  });

  it('a canvas cursor-item roving sequence can advance from nodes into a link (tabindex true branch for a link cursor-item)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes; // a, b
    el.links = links; // one link a->b
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    const items = () => [...el.shadowRoot!.querySelectorAll('[part="cursor-item"]')] as HTMLButtonElement[];
    items()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    items()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(items()[2]!.getAttribute('tabindex')).to.equal('0'); // the link cursor-item is now active
  });

  it('canvas mode renders one cursor-item per community, driving lr-community-click via click and Enter, with an id fallback when unlabeled', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lr-graph>`,
    )) as LyraGraph;
    el.communities = [{ id: 'team-1', memberIds: [] }]; // no label -> falls back to the id
    el.nodes = [
      { id: 'a', label: 'A', communityId: 'team-1' },
      { id: 'b', label: 'B', communityId: 'team-1' },
    ];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    const items = [...el.shadowRoot!.querySelectorAll('[part="cursor-item"]')] as HTMLButtonElement[];
    expect(items).to.have.length(3); // 2 nodes + 1 hull, no links
    const hullItem = items[2]!;
    expect(hullItem.getAttribute('aria-label')).to.contain('team-1');
    let detail: { id: string } | undefined;
    el.addEventListener('lr-community-click', (e) => (detail = (e as CustomEvent).detail));
    hullItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ id: 'team-1' });
    detail = undefined;
    hullItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({ id: 'team-1' });
  });
});

describe('coverage: selection/drag/hover edge cases', () => {
  it('multiple mode: Ctrl-click toggles a LINK selection too, preserving other selected link ids', async () => {
    const el = (await fixture(html`<lr-graph selection-mode="multiple"></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    el.links = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const linkEls = [...el.shadowRoot!.querySelectorAll('[part="link"]:not([data-dangling])')] as SVGElement[];
    let detail: { nodeIds: string[]; linkIds: string[] } | undefined;
    el.addEventListener('lr-selection-change', (e) => (detail = (e as CustomEvent).detail));

    linkEls[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(detail).to.deep.equal({ nodeIds: [], linkIds: ['a->b'] });

    el.selectedLinkIds = ['a->b'];
    await el.updateComplete;
    linkEls[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(detail).to.deep.equal({ nodeIds: [], linkIds: ['a->b', 'b->c'] });

    el.selectedLinkIds = ['a->b', 'b->c'];
    await el.updateComplete;
    linkEls[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(detail).to.deep.equal({ nodeIds: [], linkIds: ['b->c'] });
  });

  it('dragging a node (svg mode) sets fx/fy live and clears them + isDragging on release (d3-drag start/drag/end)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement;
    const target = el.simNodes.find((n) => n.id === 'a')!;
    nodeEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0, view: window }));
    expect((el as unknown as { isDragging: boolean }).isDragging).to.be.true;
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 40, view: window }));
    expect(target.fx).to.be.a('number');
    expect(target.fy).to.be.a('number');
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window }));
    expect((el as unknown as { isDragging: boolean }).isDragging).to.be.false;
    expect(target.fx).to.be.null;
    expect(target.fy).to.be.null;
  });

  it('suppresses lr-node-leave and leaves data-hovered untouched while panning (mouseleave, mirrors the existing mouseenter suppression tests)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    nodeEl.setAttribute('data-hovered', ''); // as if entered before the pan started
    (el as unknown as { isPanning: boolean }).isPanning = true;
    let fired = false;
    el.addEventListener('lr-node-leave', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(fired).to.be.false;
    expect(nodeEl.hasAttribute('data-hovered')).to.be.true; // untouched -- the guard returned early
  });

  it('an unseeded new node linked to an existing neighbor still spawns near it (Math.random() jitter branch)', async () => {
    const el = (await fixture(html`<lr-graph link-distance="100"></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const before = el.simNodes.find((n) => n.id === 'a')!;
    const aX = before.x!;
    const aY = before.y!;

    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.links = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    const spawnedB = el.simNodes.find((n) => n.id === 'b')!;
    const distance = Math.hypot(spawnedB.x! - aX, spawnedB.y! - aY);
    expect(distance).to.be.lessThan(el.linkDistance);
  });
});

describe('coverage: drawn edge label declutter gate (onTick, real ticks)', () => {
  it('a labelless link with showEdgeLabels on does not throw across a real tick (edgeLabelWidth("") fallback)', async () => {
    const el = (await fixture(html`<lr-graph show-edge-labels></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links; // no .label
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await aTimeout(100); // let at least one real tick run onTick()'s edge-label loop
    expect(el.shadowRoot!.querySelector('[part="link-label"]')).to.not.exist;
  });

  it('hides a drawn edge label once its measured width exceeds the length-declutter gate (visibility toggle)', async () => {
    const el = (await fixture(
      html`<lr-graph show-edge-labels link-distance="10" width="200" height="200"></lr-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = [{ source: 'a', target: 'b', label: 'a very long label that will not fit on a short edge' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await aTimeout(300);
    const label = el.shadowRoot!.querySelector('[part="link-label"]') as SVGTextElement;
    expect(label.getAttribute('visibility')).to.equal('hidden');
  });
});

describe('styling', () => {
  // A real browser :hover pseudo-class can't be forced from a dispatched event (it tracks actual
  // pointer position), so this asserts the stylesheet source the same way this exact remediation
  // series does for its other siblings (e.g. lr-span-waterfall's identical per-item, variable-fill
  // `[part='bar']:hover { filter: brightness(...) }`) rather than a rendered computed-style probe.
  it('gives node/link/hull a hover state alongside their existing :focus-visible rings', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='node'\]:hover[^{]*\{[^}]*filter:\s*brightness/);
    expect(css).to.match(/\[part='link'\]:hover[^{]*\{[^}]*filter:\s*brightness/);
    expect(css).to.match(/\[part='hull'\]:hover[^{]*\{[^}]*filter:\s*brightness/);
  });
});

// Regression coverage for the lifecycle-optional-peer-missing-fails-silently defect class --
// when the optional `d3` peers fail to load, <lr-graph> must fail closed into a visible,
// accessible role="alert" error state instead of leaving a permanently blank surface.
// Mirrors lr-map's identical treatment.
describe('optional d3 peer failure', () => {
  it('renders a visible, accessible error state instead of a blank surface when the d3 peers fail to load', async () => {
    // Deliberately not using fixture(): loadLibrary must be overridden *before* the element ever
    // connects, since connectedCallback() calls it unconditionally on connect.
    const el = document.createElement('lr-graph') as unknown as LyraGraph;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
    el.nodes = nodes;
    el.links = links;
    document.body.appendChild(el);
    try {
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') != null, 'error state never rendered', {
        timeout: 2000,
      });
      const errorEl = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
      expect(errorEl.getAttribute('role')).to.equal('alert');
      expect(errorEl.textContent!.trim().length).to.be.greaterThan(0);
      expect(el.hasAttribute('aria-busy')).to.be.false;
      expect(el.shadowRoot!.querySelectorAll('svg, canvas').length).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(0);
    } finally {
      el.remove();
    }
  });

  it('routes the d3 peer-missing error through a .strings override', async () => {
    const el = document.createElement('lr-graph') as unknown as LyraGraph;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
    (el as unknown as { strings: Record<string, string> }).strings = {
      graphMissingLibrary: 'Bibliothèque de graphe absente',
    };
    el.nodes = nodes;
    document.body.appendChild(el);
    try {
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') != null, 'error state never rendered', {
        timeout: 2000,
      });
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal(
        'Bibliothèque de graphe absente',
      );
    } finally {
      el.remove();
    }
  });
});
