import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { LyraGraph } from './graph.js';
import type { LyraGraphSource, LyraGraphRecord, LyraSourceRecord, LyraGraphSceneRequest } from '../../../data-sources.js';
import type { LyraGraphNode, LyraGraphEdge } from './graph.js';

const spatialNodes = [
  { id: 'near', label: 'Near', position: { x: 0, y: 0, z: 80 } },
  { id: 'far', label: 'Far', position: { x: 0, y: 0, z: -80 } },
];
const camera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };

const spatialCanvas = (el: LyraGraph) => el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
const listItems = (el: LyraGraph) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="spatial-list-item"]')];
const control = (el: LyraGraph, action: string) => el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-spatial-action="${action}"]`)!;

describe('graph spatial list focus and navigation', () => {
  it('keeps keyboard focus on a list item when the focused node leaves the data set', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="list" .nodes=${[
      { id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' },
    ]}></lr-graph>`);
    const first = listItems(el).find((item) => item.dataset['nodeId'] === 'a')!;
    await focusByKeyboard(first);
    expect(el.shadowRoot!.activeElement === first).to.equal(true);
    el.nodes = [{ id: 'b', label: 'Beta' }];
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'spatial-list-item', 'focus stays inside the list');
    expect(el.shadowRoot!.activeElement?.getAttribute('data-node-id')).to.equal('b');
  });

  it('returns focus to the 3D canvas after switching to the 3D view from the toolbar', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${spatialNodes} .camera=${camera}></lr-graph>`);
    control(el, 'list').click();
    await el.updateComplete;
    await waitUntil(() => listItems(el).length === 2);
    control(el, '3d').click();
    await el.updateComplete;
    await waitUntil(() => spatialCanvas(el) !== null);
    await waitUntil(() => el.shadowRoot!.activeElement === spatialCanvas(el), 'canvas receives focus');
  });

  it('returns focus to the 3D toggle when the empty list has nothing else to focus', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${[]}></lr-graph>`);
    control(el, 'list').click();
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="spatial-list"]') !== null);
    await waitUntil(() => el.shadowRoot!.activeElement === control(el, '3d'), 'toggle receives focus');
    expect(listItems(el).length).to.equal(0);
  });

  it('activates link and community rows with their own events', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="list"
      .nodes=${[{ id: 'a', label: 'Alpha', communityId: 'g' }, { id: 'b', label: 'Beta', communityId: 'g' }]}
      .edges=${[{ id: 'ab', source: 'a', target: 'b' }]}
      .communities=${[{ id: 'g', label: 'Group', memberIds: ['a', 'b'] }]}></lr-graph>`);
    const rows = listItems(el);
    expect(rows.length).to.equal(4);
    const edge = oneEvent(el, 'lr-edge-activate');
    rows[2]!.click();
    expect((await edge).detail).to.include({ sourceNodeId: 'a', targetNodeId: 'b', edgeId: 'ab' });
    const community = oneEvent(el, 'lr-community-activate');
    rows[3]!.click();
    expect((await community).detail.communityId).to.equal('g');
  });
});

describe('graph spatial canvas input', () => {
  it('orbits the camera with a plain pointer drag and leaves its target alone', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${spatialNodes} .camera=${camera}></lr-graph>`);
    const canvas = spatialCanvas(el);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: 20, clientY: 20, button: 0 }));
    const changed = oneEvent(el, 'lr-camera-change');
    canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 90, clientY: 40 }));
    const next = (await changed).detail.camera;
    expect(next.yaw).to.be.greaterThan(0);
    expect(next.pitch).to.not.equal(camera.pitch);
    expect(next.target).to.deep.equal(camera.target);
    canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 90, clientY: 40, button: 0 }));
  });

  it('zooms with the plus and minus keys', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${spatialNodes} .camera=${camera}></lr-graph>`);
    const canvas = spatialCanvas(el);
    await focusByKeyboard(canvas);
    const zoomedIn = oneEvent(el, 'lr-camera-change');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
    const inward = (await zoomedIn).detail.camera;
    expect(inward.distance).to.be.lessThan(camera.distance);
    const zoomedOut = oneEvent(el, 'lr-camera-change');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }));
    expect((await zoomedOut).detail.camera.distance).to.be.greaterThan(inward.distance);
  });

  it('clears the selection when Escape is pressed on the canvas', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" selection-mode="single" .selectedNodeIds=${['near']}
      .nodes=${spatialNodes} .camera=${camera}></lr-graph>`);
    const canvas = spatialCanvas(el);
    await focusByKeyboard(canvas);
    const cleared = oneEvent(el, 'lr-selection-change');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect((await cleared).detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: [] });
  });
});

describe('graph spatial rendering and positions', () => {
  async function paintedUrl(expandable: boolean): Promise<string> {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" style="inline-size:320px;block-size:240px" .height=${240}
      .nodes=${[{ id: 'only', label: 'Only', expandable, position: { x: 0, y: 0, z: 0 } }]} .camera=${camera}></lr-graph>`);
    await twoFrames();
    return spatialCanvas(el).toDataURL();
  }

  it('marks an expandable node on the 3D canvas and nothing else', async () => {
    const plain = await paintedUrl(false);
    const expandable = await paintedUrl(true);
    expect(expandable === plain, 'the expand marker is painted').to.equal(false);
  });

  it('reports world coordinates through getNodePosition in 3D and list views', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${spatialNodes} .camera=${camera}></lr-graph>`);
    expect(el.getNodePosition('near')).to.deep.equal({ x: 0, y: 0 });
    expect(el.getNodePosition('missing')).to.equal(undefined);
    el.view = 'list';
    await el.updateComplete;
    expect(el.getNodePosition('far')).to.deep.equal({ x: 0, y: 0 });
  });

  it('fit() requested before the spatial renderer has loaded frames the nodes once it has', async () => {
    const spread = [{ id: 'left', position: { x: -1000, y: 0, z: 0 } }, { id: 'right', position: { x: 1000, y: 0, z: 0 } }];
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const el = document.createElement('lr-graph') as LyraGraph;
    el.view = '3d';
    el.style.inlineSize = '320px';
    el.height = 400;
    el.nodes = spread;
    el.camera = camera;
    host.append(el);
    const framed = oneEvent(el, 'lr-camera-change');
    el.fit({ padding: 20 });
    const next = (await framed).detail.camera;
    expect(next.distance, 'the camera backs away to frame the spread nodes').to.be.greaterThan(camera.distance);
  });
});

/** Counts painted canvas pixels in an annular sector around a node, in CSS pixels and degrees (0 = east, y down). */
function paintedPixels(el: LyraGraph, id: string, inner: number, outer: number, fromDegrees: number, toDegrees: number): number {
  const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!;
  const point = el.getNodeScreenPosition(id)!;
  const host = el.getBoundingClientRect(), box = canvas.getBoundingClientRect();
  const scale = canvas.width / box.width;
  const cx = (host.left + point.x - box.left) * scale, cy = (host.top + point.y - box.top) * scale;
  const span = Math.ceil(outer * scale);
  const left = Math.max(0, Math.floor(cx - span)), top = Math.max(0, Math.floor(cy - span));
  const width = Math.min(canvas.width - left, span * 2 + 1), height = Math.min(canvas.height - top, span * 2 + 1);
  const data = canvas.getContext('2d')!.getImageData(left, top, width, height).data;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (left + x - cx) / scale, dy = (top + y - cy) / scale;
      const radius = Math.hypot(dx, dy);
      if (radius < inner || radius > outer) continue;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < fromDegrees || angle > toDegrees) continue;
      if (data[(y * width + x) * 4 + 3]! > 24) count++;
    }
  }
  return count;
}

describe('graph canvas renderer overlays and screen positions', function () {
  // Covers the mount, 20 s force-layout settle and follow-up waits below, so a slow engine fails
  // on the named wait instead of the generic per-test timeout.
  this.timeout(40_000);
  const canvasNodes: LyraGraphNode[] = [
    { id: 'a', label: 'A', radius: 12, expandable: true },
    { id: 'b', label: 'B', radius: 12 },
  ];

  async function settled(el: LyraGraph): Promise<void> {
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas') && el.getNodePosition('a') !== undefined && el.getNodePosition('b') !== undefined, 'canvas graph mounted', { timeout: 5000 });
    let previous = '';
    let stable = 0;
    await waitUntil(() => {
      const now = JSON.stringify([el.getNodePosition('a'), el.getNodePosition('b')]);
      stable = now === previous ? stable + 1 : 0;
      previous = now;
      return stable >= 12;
    }, 'layout settled', { timeout: 20_000, interval: 50 });
    await twoFrames();
  }

  it('paints the focus halo and expand badge where the settled nodes are, and moves the halo with focus-node-id', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph renderer="canvas" node-labels="none" width="400" height="300"
      style="inline-size:400px;block-size:300px" focus-node-id="b" .nodes=${canvasNodes}></lr-graph>`);
    await settled(el);
    expect(paintedPixels(el, 'b', 15.5, 21, 50, 130), 'halo ring below the focused node').to.be.greaterThan(0);
    expect(paintedPixels(el, 'a', 15.5, 21, 50, 130), 'no halo on the unfocused node').to.equal(0);

    el.focusNodeId = 'a';
    await waitUntil(() => paintedPixels(el, 'a', 15.5, 21, 50, 130) > 0 && paintedPixels(el, 'b', 15.5, 21, 50, 130) === 0, 'halo follows focus-node-id', { timeout: 5000 });
    el.focusNodeId = null;
    await waitUntil(() => paintedPixels(el, 'a', 15.5, 21, 50, 130) === 0, 'halo removed with focus-node-id', { timeout: 5000 });
  });

  it('projects a canvas node to its painted position', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph renderer="canvas" node-labels="none" width="400" height="300"
      style="inline-size:400px;block-size:300px" .nodes=${[{ id: 'solo', label: 'Solo', radius: 12 }]}></lr-graph>`);
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas') && el.getNodeScreenPosition('solo') !== undefined, 'canvas projection ready', { timeout: 5000 });
    await waitUntil(() => paintedPixels(el, 'solo', 0, 9, -180, 180) > 20, 'the node is painted', { timeout: 5000 });
    await twoFrames();
    const point = el.getNodeScreenPosition('solo')!;
    expect(Number.isFinite(point.x) && Number.isFinite(point.y)).to.equal(true);
    expect(paintedPixels(el, 'solo', 0, 9, -180, 180), 'the node paints under its projected position').to.be.greaterThan(20);
    expect(paintedPixels(el, 'solo', 40, 60, -180, 180), 'nothing paints away from it').to.equal(0);
  });
});

type SourceNode = LyraGraphNode;
type SourceEdge = LyraGraphEdge & { readonly id: string };
type Source = LyraGraphSource<SourceNode, SourceEdge>;
type SourceRecord = LyraSourceRecord<LyraGraphRecord<SourceNode, SourceEdge>>;
const total = { nodes: 1_000_000, edges: 1_000_000 };
const nodeRecord = (index: number): SourceRecord => ({ key: `node:${index}`, order: index, value: { kind: 'node', value: { id: String(index), label: `Node ${index}` } } });

function sourceProvider(): Source {
  return {
    revision: 1,
    records: {
      revision: 1,
      query: async (request) => {
        const start = request.page * request.pageSize;
        return { rows: Array.from({ length: request.pageSize }, (_, offset) => nodeRecord(start + offset)), total: 1_000_000, summary: total };
      },
      locate: async (key) => Number(key.slice(key.indexOf(':') + 1)),
      lookup: async (keys) => keys.map((key) => nodeRecord(Number(key.slice(key.indexOf(':') + 1)))),
    },
    scene: async (request: LyraGraphSceneRequest) => {
      const keys = request.includeKeys.length ? request.includeKeys : ['node:0'];
      return {
        nodes: keys.map((key) => ({ key, value: { id: key.slice(5), label: `Node ${key.slice(5)}` }, position: { x: 0, y: 0, z: 0 } })),
        edges: [], total, coverage: 'neighborhood' as const, worldBounds: null,
      };
    },
  };
}

describe('graph source mode', () => {
  it('reveals the declarative focus-node-id record in the navigator', async () => {
    const el = document.createElement('lr-graph') as LyraGraph;
    el.view = 'list'; el.focusNodeId = '500000'; el.graphSource = sourceProvider();
    const lifecycle = el as unknown as { updated(changes: Map<PropertyKey, unknown>): void };
    const originalUpdated = lifecycle.updated, originalFocus = el.focusNode;
    let inUpdated = false;
    const focusDuringUpdate: boolean[] = [];
    lifecycle.updated = function(changes) {
      inUpdated = true;
      try { originalUpdated.call(el, changes); } finally { inUpdated = false; }
    };
    el.focusNode = function(...args) { focusDuringUpdate.push(inUpdated); return originalFocus.apply(this, args); };
    try {
      await fixture(el);
      await waitUntil(() => el.shadowRoot!.querySelector('[data-source-key="node:500000"]') !== null, 'focused record page is shown', { timeout: 5000 });
      expect(focusDuringUpdate).to.deep.equal([false]);
    } finally { lifecycle.updated = originalUpdated; el.focusNode = originalFocus; }
  });

  it('emits activation and selection for a clicked diagram node of a source graph', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph selection-mode="single" seed="3" width="360" height="260"
      style="inline-size:360px;block-size:260px" .graphSource=${sourceProvider()}></lr-graph>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length >= 1, 'source diagram node rendered', { timeout: 8000 });
    const activate = oneEvent(el, 'lr-node-activate');
    const selection = oneEvent(el, 'lr-selection-change');
    el.shadowRoot!.querySelector('[part="node"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect((await activate).detail.nodeId).to.equal('0');
    expect((await selection).detail.selectedNodeIds).to.deep.equal(['0']);
  });
});
