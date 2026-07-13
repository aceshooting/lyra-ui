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
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('2 of 3');

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
  // Force-directed layout has no fixed left-right reading order (node
  // position comes from the d3-force physics simulation, not array/DOM
  // order), and ArrowRight/ArrowDown already mean the same thing here
  // ("next" in flat nodes-then-links order, same as ArrowLeft/ArrowUp both
  // meaning "previous") -- unlike this library's grid/track-based components
  // (date-grid, resize handles) there is no physical left/right for RTL to
  // mirror, so ArrowLeft/ArrowRight must stay un-swapped under dir="rtl".
  it('does not swap ArrowLeft/ArrowRight roving-tabindex navigation under dir="rtl"', async () => {
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

    items()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(items()[1]!.getAttribute('tabindex')).to.equal('0');

    items()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    expect(items()[0]!.getAttribute('tabindex')).to.equal('0');
  });
});
