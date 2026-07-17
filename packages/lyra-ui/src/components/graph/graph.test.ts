import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import { select } from 'd3-selection';
import './graph.js';
import type { LyraGraph } from './graph.js';

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
