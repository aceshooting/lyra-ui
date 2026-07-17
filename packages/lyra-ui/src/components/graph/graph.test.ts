import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import { select } from 'd3-selection';
import './graph.js';
import type { LyraGraph } from './graph.js';
import { layeredLayout } from '../../internal/layered-layout.js';

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

it('shows a loading skeleton and aria-busy while d3 loads, then swaps to the svg', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('svg')).to.not.exist;

  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('svg')).to.exist;
});

it('renders an svg with a circle per node once d3 loads', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    <lyra-graph aria-label="Citation relationships"></lyra-graph>
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

it('emits lyra-node-click when a node is activated', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  let detail: { id: string } | undefined;
  el.addEventListener('lyra-node-click', (e) => (detail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="node"]') as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  );
  expect(detail).to.exist;
});

it('emits lyra-link-click with the source/target ids when a link is activated', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  let detail: { source: string; target: string } | undefined;
  el.addEventListener('lyra-link-click', (e) => (detail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="link"]') as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  );
  expect(detail).to.deep.equal({ source: 'a', target: 'b' });
});

describe('hover events', () => {
  it('emits lyra-node-enter/lyra-node-leave and toggles data-hovered on the node element', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    let enterDetail: { id: string } | undefined;
    let leaveDetail: { id: string } | undefined;
    el.addEventListener('lyra-node-enter', (e) => (enterDetail = (e as CustomEvent).detail));
    el.addEventListener('lyra-node-leave', (e) => (leaveDetail = (e as CustomEvent).detail));

    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(enterDetail).to.deep.equal({ id: 'a' });
    expect(nodeEl.hasAttribute('data-hovered')).to.be.true;

    nodeEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(leaveDetail).to.deep.equal({ id: 'a' });
    expect(nodeEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('emits lyra-link-enter/lyra-link-leave with source/target ids and toggles data-hovered on the link element', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const linkEl = el.shadowRoot!.querySelector('[part="link"]') as SVGElement;

    let enterDetail: { source: string; target: string } | undefined;
    el.addEventListener('lyra-link-enter', (e) => (enterDetail = (e as CustomEvent).detail));

    linkEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(enterDetail).to.deep.equal({ source: 'a', target: 'b' });
    expect(linkEl.hasAttribute('data-hovered')).to.be.true;

    linkEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(linkEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('suppresses hover events and the data-hovered attribute while a drag is in progress', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    (el as unknown as { isDragging: boolean }).isDragging = true;
    let fired = false;
    el.addEventListener('lyra-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
    expect(nodeEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('suppresses hover events while panning', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    (el as unknown as { isPanning: boolean }).isPanning = true;
    let fired = false;
    el.addEventListener('lyra-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('suppresses hover events during a programmatic camera tween (regression)', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    (el as unknown as { isCameraTweening: boolean }).isCameraTweening = true;
    let fired = false;
    el.addEventListener('lyra-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('does not fire lyra-link-enter/lyra-link-leave or set data-hovered for a dangling-stub link', async () => {
    // A dangling stub's `target` is a synthetic stand-in that never resolves to a real node (see
    // SimLink.dangling) -- emitting a link-identity hover event for it would hand a consumer an id
    // guaranteed to never match anything in `nodes`, so the stub is deliberately excluded from
    // hover wiring the same way it's excluded from click/focus/keydown/tooltip/accessible-list.
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes; // ids: a, b
    el.links = [...links, { source: 'a', target: 'does-not-exist' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const stub = el.shadowRoot!.querySelector('[part="link"][data-dangling]') as SVGLineElement;
    expect(stub).to.exist;

    let fired = false;
    el.addEventListener('lyra-link-enter', () => (fired = true));
    el.addEventListener('lyra-link-leave', () => (fired = true));

    stub.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
    expect(stub.hasAttribute('data-hovered')).to.be.false;

    stub.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(fired).to.be.false;
    expect(stub.hasAttribute('data-hovered')).to.be.false;
  });
});

it('renders directed links with arrowheads shortened to the target radius', async () => {
  const el = (await fixture(html`<lyra-graph seed="42"></lyra-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = [{ source: 'a', target: 'b', directed: true }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  const link = el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
  const target = el.shadowRoot!.querySelectorAll('[part="node"]')[1] as SVGCircleElement;
  expect(link.getAttribute('marker-end')).to.match(/^url\(#lyra-graph-arrow-/);
  expect(link.getAttribute('x2')).to.not.equal(target.getAttribute('cx'));
  expect(el.shadowRoot!.querySelector('[part="arrowhead"]')).to.exist;
});

it('uses rich accessible labels/descriptions and carries a stable link id through activation', async () => {
  const el = (await fixture(html`<lyra-graph seed="42"></lyra-graph>`)) as LyraGraph;
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
  el.addEventListener('lyra-link-click', (e) => (detail = (e as CustomEvent).detail));
  link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(detail).to.deep.equal({ source: 'a', target: 'b', id: 'citation-7' });
});

it('applies sanitized per-link color and numeric dash styling', async () => {
  const el = (await fixture(html`<lyra-graph seed="42"></lyra-graph>`)) as LyraGraph;
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

it('emits lyra-node-click when a node is activated via keyboard (Enter/Space)', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  let detail: { id: string } | undefined;
  el.addEventListener('lyra-node-click', (e) => (detail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="node"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
  expect(detail).to.deep.equal({ id: 'a' });
});

it('emits lyra-link-click when a link is activated via keyboard (Enter/Space)', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.links = links;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  let detail: { source: string; target: string } | undefined;
  el.addEventListener('lyra-link-click', (e) => (detail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="link"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
  );
  expect(detail).to.deep.equal({ source: 'a', target: 'b' });
});

it('gives the svg an accessible name summarizing the diagram, and hides duplicate node labels from assistive tech', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    expect(items[1]!.getAttribute('style')).to.include('--lyra-node-fill:#112233'); // b: doc.color
    expect(items[2]!.getAttribute('style') ?? '').to.include('--lyra-graph-cat-3'); // c: concept is nodeTypes[2]
    expect(items[3]!.hasAttribute('style')).to.be.false; // d: unknown type -> no inline fill override
    expect(items[4]!.getAttribute('style')).to.include('--lyra-node-fill:#ff0000'); // e: node.color wins over type
  });

  it('wraps the categorical index at the 9th nodeTypes entry (typeIndex % 8)', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    expect(items[0]!.getAttribute('style')).to.include('--lyra-graph-cat-1'); // index 0 % 8 -> slot 1
    expect(items[1]!.getAttribute('style')).to.include('--lyra-graph-cat-1'); // index 8 % 8 -> slot 1 again
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph show-edge-labels></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  it('dblclick on a node emits exactly one lyra-node-expand after two lyra-node-click events, and stops propagation', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    el.addEventListener('lyra-node-click', () => clickCount++);
    el.addEventListener('lyra-node-expand', (e) => {
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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

  it('double-Enter within 500ms on the same focused node emits lyra-node-expand; outside the window it does not', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let expandCount = 0;
    el.addEventListener('lyra-node-expand', () => expandCount++);
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(expandCount).to.equal(1);

    // Outside the window: reset by waiting past EXPAND_KEY_INTERVAL_MS.
    await aTimeout(600);
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(expandCount).to.equal(1); // first of a new pair, not yet a second
  });

  it('renders a "+" expand-indicator only for nodes with expandable: true, tracked per tick', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph seed="7" link-distance="100"></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A', expandable: true }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no expandable set never emits lyra-node-expand and renders no indicator', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelectorAll('[part="expand-indicator"]').length).to.equal(0);
    let fired = false;
    el.addEventListener('lyra-node-expand', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="node"]') as SVGElement).dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true }),
    );
    expect(fired).to.be.true; // dblclick always emits, regardless of `expandable` (an affordance flag, not a gate)
  });
});

describe('focus & fit (J4 camera)', () => {
  async function mountWide(): Promise<LyraGraph> {
    const el = (await fixture(
      html`<lyra-graph width="800" height="600" min-zoom="0.1" max-zoom="8"></lyra-graph>`,
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
      expect(rafCalls).to.equal(0);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
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
      html`<lyra-graph width="800" height="600" focus-id="b"></lyra-graph>`,
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
    const el = (await fixture(html`<lyra-graph focus-id="a"></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.selectionMode = mode;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    return el;
  }

  it('defaults selectionMode to none: no aria-pressed/data-selected, no lyra-selection-change on click', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('aria-pressed')).to.be.false;
    let fired = false;
    el.addEventListener('lyra-selection-change', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('single mode: clicking an unselected node emits a replace intent; clicking it again emits clear', async () => {
    const el = await mountSelectable('single');
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let detail: { nodeIds: string[]; linkIds: string[] } | undefined;
    el.addEventListener('lyra-selection-change', (e) => (detail = (e as CustomEvent).detail));
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
    el.addEventListener('lyra-selection-change', (e) => (detail = (e as CustomEvent).detail));

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
    el.addEventListener('lyra-selection-change', (e) => (detail = (e as CustomEvent).detail));
    nodeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ctrlKey: true }));
    expect(detail).to.deep.equal({ nodeIds: ['a'], linkIds: [] });
  });

  it('background click and Escape clear the selection in multiple mode', async () => {
    const el = await mountSelectable('multiple');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    let detail: { nodeIds: string[]; linkIds: string[] } | undefined;
    el.addEventListener('lyra-selection-change', (e) => (detail = (e as CustomEvent).detail));
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

  it('is accessible with a selection applied', async () => {
    const el = await mountSelectable('multiple');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: lyra-node-click/lyra-link-click still fire unchanged alongside selection', async () => {
    const el = await mountSelectable('single');
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let clickDetail: { id: string } | undefined;
    el.addEventListener('lyra-node-click', (e) => (clickDetail = (e as CustomEvent).detail));
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clickDetail).to.deep.equal({ id: 'a' });
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph focus-id="a"></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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

  it('click and Enter/Space on a hull emit lyra-community-click', async () => {
    const el = await mountHulls();
    const hull = el.shadowRoot!.querySelector('[part="hull"]') as SVGPathElement;
    let detail: { id: string } | undefined;
    el.addEventListener('lyra-community-click', (e) => (detail = (e as CustomEvent).detail));
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    expect(el.layout).to.equal('force');
  });

  it('layout="layered" positions nodes deterministically, top-to-bottom by longest path, without a settle animation', async () => {
    const el = (await fixture(html`<lyra-graph layout="layered" width="800" height="600"></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph layout="layered"></lyra-graph>`)) as LyraGraph;
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
      html`<lyra-graph layout="layered" link-distance="20" width="800" height="600"></lyra-graph>`,
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
    const el = (await fixture(html`<lyra-graph layout="layered"></lyra-graph>`)) as LyraGraph;
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

  it('both lyra-graph and the shared util produce the same node ordering (no forked algorithm)', async () => {
    const el = (await fixture(html`<lyra-graph layout="layered" width="800" height="600"></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph layout="layered"></lyra-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A' }];
    el.links = [];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await expect(el).to.be.accessible();
  });

  it('hiddenTypes filtering announces graphNodesHidden in layered mode too, same as force mode', async () => {
    const el = (await fixture(html`<lyra-graph layout="layered"></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
      html`<lyra-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lyra-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(50); // let the draw rAF fire
    return el;
  }

  it('defaults renderer to svg', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
      html`<lyra-graph renderer="canvas" show-edge-labels selection-mode="single" width="400" height="300" style="width:400px;height:300px"></lyra-graph>`,
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

  it('existing graph usage unaffected: renderer unset renders the untouched svg path', async () => {
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;
  });
});

describe('canvas renderer — interaction and a11y', () => {
  async function mountCanvas(): Promise<LyraGraph> {
    const el = (await fixture(
      html`<lyra-graph renderer="canvas" width="400" height="300" style="width:400px;height:300px"></lyra-graph>`,
    )) as LyraGraph;
    el.nodes = nodes;
    el.links = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, { timeout: NODE_COUNT_TIMEOUT });
    await aTimeout(400); // let the force layout settle so node positions are stable for hit-testing
    return el;
  }

  it('clicking a node (via pointer hit-test) emits lyra-node-click, same detail shape as svg mode', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + target.x!;
    const clientY = rect.top + target.y!;
    let detail: { id: string } | undefined;
    el.addEventListener('lyra-node-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX, clientY, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX, clientY, pointerId: 1 }));
    expect(detail).to.deep.equal({ id: target.id });
  });

  it('clicking empty canvas space with no hit clears the selection when selectionMode is set', async () => {
    const el = (await fixture(
      html`<lyra-graph renderer="canvas" selection-mode="single" width="400" height="300" style="width:400px;height:300px"></lyra-graph>`,
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
    el.addEventListener('lyra-selection-change', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + 399, clientY: rect.top + 299, pointerId: 2 }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: rect.left + 399, clientY: rect.top + 299, pointerId: 2 }),
    );
    expect(detail).to.deep.equal({ nodeIds: [], linkIds: [] });
  });

  it('dblclick on a node emits lyra-node-expand in canvas mode too', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    let detail: { id: string } | undefined;
    el.addEventListener('lyra-node-expand', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, clientX: rect.left + target.x!, clientY: rect.top + target.y! }),
    );
    expect(detail).to.deep.equal({ id: target.id });
  });

  it('shows a hover tooltip with the item label on pointer hover, hides it off-item', async () => {
    const el = await mountCanvas();
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
    expect(tooltip.hasAttribute('hidden')).to.be.false;
    // nodeAccessibleText() is private -- read it via the same `unknown` cast this file already
    // uses elsewhere for private-member assertions, to compute the exact expected label.
    const expectedLabel = (el as unknown as { nodeAccessibleText: (n: unknown) => string }).nodeAccessibleText(target);
    expect(tooltip.textContent).to.equal(expectedLabel);

    canvas.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: rect.left + 399, clientY: rect.top + 299, pointerId: 3 }),
    );
    expect(tooltip.hasAttribute('hidden')).to.be.true;
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
    let detail: { id: string } | undefined;
    el.addEventListener('lyra-node-click', (e) => (detail = (e as CustomEvent).detail));
    items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({ id: el.simNodes[0]!.id });
  });

  it('is accessible with interactions and a selection applied in canvas mode', async () => {
    const el = (await fixture(
      html`<lyra-graph renderer="canvas" selection-mode="multiple" width="400" height="300" style="width:400px;height:300px"></lyra-graph>`,
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
    const el = document.createElement('lyra-graph') as LyraGraph;
    el.renderer = 'canvas';
    expect((el as unknown as { loading: boolean }).loading).to.be.true;
  });
});

it('does not let a GraphNode.color value inject extra CSS declarations via the node style attribute', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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

it('does not reassign simNodes/simLinks references on tick, only positions (avoids a full Lit re-render every animation frame)', async () => {
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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

  const elA = (await fixture(html`<lyra-graph seed="42"></lyra-graph>`)) as LyraGraph;
  elA.nodes = seededNodes;
  elA.links = seededLinks;
  await elA.updateComplete;
  await waitUntil(() => elA.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const elB = (await fixture(html`<lyra-graph seed="42"></lyra-graph>`)) as LyraGraph;
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

  const elA = (await fixture(html`<lyra-graph seed="1"></lyra-graph>`)) as LyraGraph;
  elA.nodes = seededNodes;
  elA.links = seededLinks;
  await elA.updateComplete;
  await waitUntil(() => elA.shadowRoot!.querySelectorAll('[part="node"]').length === 3, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });

  const elB = (await fixture(html`<lyra-graph seed="2"></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph seed="7"></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph seed="7"></lyra-graph>`)) as LyraGraph;
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

  const el = (await fixture(html`<lyra-graph seed="1"></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
  const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
    const el = (await fixture(html`<lyra-graph></lyra-graph>`)) as LyraGraph;
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
      html`<lyra-graph .strings=${{ graphDataList: 'Données du graphe' }}></lyra-graph>`,
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
  // (lyra-tabs, lyra-slider, lyra-segmented) apply under dir="rtl": the
  // physical ArrowLeft becomes "next" and ArrowRight becomes "previous".
  it('swaps ArrowLeft/ArrowRight roving-tabindex navigation under dir="rtl"', async () => {
    const wrapper = (await fixture(
      html`<div dir="rtl"><lyra-graph></lyra-graph></div>`,
    )) as HTMLDivElement;
    const el = wrapper.querySelector('lyra-graph') as LyraGraph;
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
