import { expect, fixture, waitUntil, nextFrame } from '@open-wc/testing';
import { createEngine } from '@aceshooting/lyra-3d/graph';
import type { Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { GraphSpatialController } from './graph-spatial-controller.js';
import { LyraGraph } from './graph.js';
import { admitGraphNodeRenderer, type LyraGraphNodeMesh } from './graph-node-renderer.js';
void LyraGraph;
const mesh = (): LyraGraphNodeMesh => ({ positions: new Float32Array([0,0,0, .5,0,0, 0,.5,0]), normals: new Float32Array([0,0,1]) });
function setup(capabilities = true, admitMeshes?: (rows: readonly (LyraGraphNodeMesh | null)[] | undefined) => void, admission?: typeof admitGraphNodeRenderer) {
  const meshes: (readonly (LyraGraphNodeMesh | null)[] | undefined)[] = [], glows: boolean[] = [], appearances: unknown[] = [];
  let data = 0;
  const engine: Engine3dInstance & { setAppearance(value: unknown): void; setNodeMeshes?: (value: readonly (LyraGraphNodeMesh | null)[] | undefined) => void; setGlow?: (value: boolean) => Promise<void> } = {
    contract: 1, async mount() {}, setData() { data++; }, setAppearance(value) { appearances.push(value); }, setStyle() {}, resize() {}, setCamera() {}, dispose() {},
  };
  if (capabilities) { engine.setNodeMeshes = value => { admitMeshes?.(value); meshes.push(value); }; engine.setGlow = async value => { glows.push(value); }; }
  class Spatial extends GraphSpatialController { constructor(...args: ConstructorParameters<typeof GraphSpatialController>) { super(args[0], { ...args[1], engineServices: { available: () => true, create: async () => engine } }); }
    protected override admitNodeRenderer(...args: Parameters<typeof admitGraphNodeRenderer>): ReturnType<typeof admitGraphNodeRenderer> { return admission ? admission(...args) : super.admitNodeRenderer(...args); }
  }
  const graph = document.createElement('lr-graph') as LyraGraph;
  graph.style.cssText = 'display:block;inline-size:360px;block-size:280px'; graph.width = 360; graph.height = 280; graph.nodes = [{ id: 'a' }, { id: 'b' }];
  (graph as unknown as { loadSpatialController(): Promise<{ GraphSpatialController: typeof GraphSpatialController }> }).loadSpatialController = async () => ({ GraphSpatialController: Spatial });
  return { graph, meshes, glows, appearances, data: () => data };
}
async function mount(value: ReturnType<typeof setup>) { value.graph.engine = 'webgl'; value.graph.view = '3d'; await fixture(value.graph); await waitUntil(() => value.data() > 0); await nextFrame(); }
describe('graph custom node and glow opt-ins', () => {
  it('does not request optional capabilities by default', async () => { const value = setup(false); await mount(value); expect(value.graph.nodeRenderer).to.equal(undefined); expect(value.graph.glow).to.equal(false); expect(value.graph.shadowRoot!.querySelector('[part="engine-notice"]')).to.equal(null); });
  it('owns meshes and retains them across appearance and selection updates without callbacks', async () => {
    const value = setup(), original = mesh(); let calls = 0;
    value.graph.nodeRenderer = context => { calls++; expect(Object.isFrozen(context)).to.equal(true); expect(context.id).to.equal(context.index === 0 ? 'a' : 'b'); return original; };
    await mount(value); await waitUntil(() => value.meshes.some(rows => rows?.length === 2));
    original.positions[0] = .3; expect(value.meshes.at(-1)![0]!.positions[0]).to.equal(0);
    value.graph.selectedNodeIds = ['a']; await value.graph.updateComplete; await nextFrame(); expect(calls).to.equal(2);
    value.graph.nodeRenderer = undefined; await value.graph.updateComplete; await waitUntil(() => value.meshes.at(-1) === undefined);
  });
  it('rejects a whole callback batch once without fabricating engine fallback', async () => {
    const value = setup(); let errors = 0, fallbacks = 0;
    value.graph.addEventListener('lr-node-render-error', () => { errors++; }); value.graph.addEventListener('lr-engine-fallback', () => { fallbacks++; });
    value.graph.nodeRenderer = () => { throw new Error('private callback text'); };
    await mount(value); await waitUntil(() => errors === 1); expect(fallbacks).to.equal(0); expect(value.graph.shadowRoot!.textContent).not.to.contain('private callback text');
  });
  it('does not invoke callbacks in builtin or list paths', async () => { const value = setup(); let calls = 0; value.graph.nodeRenderer = () => { calls++; return mesh(); }; value.graph.view = 'list'; await fixture(value.graph); await value.graph.updateComplete; expect(calls).to.equal(0); });
  it('forwards glow enable and reset only when requested', async () => { const value = setup(); await mount(value); expect(value.glows).to.deep.equal([]); value.graph.glow = true; await value.graph.updateComplete; await waitUntil(() => value.glows.includes(true)); value.graph.glow = false; await value.graph.updateComplete; await waitUntil(() => value.glows.at(-1) === false); });
  it('stops a stale reentrant callback before invoking later rows', async () => {
    const value = setup(); let calls = 0, errors = 0;
    value.graph.addEventListener('lr-node-render-error', () => { errors++; });
    value.graph.nodeRenderer = () => { calls++; value.graph.nodeRenderer = undefined; return mesh(); };
    await mount(value); await nextFrame();
    expect(calls).to.equal(1); expect(errors).to.equal(0);
    expect(value.meshes.filter(rows => rows !== undefined).length).to.equal(0);
  });
  it('does not execute customization until a hidden engine surface becomes visible', async () => {
    const value = setup(); let calls = 0;
    value.graph.nodeRenderer = () => { calls++; return mesh(); };
    value.graph.engine = 'webgl'; value.graph.view = '3d'; value.graph.hidden = true;
    await fixture(value.graph); await value.graph.updateComplete; await nextFrame(); expect(calls).to.equal(0);
    value.graph.hidden = false; await value.graph.updateComplete;
    await waitUntil(() => calls === 2);
  });
  it('maps filtered typed identities without exposing record rows', async () => {
    const value = setup(); const contexts: { id: string; index: number; node?: unknown }[] = [];
    value.graph.graphColumns = { ids: ['hidden', 'kept'], source: new Uint32Array(), target: new Uint32Array(), category: new Uint16Array([0, 1]), categories: ['hide', 'keep'] };
    value.graph.hiddenTypes = ['hide'];
    value.graph.nodeRenderer = context => { contexts.push(context); return mesh(); };
    await mount(value); await waitUntil(() => contexts.length === 1);
    expect(contexts.map(context => ({ id: context.id, index: context.index, hasNode: Object.hasOwn(context, 'node') }))).to.deep.equal([{ id: 'kept', index: 0, hasNode: false }]);
    value.graph.nodeRenderer = null; await value.graph.updateComplete; await waitUntil(() => value.meshes.at(-1) === undefined);
  });

  it('reports an older companion customization capability without executing callbacks', async () => {
    const value = setup(false); let calls = 0, fallbacks = 0;
    value.graph.strings = { graphCustomNodesUnavailable: 'Custom geometry unavailable here' };
    value.graph.nodeRenderer = () => { calls++; return mesh(); };
    value.graph.addEventListener('lr-engine-fallback', () => { fallbacks++; });
    await mount(value); await nextFrame();
    expect(calls).to.equal(0); expect(fallbacks).to.equal(0);
    expect(value.graph.shadowRoot!.textContent).to.contain('Custom geometry unavailable here');
  });
  it('uses sanitized customized localization after a rejected callback batch', async () => {
    const value = setup(); value.graph.strings = { graphCustomNodesError: 'Geometry refused' };
    value.graph.nodeRenderer = () => ({ positions: new Float32Array([NaN,0,0, .5,0,0, 0,.5,0]), normals: new Float32Array([0,0,1]) });
    await mount(value); await waitUntil(() => value.graph.shadowRoot!.textContent!.includes('Geometry refused'));
    expect(value.graph.shadowRoot!.querySelector('[role="alert"], [role="status"]')).to.equal(null);
  });

  it('reports a real companion expanded primitive refusal as budget and retains the ordinary scene', async () => {
    const real = createEngine();
    const edgeCount = 124_999 + 14;
    const source = new Uint32Array(edgeCount), target = new Uint32Array(edgeCount).fill(1);
    const edgeCurvatures = new Float32Array(edgeCount); edgeCurvatures.fill(0.5, 0, 124_999);
    const value = setup(true, rows => real.setNodeMeshes(rows));
    const errors: string[] = []; let fallbacks = 0;
    value.graph.addEventListener('lr-node-render-error', event => { errors.push(event.detail.reason); });
    value.graph.addEventListener('lr-engine-fallback', () => { fallbacks++; });
    value.graph.nodeRenderer = context => context.index === 0 ? mesh() : null;
    try {
      real.setData({ nodeCount: 2, positions: new Float32Array([-40, 0, 0, 40, 0, 0]), source, target,
        spatialAppearance: { edgeCurvatures } }, 1);
      expect(typeof real.positionOf).to.equal('function');
      if (typeof real.positionOf !== 'function') throw new Error('Graph position capability is required');
      const positionOf = real.positionOf.bind(real);
      const before = positionOf(0);
      await mount(value); await waitUntil(() => errors.length === 1);
      expect(errors).to.deep.equal(['budget']);
      expect(fallbacks).to.equal(0); expect(value.data()).to.equal(1);
      expect(value.graph.view).to.equal('3d'); expect(value.graph.engine).to.equal('webgl');
      expect(value.graph.shadowRoot!.querySelector('[data-webgl-host]')?.hasAttribute('hidden')).to.equal(false);
      expect(positionOf(0)).to.deep.equal(before);
      value.graph.nodeRenderer = undefined; await value.graph.updateComplete; await nextFrame();
      expect(() => real.setNodeMeshes(undefined)).not.to.throw();
      expect(errors.length).to.equal(1); expect(fallbacks).to.equal(0);
    } finally { value.graph.remove(); real.dispose(); }
  });

  it('stops immediately when a callback switches the authored engine to builtin', async () => {
    const value = setup(); let calls = 0, errors = 0, fallbacks = 0;
    value.graph.nodeRenderer = () => { calls++; value.graph.engine = 'builtin'; return mesh(); };
    value.graph.addEventListener('lr-node-render-error', () => { errors++; });
    value.graph.addEventListener('lr-engine-fallback', () => { fallbacks++; });
    await mount(value); await nextFrame();
    expect(calls).to.equal(1);
    expect(value.meshes.filter(rows => rows !== undefined).length).to.equal(0);
    expect(errors).to.equal(0); expect(fallbacks).to.equal(0);
  });

  it('retires each held candidate before allocating the newest renderer generation', async () => {
    const held = new Promise<void>(() => {});
    const order: string[] = []; let active = 0, maximum = 0, generation = 0, errors = 0;
    const value = setup(true, undefined, async (...args) => {
      const owner = generation; active++; maximum = Math.max(maximum, active); order.push(`start:${owner}`);
      try { return await admitGraphNodeRenderer(args[0], args[1], args[2], args[3], () => held, args[5]); }
      finally { active--; order.push(`retire:${owner}`); }
    });
    value.graph.nodes = Array.from({ length: 129 }, (_, index) => ({ id: String(index) }));
    const renderer = (owner: number) => () => { order.push(`callback:${owner}`); return mesh(); };
    value.graph.nodeRenderer = renderer(0);
    value.graph.addEventListener('lr-node-render-error', () => { errors++; });
    try {
      await mount(value); await waitUntil(() => order.filter(item => item === 'callback:0').length === 128);
      for (generation = 1; generation <= 3; generation++) {
        value.graph.nodeRenderer = renderer(generation); await value.graph.updateComplete;
        const current = generation;
        await waitUntil(() => order.filter(item => item === `callback:${current}`).length === 128);
        expect(order.indexOf(`retire:${current - 1}`)).to.be.lessThan(order.indexOf(`start:${current}`));
      }
      value.graph.nodeRenderer = undefined; await value.graph.updateComplete; await waitUntil(() => active === 0);
      expect(maximum).to.equal(1); expect(errors).to.equal(0);
      expect(value.meshes.filter(rows => rows !== undefined).length).to.equal(0);
    } finally { value.graph.remove(); }
  });

});
