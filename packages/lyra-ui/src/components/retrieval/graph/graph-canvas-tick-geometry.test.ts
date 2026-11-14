import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { NODE_COUNT_TIMEOUT, type LyraGraph } from '../../../../test/graph-test-support.js';

type Point = { x: number; y: number };
type SceneShape = {
  nodes: Point[];
  nodeLabels: (Point & { text: string })[];
  expandIndicators?: Point[];
  focusHalo?: Point & { r: number };
  hulls: { d: string }[];
  edgeLabels: (Point & { text: string })[];
};
type SimNode = { id: string; x?: number; y?: number };
type Internals = {
  canvasScene?: SceneShape;
  simNodes: SimNode[];
  simulation?: { stop(): void; on(name: 'tick'): (() => void) | undefined };
};

async function settledCanvasGraph(): Promise<{ el: LyraGraph; internals: Internals }> {
  const el = await fixture<LyraGraph>(html`<lr-graph
    renderer="canvas"
    with-edge-labels
    focus-node-id="a"
    width="400"
    height="300"
    style="width:400px;height:300px"
  ></lr-graph>`);
  el.nodes = [
    { id: 'a', label: 'Alpha', expandable: true },
    { id: 'b', label: 'Beta' },
    { id: 'c', label: 'Gamma' },
  ];
  el.edges = [{ source: 'a', target: 'b', label: 'x' }, { source: 'b', target: 'c' }];
  el.communities = [{ id: 'team', memberIds: ['a', 'b', 'c'] }];
  await el.updateComplete;
  const internals = el as unknown as Internals;
  await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), 'canvas rendered', { timeout: NODE_COUNT_TIMEOUT });
  internals.simulation?.stop();
  await waitUntil(() => !!internals.canvasScene, 'canvas scene built', { timeout: NODE_COUNT_TIMEOUT });
  return { el, internals };
}

describe('lr-graph canvas renderer: per-tick geometry refresh', () => {
  it('moves every cached scene primitive with its simulated node on a tick without rebuilding the scene', async () => {
    const { internals } = await settledCanvasGraph();
    const scene = internals.canvasScene!;
    const tick = internals.simulation!.on('tick')!;
    const byId = new Map(internals.simNodes.map((node) => [node.id, node]));
    const placements: Record<string, Point> = { a: { x: 20, y: 30 }, b: { x: 220, y: 30 }, c: { x: 220, y: 230 } };
    for (const [id, point] of Object.entries(placements)) Object.assign(byId.get(id)!, point);
    const hullBefore = scene.hulls[0]!.d;

    tick();

    // The tick refreshes the very same cached scene in place (a camera-only repaint reuses it).
    expect(internals.canvasScene).to.equal(scene);
    const nodeIndex = internals.simNodes.findIndex((node) => node.id === 'a');
    expect(scene.nodes[nodeIndex]).to.include({ x: 20, y: 30 });
    const alphaLabel = scene.nodeLabels.find((label) => label.text === 'Alpha')!;
    expect(alphaLabel.y).to.equal(30);
    expect(alphaLabel.x).to.be.greaterThan(20 + 2);
    expect(scene.expandIndicators).to.have.length(1);
    expect(scene.expandIndicators![0]).to.include({ x: 20, y: 30 });
    expect(scene.focusHalo).to.include({ x: 20, y: 30 });
    expect(scene.hulls[0]!.d).to.not.equal(hullBefore);
    // The labelled 200px edge fits its single-character label; the unlabelled one contributes none.
    expect(scene.edgeLabels.map((label) => label.text)).to.deep.equal(['x']);
  });

  it('drops an edge label from the refreshed scene once its edge becomes too short for the text', async () => {
    const { internals } = await settledCanvasGraph();
    const scene = internals.canvasScene!;
    const byId = new Map(internals.simNodes.map((node) => [node.id, node]));
    Object.assign(byId.get('a')!, { x: 100, y: 100 });
    Object.assign(byId.get('b')!, { x: 100.5, y: 100 });
    internals.simulation!.on('tick')!();
    expect(scene.edgeLabels).to.deep.equal([]);
  });
});
