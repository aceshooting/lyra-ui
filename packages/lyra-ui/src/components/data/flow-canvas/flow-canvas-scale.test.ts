import { expect, fixture, html } from '@open-wc/testing';
import './flow-canvas.js';
import type { LyraFlowCanvas, FlowNode } from './flow-canvas.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

interface Work {
  nodeAccessibleText(node: FlowNode): string;
  resolvedNode(node: FlowNode): unknown;
  activeItemIndex: number;
  measuredSizes: Map<string, unknown>;
  nodeSize(id: string): { width: number; height: number };
  buildSnapshot(): unknown;
  connectState?: { sourceId: string };
  isInvalidConnectTarget(id: string): boolean;
}
async function mount(): Promise<LyraFlowCanvas> {
  const nodes = Array.from({ length: 1000 }, (_, i) => ({ id: `n${i}`, position: { x: i * 1000, y: 0 } }));
  const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px" .nodes=${nodes}></lr-flow-canvas>`);
  await canvas.updateComplete;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  canvas.setViewport({ x: 0, y: 0, zoom: 1 });
  await canvas.updateComplete;
  return canvas;
}

describe('flow canvas measured work', function () {
  this.timeout(60000);
  it('culls offscreen cards at n=1000 while retaining the active node', async () => {
    const canvas = await mount();
    const count = canvas.shadowRoot!.querySelectorAll('[part="node"]').length;
    recordScaleMeasurement('lr-flow-canvas', 'n=1000 offscreen node cards', { rendered: count, retained: canvas.nodes.length });
    expect(count).to.be.lessThan(10);
    expect(canvas.shadowRoot!.querySelector('[data-node-id="n0"]') !== null).to.equal(true);
  });

  it('moves the cursor without rebuilding the model or other node templates at n=1000', async () => {
    const canvas = await mount();
    const work = canvas as unknown as Work;
    const text = countCalls(work, 'nodeAccessibleText');
    const geometry = countCalls(work, 'resolvedNode');
    try {
      work.activeItemIndex = 1;
      await canvas.updateComplete;
      recordScaleMeasurement('lr-flow-canvas', 'n=1000 cursor move', { templates: text.calls, geometry: geometry.calls });
      expect(text.calls).to.be.at.most(2);
      expect(geometry.calls).to.equal(0);
      expect(canvas.shadowRoot!.querySelector('[data-node-id="n1"] [part="node-control"]')?.getAttribute('tabindex')).to.equal('0');
    } finally { text.restore(); geometry.restore(); }
  });

  it('shares unmeasured fallback geometry within a 1000-node snapshot', async () => {
    const canvas = await mount();
    const work = canvas as unknown as Work & { companionStructure?: unknown; renderResolved?: unknown };
    work.measuredSizes.clear(); work.companionStructure = undefined; work.renderResolved = undefined;
    const native = window.getComputedStyle;
    let reads = 0;
    window.getComputedStyle = (...args) => { reads++; return native(...args); };
    try {
      work.buildSnapshot();
      recordScaleMeasurement('lr-flow-canvas', 'n=1000 fallback geometry snapshot', { reads });
      expect(reads).to.be.lessThan(20);
    } finally { window.getComputedStyle = native; }
  });

  it('checks connect candidates without scanning 1000-node collections per move', async () => {
    const canvas = await mount();
    canvas.edges = Array.from({ length: 999 }, (_, i) => ({ id: `e${i}`, source: 'n0', target: `n${i + 1}` }));
    await canvas.updateComplete;
    const work = canvas as unknown as Work;
    work.connectState = { sourceId: 'n0' };
    const find = Array.prototype.find;
    const some = Array.prototype.some;
    let visits = 0;
    Array.prototype.find = function <T>(this: T[], predicate: (value: T, index: number, array: T[]) => unknown, receiver?: unknown): T | undefined { return find.call(this, (value: T, index: number, array: T[]) => { visits++; return predicate.call(receiver, value, index, array); }) as T | undefined; };
    Array.prototype.some = function (predicate, receiver) { return some.call(this, (value, index, array) => { visits++; return predicate.call(receiver, value, index, array); }); };
    try {
      for (let i = 0; i < 20; i++) expect(work.isInvalidConnectTarget('n999')).to.equal(true);
      recordScaleMeasurement('lr-flow-canvas', 'n=1000 twenty connect checks', { visits });
      expect(visits).to.equal(0);
    } finally { Array.prototype.find = find; Array.prototype.some = some; work.connectState = undefined; }
  });
});

it('queries the visible area without filtering the entire 1000-node model on pan', async () => {
  const canvas = await mount();
  const nodes = canvas.nodes, edges = canvas.edges;
  const index = (canvas as unknown as { nodeViewportIndex: { intersects(): boolean } }).nodeViewportIndex;
  const intersections = countCalls(index, 'intersects');
  const native = Array.prototype.filter;
  let visits = 0;
  Array.prototype.filter = function <T>(this: T[], predicate: (value: T, index: number, array: T[]) => unknown, receiver?: unknown): T[] {
    const measured = this === nodes || this === edges;
    return native.call(this, (value: T, index: number, array: T[]) => {
      if (measured) visits++;
      return predicate.call(receiver, value, index, array);
    }) as T[];
  };
  try {
    canvas.setViewport({ x: -500000, y: 0, zoom: 1 });
    await canvas.updateComplete;
    recordScaleMeasurement('lr-flow-canvas', 'n=1000 viewport pan', { modelFilterVisits: visits, boundsTests: intersections.calls });
    expect(visits).to.equal(0);
    expect(intersections.calls).to.be.lessThan(100);
    expect(canvas.shadowRoot!.querySelector('[data-node-id="n500"]') !== null).to.equal(true);
  } finally { Array.prototype.filter = native; intersections.restore(); }
});

it('retains 1000 incident edge templates during a node cursor update', async () => {
  const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px"
    .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 250, y: 0 } }]}
    .edges=${Array.from({ length: 1000 }, (_, i) => ({ id: `e${i}`, source: 'a', target: 'b' }))}></lr-flow-canvas>`);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await canvas.updateComplete;
  const work = canvas as unknown as { edgeAccessibleText(): string; activeItemIndex: number };
  const text = countCalls(work, 'edgeAccessibleText');
  try {
    work.activeItemIndex = 1; await canvas.updateComplete;
    recordScaleMeasurement('lr-flow-canvas', 'n=1000 incident edges cursor update', { edgeTemplates: text.calls });
    expect(text.calls).to.equal(0);
    expect(canvas.shadowRoot!.querySelectorAll('[data-edge-id]').length).to.equal(1000);
  } finally { text.restore(); }
});

it('updates only newly measured geometry after panning to an unvisited node at n=1000', async () => {
  const canvas = await mount();
  for (let i = 0; i < 5; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const geometry = countCalls(canvas as unknown as Work, 'resolvedNode');
  try {
    canvas.setViewport({ x: -750000, y: 0, zoom: 1 });
    for (let i = 0; i < 6; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await canvas.updateComplete;
    recordScaleMeasurement('lr-flow-canvas', 'n=1000 unvisited pan after measurement', { geometry: geometry.calls });
    expect(geometry.calls).to.be.lessThan(20);
    expect(canvas.shadowRoot!.querySelector('[data-node-id="n750"]') !== null).to.equal(true);
  } finally { geometry.restore(); }
});
