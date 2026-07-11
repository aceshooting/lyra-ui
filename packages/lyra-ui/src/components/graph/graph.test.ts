import { fixture, expect, html, waitUntil } from '@open-wc/testing';
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
