import { expect, fixture, html } from '@open-wc/testing';
import { GraphBuiltin3dEngine, type GraphBuiltin3dFrame } from './graph-builtin-3d-engine.js';
import { projectSpatialPoint, type SpatialWorldNode } from './graph-spatial.js';

async function setup(detached = false) {
  const canvas = detached ? document.implementation.createHTMLDocument('').createElement('canvas')
    : await fixture<HTMLCanvasElement>(html`<canvas style="width: 320px; height: 240px"></canvas>`);
  const context = canvas.getContext('2d')!;
  const world: SpatialWorldNode[] = [-100, 100].map((x, index) => ({
    node: { id: index === 0 ? 'left' : 'right' }, position: { x, y: 0, z: 0 }, radius: 8, shape: 'circle',
  }));
  const frame: GraphBuiltin3dFrame = {
    world, edges: [{ id: 'edge', source: 'left', target: 'right' }],
    camera: { yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } },
    viewport: { width: 320, height: 240 }, fittedDistance: 500,
    paint: { nodes: new Map(), edges: new Map(), visibleEdges: new Set(['edge']), text: '#00ff00', selected: '#0000ff',
      font: 'sans-serif', fontSize: 12, dimmedOpacity: 0.25 },
    selectedNodeIds: [], selectedEdgeIds: [], dimmedNodeIds: [], dimmedEdgeIds: [], focusNodeId: null,
    nodeLabels: 'none', withEdgeLabels: false, edgeLabelMinZoom: 0.6,
  };
  const engine = new GraphBuiltin3dEngine(canvas, context);
  const pixel = (x: number, y: number) => [...context.getImageData(
    Math.floor(x * canvas.width / frame.viewport.width), Math.floor(y * canvas.height / frame.viewport.height), 1, 1,
  ).data];
  return { canvas, context, frame, engine, pixel };
}

describe('builtin graph canvas paint boundaries', () => {
  it('uses the text color for missing node and edge paints and highlights a hovered opaque edge', async () => {
    const { canvas, frame, engine, pixel } = await setup();
    try {
      engine.draw(frame);
      const left = projectSpatialPoint(frame.world[0]!.position, frame.camera, frame.viewport)!;
      expect(pixel(left.x, left.y)).to.deep.equal([0, 255, 0, 255]);
      const ordinary = pixel(160, 120);
      expect(ordinary[1]).to.equal(255);
      expect(ordinary[0]).to.equal(0);
      expect(ordinary[3]!).to.be.greaterThan(0);
      const hovered = { ...frame, hover: { kind: 'link' as const, id: 'edge', edge: frame.edges[0]! } };
      engine.draw(hovered);
      expect(pixel(160, 120)).to.deep.equal([0, 0, 255, 255]);
      const box = canvas.getBoundingClientRect();
      expect(engine.hit(box.left + 160, box.top + 120, hovered)?.id).to.equal('edge');
    } finally {
      engine.dispose();
    }
  });

  it('preserves dimming and selection on individually painted labeled edges without explicit widths', async () => {
    const { frame, engine, pixel } = await setup();
    const labeled = { ...frame, edges: [{ ...frame.edges[0]!, label: 'Relationship' }],
      withEdgeLabels: true, dimmedEdgeIds: ['edge'], selectedEdgeIds: ['edge'] };
    try {
      engine.draw(labeled);
      const selected = pixel(160, 120);
      expect(selected.slice(0, 3)).to.deep.equal([0, 0, 255]);
      expect(selected[3]!).to.be.within(60, 68);
      engine.draw({ ...labeled, selectedEdgeIds: [] });
      const ordinary = pixel(160, 120);
      expect(ordinary.slice(0, 3)).to.deep.equal([0, 255, 0]);
      expect(ordinary[3]!).to.be.greaterThan(0);
      expect(ordinary[3]!).to.be.at.most(68);
    } finally {
      engine.dispose();
    }
  });

  it('culls an entirely offscreen edge and restores its paint when the camera moves to it', async () => {
    const { frame, engine, context, canvas, pixel } = await setup();
    const shifted = { ...frame, world: frame.world.map(entry => ({ ...entry, position: { ...entry.position, x: entry.position.x + 10_000 } })) };
    try {
      engine.draw(shifted);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      expect(pixels.some((value, index) => index % 4 === 3 && value !== 0)).to.equal(false);
      engine.draw({ ...shifted, camera: { ...frame.camera, target: { x: 10_000, y: 0, z: 0 } } });
      expect(pixel(160, 120)[1]).to.equal(255);
      expect(pixel(160, 120)[3]!).to.be.greaterThan(0);
    } finally {
      engine.dispose();
    }
  });

  it('renders into a canvas prepared in a document without a browsing context', async () => {
    const { canvas, frame, engine, pixel } = await setup(true);
    try {
      expect(canvas.ownerDocument.defaultView).to.equal(null);
      engine.draw(frame);
      expect([canvas.width, canvas.height]).to.deep.equal([320, 240]);
      expect(pixel(160, 120)[1]).to.equal(255);
      expect(pixel(160, 120)[3]!).to.be.greaterThan(0);
    } finally {
      engine.dispose();
    }
  });
});
