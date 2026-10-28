import { expect, fixture, nextFrame, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import type { LyraGraphSource } from '../../../data-sources.js';
import { projectSpatialPoint } from './graph-spatial.js';
import { GraphSpatialController } from './graph-spatial-controller.js';
import type { GraphEngineAdapterServices } from './graph-engine-adapter.js';
import { LyraGraph } from './graph.js';
import type { LyraGraphCamera, LyraGraphEdge, LyraGraphNode } from './graph-model.js';
void LyraGraph;

const camera = (): LyraGraphCamera => ({ yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } });
interface Data { readonly spatialAppearance?: { readonly dimmedOpacity?: number; readonly edgeCurvatures?: Float32Array }; readonly nodeCount: number; readonly labels?: readonly string[]; readonly positions?: Float32Array; readonly source: Uint32Array; readonly target: Uint32Array }
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
function fakeEngine(gate?: Promise<void>) {
  let host: Engine3dHost | undefined, canvas: HTMLCanvasElement | undefined, disposals = 0;
  const data: Data[] = [], appearances: unknown[] = [], cameras: LyraGraphCamera[] = [];
  const screens = new Map<number, { x: number; y: number }>();
  const states: { selected?: ReadonlySet<number> }[] = [];
  const positions = new Map<number, { x: number; y: number; z: number }>();
  const engine: Engine3dInstance & { setAppearance(value: unknown): void } = {
    contract: 1,
    async mount(container, callbacks) { host = callbacks; canvas = container.ownerDocument.createElement('canvas'); container.append(canvas); if (gate) await gate; },
    setData(value) { data.push(value as Data); }, setAppearance(value) { appearances.push(value); },
    setStyle() {}, setState(value) { states.push(value); }, resize() {},
    setCamera(value) { cameras.push(value as LyraGraphCamera); },
    fit() { return { ...camera(), distance: 800 }; },
    positionOf(row) { const moved = positions.get(row); if (moved) return moved; const values = data.at(-1)?.positions; return values ? { x: values[row * 3]!, y: values[row * 3 + 1]!, z: values[row * 3 + 2]! } : { x: row * 20, y: 0, z: 0 }; },
    project(row) { return screens.get(row) ?? { x: 40 + row * 50, y: 60 }; }, pick() { return 0; },
    dispose() { disposals++; canvas?.remove(); },
  };
  return { engine, data, appearances, cameras, positions, screens, states, callbacks: () => host!, disposals: () => disposals };
}
function setup(options: { available?: boolean; gate?: Promise<void> } = {}) {
  let probes = 0, loads = 0;
  const created: ReturnType<typeof fakeEngine>[] = [];
  const services: GraphEngineAdapterServices = { available() { probes++; return options.available ?? true; }, async create() { loads++; const value = fakeEngine(options.gate); created.push(value); return value.engine; } };
  class InjectedSpatial extends GraphSpatialController {
    constructor(...args: ConstructorParameters<typeof GraphSpatialController>) { super(args[0], { ...args[1], engineServices: services }); }
  }
  const graph = document.createElement('lr-graph') as LyraGraph;
  graph.style.cssText = 'display:block;inline-size:360px;block-size:280px'; graph.width = 360; graph.height = 280;
  graph.nodes = [{ id: 'local-a', position: { x: 10, y: 20, z: 30 } }, { id: 'local-b', position: { x: 50, y: 20, z: 30 } }];
  graph.edges = [{ id: 'local-edge', source: 'local-a', target: 'local-b' }];
  (graph as unknown as { loadSpatialController(): Promise<{ GraphSpatialController: typeof GraphSpatialController }> }).loadSpatialController = async () => ({ GraphSpatialController: InjectedSpatial });
  return { graph, created, probes: () => probes, loads: () => loads };
}
async function settle(graph: LyraGraph) { await graph.updateComplete; await nextFrame(); await nextFrame(); }
async function mounted(value: ReturnType<typeof setup>) {
  await waitUntil(() => value.created.length > 0 && value.created[0]!.data.length > 0, 'eligible graph engine mounted and received data', { timeout: 3000 });
  await settle(value.graph); return value.created[0]!;
}
const listRows = (graph: LyraGraph) => [...graph.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="spatial-list-item"]')];
const control = (graph: LyraGraph, action: string) => graph.shadowRoot!.querySelector<HTMLButtonElement>(`[data-spatial-action="${action}"]`)!;
function source(): LyraGraphSource<LyraGraphNode, LyraGraphEdge & { readonly id: string }> {
  const row = { key: 'node:remote', order: 0, value: { kind: 'node' as const, value: { id: 'remote', label: 'Remote authoritative node' } } };
  return { revision: 1, records: { revision: 1, query: async () => ({ rows: [row], total: 1, summary: { nodes: 1, edges: 0 } }),
    lookup: async (keys) => keys.includes(row.key) ? [row] : [], locate: async (key) => key === row.key ? 0 : null },
    scene: async (request) => ({ nodes: request.includeKeys.length && !request.includeKeys.includes(row.key) ? [] : [{ key: row.key, value: row.value.value, position: { x: 0, y: 0, z: 0 } }], edges: [], total: { nodes: 1, edges: 0 }, coverage: 'neighborhood', worldBounds: null }) };
}

describe('graph optional engine component integration', () => {
  it('keeps filtered curvature through typed appearance refresh and list fallback', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    const edgeCurvature = new Float32Array([0.25, -2]);
    value.graph.graphColumns = { ids: ['hidden', 'a', 'b'], category: new Uint16Array([0, 1, 1]), categories: ['hide', 'keep'],
      source: new Uint32Array([0, 1]), target: new Uint32Array([1, 2]), edgeCurvature };
    value.graph.hiddenTypes = ['hide'];
    await fixture(value.graph); const engine = await mounted(value);
    expect(Array.from(engine.data.at(-1)!.spatialAppearance?.edgeCurvatures ?? [])).to.deep.equal([-1]);
    const dataCount = engine.data.length;
    value.graph.nodeLabels = 'always'; await settle(value.graph);
    const appearance = engine.appearances.at(-1) as Pick<Data, 'spatialAppearance'> | undefined;
    expect(Array.from(appearance?.spatialAppearance?.edgeCurvatures ?? [])).to.deep.equal([-1]);
    expect(engine.data.length).to.equal(dataCount);
    expect(Array.from(edgeCurvature)).to.deep.equal([0.25, -2]);
    engine.callbacks().lost('context-lost'); await settle(value.graph);
    expect(listRows(value.graph).length).to.equal(3);
    const activated: (string | undefined)[] = [];
    value.graph.addEventListener('lr-edge-activate', event => activated.push(event.detail.edgeId));
    listRows(value.graph)[2]!.click();
    expect(activated).to.deep.equal(['column-edge-1']);
  });

  it('resolves the shared dimmed opacity token for typed column rendering', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    value.graph.style.setProperty('--lr-graph-dimmed-opacity', '0.17');
    value.graph.graphColumns = { ids: ['column-a'], x: new Float32Array([0]), source: new Uint32Array(), target: new Uint32Array() };
    value.graph.dimmedNodeIds = ['column-a'];
    await fixture(value.graph); const engine = await mounted(value);
    expect(engine.data.at(-1)!.spatialAppearance!.dimmedOpacity).to.equal(0.17);
  });

  it('keeps unset and invalid engine preferences on builtin without probing or creating a companion', async () => {
    const value = setup(); value.graph.view = '3d'; await fixture(value.graph); await settle(value.graph);
    expect(value.graph.engine).to.equal('builtin'); expect(value.probes()).to.equal(0); expect(value.loads()).to.equal(0);
    value.graph.setAttribute('engine', 'invalid'); await settle(value.graph);
    expect(value.graph.engine).to.equal('builtin'); expect(value.loads()).to.equal(0);
    (value.graph as unknown as { engine: unknown }).engine = null; await settle(value.graph);
    expect(value.graph.engine).to.equal('builtin'); expect(value.loads()).to.equal(0);
  });

  it('does not create a companion for list, 2D or authoritative source views', async () => {
    const list = setup(); list.graph.engine = 'webgl'; list.graph.view = 'list'; await fixture(list.graph); await settle(list.graph); expect(list.loads()).to.equal(0);
    const flat = setup(); flat.graph.engine = 'webgl'; flat.graph.view = '2d';
    (flat.graph as unknown as { connect2d(): void }).connect2d = () => undefined;
    await fixture(flat.graph); await settle(flat.graph); expect(flat.loads()).to.equal(0);
    const remote = setup(); remote.graph.engine = 'webgl'; remote.graph.view = '3d'; remote.graph.graphSource = source();
    remote.graph.graphColumns = { ids: ['column-only'], source: new Uint32Array(), target: new Uint32Array() };
    await fixture(remote.graph); await waitUntil(() => !!remote.graph.shadowRoot!.querySelector('[data-source-key]'));
    await settle(remote.graph); expect(remote.loads()).to.equal(0);
    expect(await remote.graph.focusNode('column-only')).to.equal(false);
    expect(await remote.graph.focusNode('remote')).to.equal(true);
  });

  it('delays explicit WebGL creation until the actual surface becomes visible', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; value.graph.style.display = 'none';
    await fixture(value.graph); await settle(value.graph); expect(value.loads()).to.equal(0);
    value.graph.style.display = 'block'; await mounted(value); expect(value.loads()).to.equal(1);
  });

  for (const scope of ['host', 'ancestor'] as const) {
    for (const fence of ['aria-hidden', 'inert', 'hidden', 'visibility'] as const) {
      it(`keeps ${scope} ${fence} graphs cold and admits them after the author fence clears`, async () => {
        const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
        const wrapper = document.createElement('div'); wrapper.append(value.graph);
        const target = scope === 'host' ? value.graph : wrapper;
        if (fence === 'visibility') target.style.visibility = 'hidden';
        else target.setAttribute(fence, fence === 'aria-hidden' ? 'true' : '');
        await fixture(wrapper); await settle(value.graph);
        expect(value.probes(), 'hidden graph must not probe WebGL').to.equal(0);
        expect(value.loads(), 'hidden graph must not import the companion').to.equal(0);
        if (fence === 'visibility') target.style.removeProperty('visibility');
        else target.removeAttribute(fence);
        await mounted(value);
        expect(value.probes()).to.equal(1); expect(value.loads()).to.equal(1);
      });
    }
  }

  it('gives columns precedence and reaches the final row through bounded list pages', async () => {
    const value = setup(); value.graph.view = 'list';
    value.graph.graphColumns = { ids: Array.from({ length: 10001 }, (_, row) => `column-${row}`), source: new Uint32Array([0]), target: new Uint32Array([10000]) };
    await fixture(value.graph); await settle(value.graph);
    expect(listRows(value.graph).length).to.equal(200); expect(listRows(value.graph)[0]!.textContent).to.include('column-0');
    expect(value.graph.getNodePosition3d('local-a')).to.equal(undefined);
    expect(await value.graph.focusNode('column-10000')).to.equal(true); await settle(value.graph);
    expect(listRows(value.graph).length).to.equal(2); expect(listRows(value.graph)[0]!.textContent).to.include('column-10000'); expect(value.loads()).to.equal(0);
    control(value.graph, 'previous').click(); await settle(value.graph); expect(listRows(value.graph).length).to.equal(200);
  });

  it('clears the active topology for invalid columns and retires the existing engine', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    value.graph.graphColumns = { ids: ['column-a'], x: new Float32Array([5]), source: new Uint32Array(), target: new Uint32Array() };
    await fixture(value.graph); const engine = await mounted(value);
    value.graph.graphColumns = { ids: ['duplicate', 'duplicate'], source: new Uint32Array(), target: new Uint32Array() };
    await settle(value.graph);
    expect(value.graph.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
    expect(value.graph.shadowRoot!.querySelectorAll('[data-webgl-host]').length).to.equal(0);
    expect(value.graph.getNodePosition3d('column-a')).to.equal(undefined); expect(value.graph.getNodePosition3d('local-a')).to.equal(undefined);
    expect(engine.disposals()).to.equal(1);
  });

  it('preserves builtin camera bounds while admitting wider explicit WebGL cameras', async () => {
    const value = setup(); value.graph.view = '3d'; value.graph.camera = { ...camera(), distance: 1e12, target: { x: 5e6, y: 0, z: 0 } };
    expect(value.graph.camera!.distance).to.equal(1e7); expect(value.graph.camera!.target.x).to.equal(1e6);
    value.graph.engine = 'webgl'; value.graph.camera = { ...camera(), distance: 1e12, target: { x: 5e6, y: 0, z: 0 } };
    await fixture(value.graph); const engine = await mounted(value);
    expect(engine.cameras.at(-1)!.distance).to.equal(1e12); expect(engine.cameras.at(-1)!.target.x).to.equal(5e6);
  });

  it('projects fake engine identity through public getters and preserves silent authored camera writes', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; const activated: unknown[] = [], cameras: unknown[] = [], expanded: unknown[] = [];
    value.graph.addEventListener('lr-node-activate', (event) => activated.push(event.detail)); value.graph.addEventListener('lr-camera-change', (event) => cameras.push(event.detail));
    value.graph.addEventListener('lr-node-expand', (event) => expanded.push(event.detail));
    await fixture(value.graph); const engine = await mounted(value);
    value.graph.camera = { ...camera(), yaw: 0.4 }; await settle(value.graph); expect(cameras.length).to.equal(0);
    engine.callbacks().pick(0, { ctrl: true, shift: false, double: false });
    expect(activated[0]).to.deep.equal({ nodeId: 'local-a', x: 10, y: 20, z: 30 });
    engine.callbacks().pick(1, { ctrl: false, shift: false, double: true }); expect(expanded[0]).to.deep.equal({ nodeId: 'local-b' });
    engine.callbacks().camera({ ...camera(), yaw: 0.8 }); await settle(value.graph); expect(cameras.length).to.equal(1);
    const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
    const bounds = surface.getBoundingClientRect(), host = value.graph.getBoundingClientRect();
    expect(value.graph.getNodeScreenPosition('local-a')).to.deep.equal({ x: bounds.left - host.left + 40, y: bounds.top - host.top + 60 });
  });

  it('keeps relative toolbar zoom and focused wheel zoom in the component control plane', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; await fixture(value.graph); const engine = await mounted(value);
    const changes: LyraGraphCamera[] = []; value.graph.addEventListener('lr-camera-change', (event) => changes.push(event.detail.camera));
    const initial = engine.cameras.at(-1)!.distance; control(value.graph, 'zoom-in').click(); await settle(value.graph);
    expect(engine.cameras.at(-1)!.distance).to.be.lessThan(initial); expect(changes.length).to.equal(1);
    const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!; await focusByKeyboard(surface);
    const before = engine.cameras.at(-1)!.distance;
    const wheel = new WheelEvent('wheel', { deltaY: -80, bubbles: true, cancelable: true }); surface.dispatchEvent(wheel); await settle(value.graph);
    expect(wheel.defaultPrevented).to.equal(true); expect(engine.cameras.at(-1)!.distance).to.be.lessThan(before); expect(changes.length).to.equal(2);
  });

  it('does not replace topology or discard live positions on label or selection updates', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; await fixture(value.graph); const engine = await mounted(value);
    const replacements = engine.data.length; engine.positions.set(0, { x: 123, y: 45, z: 67 });
    value.graph.nodeLabels = 'always'; value.graph.selectedNodeIds = ['local-a']; await settle(value.graph);
    expect(engine.data.length).to.equal(replacements); expect(value.graph.getNodePosition3d('local-a')).to.deep.equal({ x: 123, y: 45, z: 67 });
  });

  it('retires a disconnected pending mount once and rejects obsolete host callbacks', async () => {
    const gate = deferred(); const value = setup({ gate: gate.promise }); value.graph.engine = 'webgl'; value.graph.view = '3d';
    let activations = 0; value.graph.addEventListener('lr-node-activate', () => activations++);
    try {
      await fixture(value.graph); await waitUntil(() => value.created.length > 0 && !!value.created[0]!.callbacks());
      const engine = value.created[0]!; value.graph.remove(); gate.resolve(); await nextFrame();
      expect(engine.disposals()).to.equal(1); engine.callbacks().pick(0, { ctrl: false, shift: false, double: false }); expect(activations).to.equal(0);
    } finally { gate.resolve(); value.graph.remove(); }
  });

  it('reports unsupported fallback without loading and keeps context-loss callbacks inactive until restore', async () => {
    const unsupported = setup({ available: false }); unsupported.graph.engine = 'webgl'; unsupported.graph.view = '3d';
    const descents: unknown[] = []; unsupported.graph.addEventListener('lr-engine-fallback', (event) => descents.push(event.detail));
    await fixture(unsupported.graph); await waitUntil(() => descents.length > 0);
    expect(unsupported.loads()).to.equal(0); expect(descents[0]).to.deep.equal({ from: 'webgl', to: 'builtin', reason: 'unsupported' });
    expect(unsupported.graph.shadowRoot!.querySelectorAll('[part="engine-notice"]').length).to.equal(1);
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; await fixture(value.graph); const engine = await mounted(value);
    let cameraEvents = 0; value.graph.addEventListener('lr-camera-change', () => cameraEvents++);
    engine.callbacks().lost('context-lost'); await settle(value.graph);
    engine.callbacks().camera({ ...camera(), yaw: 2 }); await settle(value.graph); expect(cameraEvents).to.equal(0);
    engine.callbacks().restored?.(); await settle(value.graph); expect(value.loads()).to.equal(1);
    expect(value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!.hidden).to.equal(false);
  });

  it('retries a fresh engine after disconnecting a graph that lost its context', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    await fixture(value.graph); const first = await mounted(value);
    first.callbacks().lost('context-lost'); await settle(value.graph);
    const parent = value.graph.parentElement!; value.graph.remove(); await nextFrame(); parent.append(value.graph);
    await waitUntil(() => value.created.length === 2 && value.created[1]!.data.length > 0, 'reconnected graph receives a fresh engine');
    await settle(value.graph); expect(first.disposals()).to.equal(1); expect(value.loads()).to.equal(2);
    let activations = 0; value.graph.addEventListener('lr-node-activate', () => activations++);
    first.callbacks().pick(0, { ctrl: false, shift: false, double: false }); expect(activations).to.equal(0);
    value.created[1]!.callbacks().pick(0, { ctrl: false, shift: false, double: false }); expect(activations).to.equal(1);
    expect(value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!.hidden).to.equal(false);
  });

  it('copies live local positions into the builtin fallback projection', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; value.graph.camera = camera();
    await fixture(value.graph); const engine = await mounted(value);
    const moved = { x: 123, y: 45, z: 67 }; engine.positions.set(0, moved);
    engine.callbacks().lost('context-lost'); await settle(value.graph);
    expect(value.graph.getNodePosition3d('local-a')).to.deep.equal(moved);
    const canvas = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('canvas[part="spatial-canvas"]')!;
    const bounds = canvas.getBoundingClientRect(), host = value.graph.getBoundingClientRect();
    const expected = projectSpatialPoint(moved, camera(), { width: bounds.width, height: bounds.height })!;
    const actual = value.graph.getNodeScreenPosition('local-a')!;
    expect(actual.x).to.be.closeTo(bounds.left - host.left + expected.x, 0.01);
    expect(actual.y).to.be.closeTo(bounds.top - host.top + expected.y, 0.01);
  });

  it('clears the local label overlay when columns take renderer authority', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; value.graph.nodeLabels = 'always';
    await fixture(value.graph); const engine = await mounted(value);
    const canvas = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('[data-graph-labels]')!;
    const ctx = canvas.getContext('2d')!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 4, 4);
    expect(ctx.getImageData(1, 1, 1, 1).data[3]).to.equal(255);
    value.graph.graphColumns = { ids: ['column-a', 'column-b'], source: new Uint32Array(), target: new Uint32Array() };
    await settle(value.graph);
    expect(engine.data.at(-1)!.labels).to.deep.equal(['column-a', 'column-b']);
    const active = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('[data-graph-labels]')!;
    expect(active.getContext('2d')!.getImageData(1, 1, 1, 1).data[3]).to.equal(0);
  });

  it('refreshes local labels even when the engine captures and stops a pointer move', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; value.graph.nodeLabels = 'always';
    await fixture(value.graph); const engine = await mounted(value);
    const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
    const target = surface.querySelector<HTMLCanvasElement>('canvas:not([data-graph-labels])')!;
    const ctx = surface.querySelector<HTMLCanvasElement>('[data-graph-labels]')!.getContext('2d')!;
    const original = ctx.fillText, labels: { text: string; x: number; y: number }[] = [];
    ctx.fillText = function(text, x, y, maxWidth) { labels.push({ text, x, y }); if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth); };
    try {
      expect(surface.clientWidth, 'label surface width').to.be.greaterThan(0);
      expect(surface.clientHeight, 'label surface height').to.be.greaterThan(0);
      const initial = { x: surface.clientWidth * 0.2, y: surface.clientHeight * 0.5 };
      const moved = { x: surface.clientWidth * 0.6, y: initial.y };
      engine.screens.set(0, initial);
      value.graph.camera = camera();
      await settle(value.graph);
      const baseline = labels.find((label) => label.text === 'local-a' && label.y === initial.y);
      expect(baseline !== undefined, 'initial in-bounds label painted').to.equal(true);
      labels.length = 0;
      let intercepted = false;
      target.addEventListener('pointermove', (event) => { intercepted = true; engine.screens.set(0, moved); event.stopImmediatePropagation(); }, { capture: true, once: true });
      const bounds = surface.getBoundingClientRect();
      target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: bounds.left + moved.x, clientY: bounds.top + moved.y }));
      await settle(value.graph);
      expect(intercepted).to.equal(true);
      expect(labels.some((label) => label.text === 'local-a' && label.y === moved.y && label.x > moved.x && label.x > baseline!.x)).to.equal(true);
    } finally { ctx.fillText = original; }
  });

  it('maps filtered selection and picks by original identity and rejects picks before replacement applies', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    value.graph.graphColumns = { ids: ['a', 'b', 'c', 'd'], x: new Float32Array([1, 2, 3, 4]),
      categories: ['keep', 'hide'], category: new Uint16Array([0, 1, 0, 1]),
      source: new Uint32Array([0, 1, 1, 2]), target: new Uint32Array([2, 0, 3, 0]) };
    value.graph.hiddenTypes = ['hide']; value.graph.selectedNodeIds = ['c']; value.graph.selectedEdgeIds = ['column-edge-3'];
    const nodes: unknown[] = [], edges: unknown[] = [];
    value.graph.addEventListener('lr-node-activate', (event) => nodes.push(event.detail));
    value.graph.addEventListener('lr-edge-activate', (event) => edges.push(event.detail));
    await fixture(value.graph); const engine = await mounted(value);
    expect([...engine.data.at(-1)!.source]).to.deep.equal([0, 1]); expect([...engine.data.at(-1)!.target]).to.deep.equal([1, 0]);
    expect([...engine.states.at(-1)!.selected!]).to.deep.equal([1, 3]);
    engine.callbacks().pick(1, { ctrl: false, shift: false, double: false });
    engine.callbacks().pick(3, { ctrl: false, shift: false, double: false });
    expect(nodes[0]).to.deep.equal({ nodeId: 'c', x: 3, y: 0, z: 0 });
    expect(edges[0]).to.deep.equal({ sourceNodeId: 'c', targetNodeId: 'a', edgeId: 'column-edge-3' });
    value.graph.hiddenTypes = ['keep']; await value.graph.updateComplete;
    engine.callbacks().pick(0, { ctrl: false, shift: false, double: false }); expect(nodes.length).to.equal(1);
    await settle(value.graph); expect(engine.data.at(-1)!.nodeCount).to.equal(2);
    expect([...engine.data.at(-1)!.source]).to.deep.equal([0]); expect([...engine.states.at(-1)!.selected!]).to.deep.equal([]);
    engine.callbacks().pick(0, { ctrl: false, shift: false, double: false });
    expect((nodes.at(-1) as { nodeId: string }).nodeId).to.equal('b');
  });

  it('revokes engine activation when an authoritative source replaces local data', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; await fixture(value.graph); const engine = await mounted(value);
    let activated = 0; value.graph.addEventListener('lr-node-activate', () => activated++);
    value.graph.graphSource = source(); await settle(value.graph);
    expect(engine.disposals()).to.equal(1); engine.callbacks().pick(0, { ctrl: false, shift: false, double: false }); expect(activated).to.equal(0);
    expect(value.graph.getNodePosition3d('local-a')).to.equal(undefined); expect(await value.graph.focusNode('remote')).to.equal(true);
  });
});

it('pans the WebGL camera through keyboard input without orbiting and reverses horizontal pan in RTL', async () => {
  const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; value.graph.camera = camera();
  await fixture(value.graph); const engine = await mounted(value);
  const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
  await focusByKeyboard(surface);
  const initial = engine.cameras.at(-1)!;
  surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true }));
  await settle(value.graph);
  const right = engine.cameras.at(-1)!;
  expect(right.target.x).to.be.lessThan(initial.target.x);
  expect(right.target.y).to.equal(initial.target.y); expect(right.target.z).to.equal(initial.target.z);
  expect([right.yaw, right.pitch, right.distance]).to.deep.equal([initial.yaw, initial.pitch, initial.distance]);
  surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true }));
  await settle(value.graph);
  expect(engine.cameras.at(-1)!.target.x).to.be.closeTo(initial.target.x, 1e-8);
  value.graph.setAttribute('dir', 'rtl'); await settle(value.graph);
  surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true }));
  await settle(value.graph);
  expect(engine.cameras.at(-1)!.target.x).to.be.greaterThan(initial.target.x);
});

it('places WebGL edge labels from live endpoints and stops drawing labels when disabled', async () => {
  const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d'; value.graph.camera = camera();
  value.graph.nodeLabels = 'none'; value.graph.withEdgeLabels = true; value.graph.edgeLabelMinZoom = 0.001;
  value.graph.edges = [{ id: 'span', source: 'local-a', target: 'local-b', label: 'Span' }, { id: 'loop', source: 'local-a', target: 'local-a', label: 'Loop' }];
  await fixture(value.graph); const engine = await mounted(value);
  const ctx = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('[data-graph-labels]')!.getContext('2d')!;
  const original = ctx.fillText, labels: { text: string; x: number; y: number; alpha: number }[] = [];
  ctx.fillText = function(text, x, y, maxWidth) { labels.push({ text, x, y, alpha: this.globalAlpha }); if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth); };
  try {
    engine.positions.set(0, { x: -20, y: 0, z: 0 }); engine.positions.set(1, { x: 20, y: 0, z: 0 });
    value.graph.camera = camera(); await settle(value.graph);
    const span = labels.find(label => label.text === 'Span'), loop = labels.find(label => label.text === 'Loop');
    expect(span !== undefined).to.equal(true); expect(loop !== undefined).to.equal(true);
    expect(loop!.y).to.be.lessThan(span!.y);
    labels.length = 0; engine.positions.set(1, { x: 120, y: 0, z: 0 });
    value.graph.dimmedEdgeIds = ['span']; await settle(value.graph);
    const moved = labels.find(label => label.text === 'Span');
    expect(moved !== undefined).to.equal(true); expect(moved!.x).to.be.greaterThan(span!.x);
    expect(moved!.alpha).to.be.lessThan(1); expect(ctx.globalAlpha).to.equal(1);
    labels.length = 0; value.graph.withEdgeLabels = false; await settle(value.graph);
    expect(labels.length).to.equal(0); expect(engine.disposals()).to.equal(0);
  } finally { ctx.fillText = original; }
});

it('places curved WebGL labels at the world curve midpoint after live endpoint movement', async () => {
  const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
  const view = { ...camera(), yaw: 0.6 }; value.graph.camera = view;
  value.graph.nodeLabels = 'none'; value.graph.withEdgeLabels = true; value.graph.edgeLabelMinZoom = 0.001;
  value.graph.edges = [{ id: 'curve', source: 'local-a', target: 'local-b', curvature: 0.5, label: 'Curve' }];
  await fixture(value.graph); const engine = await mounted(value);
  const canvas = value.graph.shadowRoot!.querySelector<HTMLCanvasElement>('[data-graph-labels]')!;
  const ctx = canvas.getContext('2d')!, original = ctx.fillText;
  const labels: { x: number; y: number }[] = [];
  ctx.fillText = function(text, x, y) { if (text === 'Curve') labels.push({ x, y }); original.call(this, text, x, y); };
  try {
    engine.positions.set(0, { x: 0, y: 0, z: 0 }); engine.positions.set(1, { x: 100, y: 0, z: 0 });
    value.graph.camera = { ...view }; await settle(value.graph);
    const surface = value.graph.shadowRoot!.querySelector<HTMLElement>('[data-webgl-host]')!;
    const expected = projectSpatialPoint({ x: 50, y: 0, z: 50 }, view, { width: surface.clientWidth, height: surface.clientHeight })!;
    expect(labels.length).to.be.greaterThan(0);
    expect(labels.at(-1)!.x).to.be.closeTo(expected.x, 1e-6);
    expect(engine.disposals()).to.equal(0);
  } finally { ctx.fillText = original; }
});

it('mounts and retires the visible WebGL surface when IntersectionObserver is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
  const value = setup();
  try {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: undefined });
    value.graph.engine = 'webgl'; value.graph.view = '3d';
    await fixture(value.graph); const engine = await mounted(value);
    expect(engine.data.at(-1)!.nodeCount).to.equal(2);
    value.graph.remove(); await nextFrame();
    expect(engine.disposals()).to.equal(1);
    const count = engine.cameras.length; value.graph.camera = { ...camera(), distance: 700 }; await settle(value.graph);
    expect(engine.cameras.length).to.equal(count);
  } finally {
    value.graph.remove();
    if (descriptor) Object.defineProperty(window, 'IntersectionObserver', descriptor);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  }
});

describe('graph optional engine lifecycle edges', () => {
  it('stops waiting for an unhidden surface once the view leaves 3d', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    const wrapper = document.createElement('div'); wrapper.hidden = true; wrapper.append(value.graph);
    await fixture(wrapper); await settle(value.graph);
    expect(value.loads(), 'the hidden graph stays cold').to.equal(0);

    value.graph.view = 'list'; await settle(value.graph);
    wrapper.hidden = false; await settle(value.graph);

    expect(value.loads(), 'a list view never creates a WebGL companion when the fence clears').to.equal(0);
    expect(value.graph.shadowRoot!.querySelector('[data-webgl-host]') === null).to.equal(true);
  });

  it('reports a lost context once and ignores a repeated loss while on the fallback', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    const descents: unknown[] = []; value.graph.addEventListener('lr-engine-fallback', (event) => descents.push(event.detail));
    await fixture(value.graph); const engine = await mounted(value);

    engine.callbacks().lost('context-lost'); await settle(value.graph);
    engine.callbacks().lost('context-lost'); await settle(value.graph);

    expect(descents).to.deep.equal([{ from: 'webgl', to: 'builtin', reason: 'context-lost' }]);
  });

  it('drops a pending fallback notice when the graph leaves the document before it is delivered', async () => {
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    const descents: unknown[] = []; value.graph.addEventListener('lr-engine-fallback', (event) => descents.push(event.detail));
    await fixture(value.graph); const engine = await mounted(value);

    engine.callbacks().lost('context-lost');
    value.graph.remove();
    await settle(value.graph); await nextFrame();

    expect(descents).to.deep.equal([]);
  });

  it('falls back with an error when a label color cannot be resolved through a canvas', async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    const value = setup(); value.graph.engine = 'webgl'; value.graph.view = '3d';
    const descents: { reason: string }[] = []; value.graph.addEventListener('lr-engine-fallback', (event) => descents.push(event.detail));
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
      // The 1x1 scratch canvas resolves CSS colors for the engine; labels use a separate canvas.
      if (this.width === 1 && this.height === 1) return null;
      return (original as (...rest: unknown[]) => unknown).apply(this, args);
    } as typeof HTMLCanvasElement.prototype.getContext;
    try {
      await fixture(value.graph);
      await waitUntil(() => descents.length > 0, 'the unusable color canvas retires the engine', { timeout: 3000 });

      expect(descents[0]!.reason).to.equal('error');
      expect(value.graph.shadowRoot!.querySelectorAll('canvas[part="spatial-canvas"]').length).to.equal(1);
      expect(value.graph.shadowRoot!.textContent).not.to.include('Color canvas unavailable');
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});
