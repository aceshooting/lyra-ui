import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraGraph } from './graph.js';
import { asTestGraph, type GraphSimulationNode } from '../../../../test/graph-test-support.js';

const nodeTypes = [
  { id: 'person', label: 'Person' },
  { id: 'place', label: 'Place' },
];
const nodes = [
  { id: 'a', label: 'Alpha', type: 'person' },
  { id: 'b', label: 'Beta', type: 'place' },
];
const edges = [{ id: 'ab', source: 'a', target: 'b' }];

type Internals = {
  simulation?: { stop(): void };
  pickDirty: boolean;
};

async function forceGraph(renderer: 'svg' | 'canvas'): Promise<LyraGraph> {
  const graph = await fixture<LyraGraph>(html`
    <lr-graph
      renderer=${renderer}
      width="400"
      height="300"
      style="width:400px;height:300px"
      .nodes=${nodes}
      .edges=${edges}
      .nodeTypes=${nodeTypes}
    ></lr-graph>
  `);
  await waitUntil(() => graph.getNodePosition('b') != null, 'graph positioned', {
    timeout: 5000,
  });
  (graph as unknown as Internals).simulation?.stop();
  return graph;
}

function liveNode(graph: LyraGraph, id: string): GraphSimulationNode {
  return asTestGraph(graph).simNodes.find((node) => node.id === id)!;
}

describe('lr-graph rebinding and rebuilds', () => {
  it('keeps the running layout when hiddenTypes is re-bound with the same ids', async () => {
    const graph = await forceGraph('svg');
    graph.hiddenTypes = ['place'];
    await graph.updateComplete;
    const internals = graph as unknown as Internals;
    const simulation = internals.simulation;
    expect(simulation).to.not.equal(undefined);
    graph.hiddenTypes = ['place'];
    await graph.updateComplete;
    expect(internals.simulation === simulation, 'same simulation').to.equal(true);
    graph.hiddenTypes = [];
    await graph.updateComplete;
    expect(internals.simulation === simulation, 'a real change rebuilds').to.equal(false);
  });

  it('closes the hover of a node that a rebuild removes, in both renderers', async () => {
    for (const renderer of ['svg', 'canvas'] as const) {
      const graph = await forceGraph(renderer);
      const leaves: string[] = [];
      graph.addEventListener('lr-node-leave', (event) =>
        leaves.push((event as CustomEvent<{ nodeId: string }>).detail.nodeId)
      );
      if (renderer === 'svg')
        graph.shadowRoot!.querySelectorAll('[part="node"]')[1]!.dispatchEvent(new MouseEvent('mouseenter'));
      else (graph as unknown as { canvasHover?: unknown }).canvasHover = { kind: 'node', id: 'b' };
      graph.hiddenTypes = ['place'];
      await graph.updateComplete;
      expect(leaves, renderer).to.deep.equal(['b']);
    }
  });

  it('keeps a canvas node drag on the node across a rebuild and releases it afterwards', async () => {
    const graph = await forceGraph('canvas');
    const internals = graph as unknown as Internals;
    const target = liveNode(graph, 'a');
    target.x = 100;
    target.y = 100;
    internals.pickDirty = true;
    const canvas = graph.shadowRoot!.querySelector('canvas')!;
    const nativeSet = canvas.setPointerCapture;
    const nativeRelease = canvas.releasePointerCapture;
    canvas.setPointerCapture = () => undefined;
    canvas.releasePointerCapture = () => undefined;
    try {
      const rect = canvas.getBoundingClientRect();
      const point = (dx: number, dy: number) => ({
        bubbles: true,
        pointerId: 7,
        clientX: rect.left + 100 + dx,
        clientY: rect.top + 100 + dy,
      });
      canvas.dispatchEvent(new PointerEvent('pointerdown', point(0, 0)));
      expect(target.fx).to.equal(100);
      graph.nodes = [...nodes, { id: 'c', label: 'Gamma', type: 'person' }];
      await graph.updateComplete;
      (graph as unknown as Internals).simulation?.stop();
      const rebuilt = liveNode(graph, 'a');
      expect(rebuilt === target, 'rebuild replaced the node').to.equal(false);
      canvas.dispatchEvent(new PointerEvent('pointermove', point(30, 20)));
      expect(rebuilt.fx).to.be.closeTo(130, 0.001);
      expect(rebuilt.fy).to.be.closeTo(120, 0.001);
      canvas.dispatchEvent(new PointerEvent('pointerup', point(30, 20)));
      expect(rebuilt.fx).to.equal(null);
      expect(rebuilt.fy).to.equal(null);
    } finally {
      canvas.setPointerCapture = nativeSet;
      canvas.releasePointerCapture = nativeRelease;
    }
  });

  it('keeps an SVG node drag on the node across a rebuild and releases it afterwards', async () => {
    const graph = await forceGraph('svg');
    const element = graph.shadowRoot!.querySelectorAll<SVGElement>('[part="node"]')[0]!;
    const rect = element.getBoundingClientRect();
    const at = (dx: number) => ({
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: rect.left + rect.width / 2 + dx,
      clientY: rect.top + rect.height / 2,
    });
    element.dispatchEvent(new MouseEvent('mousedown', at(0)));
    try {
      graph.nodes = [...nodes, { id: 'c', label: 'Gamma', type: 'person' }];
      await graph.updateComplete;
      (graph as unknown as Internals).simulation?.stop();
      const rebuilt = liveNode(graph, 'a');
      const pinned = rebuilt.fx;
      window.dispatchEvent(new MouseEvent('mousemove', at(25)));
      expect(rebuilt.fx).to.not.equal(pinned);
    } finally {
      window.dispatchEvent(new MouseEvent('mouseup', at(25)));
    }
    const released = liveNode(graph, 'a');
    expect(released.fx).to.equal(null);
    expect(released.fy).to.equal(null);
  });
});
