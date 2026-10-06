import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraGraph, type LyraGraphEdge, type LyraGraphNode } from './graph.js';
import { drawGraphScene } from './graph-canvas.js';

const NODE_COUNT = 300;
const LINK_COUNT = 600;

function scaleData(): { nodes: LyraGraphNode[]; edges: LyraGraphEdge[] } {
  const nodes = Array.from({ length: NODE_COUNT }, (_, index) => ({
    id: `n${index}`,
    label: `Node ${index}`,
  }));
  const edges = Array.from({ length: LINK_COUNT }, (_, index) => ({
    id: `e${index}`,
    source: `n${index % NODE_COUNT}`,
    target: `n${(index * 7 + 3) % NODE_COUNT}`,
  }));
  return { nodes, edges };
}

async function readyGraph(renderer: 'svg' | 'canvas'): Promise<LyraGraph> {
  const graph = await fixture<LyraGraph>(html`
    <lr-graph renderer=${renderer} width="400" height="300"></lr-graph>
  `);
  // The d3 peers load lazily; a busy runner can need longer than waitUntil's 1s default.
  await waitUntil(() => graph.getAttribute('aria-busy') === 'false', 'd3 loaded', {
    timeout: 5000,
  });
  return graph;
}

type ArrayMethod = 'find' | 'includes' | 'indexOf';

/** Runs `work` with one array method wrapped, saving and restoring the native one. */
async function countingArrayMethod(
  method: ArrayMethod,
  onCall: (array: readonly unknown[], args: unknown[]) => unknown[],
  work: () => Promise<void>
): Promise<void> {
  const prototype = Array.prototype as unknown as Record<
    ArrayMethod,
    (...args: unknown[]) => unknown
  >;
  const native = prototype[method];
  prototype[method] = function (this: unknown[], ...args: unknown[]) {
    return native.apply(this, onCall(this, args));
  };
  try {
    await work();
  } finally {
    prototype[method] = native;
  }
}

describe('lr-graph work stays linear in the graph size', () => {
  it('lays out a cold force build without scanning every link for each node', async () => {
    const graph = await readyGraph('canvas');
    const { nodes, edges } = scaleData();
    let predicateCalls = 0;
    await countingArrayMethod(
      'find',
      (_array, [predicate, thisArg]) => [
        (...args: unknown[]) => {
          predicateCalls += 1;
          return (predicate as (...a: unknown[]) => unknown).apply(thisArg, args);
        },
      ],
      async () => {
        graph.nodes = nodes;
        graph.edges = edges;
        await graph.updateComplete;
      }
    );
    expect(graph.getNodePosition('n0')).to.not.equal(undefined);
    expect(predicateCalls).to.be.below(10 * (NODE_COUNT + LINK_COUNT));
  });

  for (const renderer of ['svg', 'canvas'] as const) {
    it(`renders ${renderer} selection and dimming without a per-item list scan`, async () => {
      const graph = await readyGraph(renderer);
      const { nodes, edges } = scaleData();
      graph.nodes = nodes;
      graph.edges = edges;
      graph.selectionMode = 'multiple';
      graph.selectedNodeIds = nodes.slice(0, NODE_COUNT / 2).map((node) => node.id);
      graph.selectedEdgeIds = edges.slice(0, LINK_COUNT / 2).map((edge) => edge.id!);
      graph.dimmedNodeIds = nodes.slice(1).map((node) => node.id);
      graph.dimmedEdgeIds = edges.slice(1).map((edge) => edge.id!);
      await graph.updateComplete;
      let largeScans = 0;
      const countLargeScan = (array: readonly unknown[], args: unknown[]) => {
        if (array.length >= 100) largeScans += 1;
        return args;
      };
      await countingArrayMethod('includes', countLargeScan, () =>
        countingArrayMethod('indexOf', countLargeScan, async () => {
          graph.requestUpdate();
          await graph.updateComplete;
        })
      );
      expect(largeScans).to.be.below(10);
    });
  }
});

it('warns in development when the SVG renderer is handed a canvas-scale graph', async () => {
  const issued = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings!;
  issued.delete('lr-graph-svg-scale');
  const nativeWarn = console.warn;
  const messages: string[] = [];
  console.warn = (...args: unknown[]) => messages.push(args.join(' '));
  try {
    const graph = await readyGraph('svg');
    graph.nodes = Array.from({ length: 600 }, (_, index) => ({ id: `n${index}` }));
    graph.edges = Array.from({ length: 600 }, (_, index) => ({ source: `n${index}`, target: `n${(index + 1) % 600}` }));
    await graph.updateComplete;
  } finally {
    console.warn = nativeWarn;
  }
  expect(messages.some((message) => message.includes('renderer="canvas"'))).to.equal(true);
});

it('strokes consecutive same-style canvas links as one path', () => {
  const context = document.createElement('canvas').getContext('2d')!;
  const nativeStroke = context.stroke;
  let strokes = 0;
  context.stroke = function (this: CanvasRenderingContext2D, ...args: [Path2D?]) {
    strokes += 1;
    return nativeStroke.apply(this, args as [Path2D]);
  };
  drawGraphScene(context, { k: 1, x: 0, y: 0 }, {
    hulls: [],
    links: Array.from({ length: 100 }, (_, index) => ({ x1: index, y1: 0, x2: index, y2: 10, width: 1, color: 'black' })),
    nodes: [],
    edgeLabels: [],
    nodeLabels: [],
    showNodeLabels: false,
    haloColor: 'black',
    selectedColor: 'black',
    labelColor: 'black',
    labelHaloColor: 'white',
    font: '10px sans-serif',
  });
  expect(strokes).to.be.below(5);
});
