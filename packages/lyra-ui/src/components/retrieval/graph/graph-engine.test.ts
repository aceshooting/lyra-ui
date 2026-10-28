import { expect } from '@open-wc/testing';
import { admitGraphEngineColumns, graphEngineColumnScene } from './graph-engine-columns.js';
import { GraphEngineAdapter } from './graph-engine-adapter.js';
import type { Engine3dInstance } from '../../../internal/engine-3d-loader.js';

function columns(count = 10001) { return { ids: Array.from({ length: count }, (_, row) => `node-${row}`), source: new Uint32Array([0]), target: new Uint32Array([count - 1]) }; }
function fake() {
  let disposals = 0;
  const engine: Engine3dInstance = { contract: 1, async mount() {}, setData() {}, setStyle() {}, setCamera() {}, resize() {}, dispose() { disposals++; } };
  Object.assign(engine, { setAppearance() {} });
  return { engine, disposals: () => disposals };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function request(extra = {}) { return { preference: 'webgl', eligible: true, visible: true, container: document.createElement('div'), host: { hover() {}, pick() {}, camera() {}, lost() {} }, failure() {}, ...extra }; }

describe('graph engine column seam', () => {
  it('keeps more than 10k rows and materializes only a bounded late page', () => {
    const input = columns(); const result = admitGraphEngineColumns(input); expect(result.ok).to.equal(true); if (!result.ok) return;
    expect(result.value.data.nodeCount).to.equal(10001); expect(result.value.row('node-10000')).to.equal(10000);
    expect(result.value.item(10001)).to.deep.equal({ kind: 'edge', row: 0, source: 'node-0', target: 'node-10000' });
    const page = result.value.page(50); expect(page.rows.length).to.equal(2); expect(page.rows[0]).to.deep.equal({ kind: 'node', row: 10000, id: 'node-10000', label: 'node-10000' });
    expect(result.value.data.source).to.equal(input.source);
  });
  it('validates coordinates without changing caller buffers and preserves partial axes', () => {
    const input = { ...columns(2), x: new Float32Array([1e7, -1e7]) };
    const result = admitGraphEngineColumns(input); expect(result.ok).to.equal(true); if (!result.ok) return;
    expect([...result.value.data.positions!]).to.deep.equal([1e7, 0, 0, -1e7, 0, 0]); expect([...input.x]).to.deep.equal([1e7, -1e7]);
    expect(admitGraphEngineColumns({ ...input, x: new Float32Array([1e7 + 1, 0]) }).ok).to.equal(false);
    expect(admitGraphEngineColumns({ ...input, ids: ['same', 'same'] }).ok).to.equal(false);
  });
});

describe('filtered graph engine column scene', () => {
  it('keeps every admitted row beyond 10k and materializes only the requested 200-row page', () => {
    const result = admitGraphEngineColumns(columns()); expect(result.ok).to.equal(true); if (!result.ok) return;
    const scene = graphEngineColumnScene(result.value, []);
    expect(scene.data.nodeCount).to.equal(10001); expect(scene.itemCount).to.equal(10002);
    expect(scene.nodeRows[10000]).to.equal(10000); expect(scene.nodeIndex('node-10000')).to.equal(10000);
    expect(scene.data.positions).to.equal(undefined); expect(scene.data.spatialAppearance.sizeUnits).to.equal('world');
    expect(scene.data.spatialAppearance.nodeShapes[10000]).to.equal(0);
    const page = scene.page(50); expect(page.rows.length).to.equal(2);
    expect(page.rows[1]).to.deep.equal({ kind: 'edge', row: 0, source: 'node-0', target: 'node-10000' });
    expect(scene.page(0).rows.length).to.equal(200);
  });

  it('filters typed names and incident edges with dense indices and original row identities', () => {
    const input = { ids: ['a', 'b', 'c', 'd'], x: new Float32Array([1, 2, 3, 4]), size: new Float32Array([12, 14, 16, 18]),
      category: new Uint16Array([0, 1, 0, 1]), categories: ['keep', 'hide'], labels: ['A', 'B', 'C', 'D'],
      source: new Uint32Array([0, 0, 1, 2]), target: new Uint32Array([2, 1, 3, 0]), edgeCategory: new Uint16Array([1, 0, 1, 0]) };
    const result = admitGraphEngineColumns(input); expect(result.ok).to.equal(true); if (!result.ok) return;
    const filtered = graphEngineColumnScene(result.value, ['hide']);
    expect([...filtered.nodeRows]).to.deep.equal([0, 2]); expect([...filtered.edgeRows]).to.deep.equal([0, 3]);
    expect([...filtered.data.source]).to.deep.equal([0, 1]); expect([...filtered.data.target]).to.deep.equal([1, 0]);
    expect([...filtered.data.positions!]).to.deep.equal([1, 0, 0, 3, 0, 0]); expect([...filtered.data.sizes!]).to.deep.equal([12, 16]);
    expect([...filtered.data.categories!]).to.deep.equal([0, 0]); expect([...filtered.data.edgeCategories!]).to.deep.equal([1, 0]);
    expect(filtered.categoryNames).to.deep.equal(['keep', 'hide']); expect(filtered.data.labels).to.deep.equal(['A', 'C']);
    expect(filtered.nodeIndex('a')).to.equal(0); expect(filtered.nodeIndex('b')).to.equal(undefined); expect(filtered.nodeIndex('c')).to.equal(1);
    expect(filtered.item(1)).to.deep.equal({ kind: 'node', row: 2, id: 'c', label: 'C' });
    expect(filtered.item(3)).to.deep.equal({ kind: 'edge', row: 3, source: 'c', target: 'a' });
    expect([...input.source]).to.deep.equal([0, 0, 1, 2]); expect([...input.target]).to.deep.equal([2, 1, 3, 0]);
    expect([...input.x]).to.deep.equal([1, 2, 3, 4]); expect([...input.size]).to.deep.equal([12, 14, 16, 18]);
    const cleared = graphEngineColumnScene(result.value, ['keep', 'hide']);
    expect(cleared.data.nodeCount).to.equal(0); expect(cleared.itemCount).to.equal(0); expect(cleared.page(999).rows.length).to.equal(0);
    expect(cleared.nodeIndex('a')).to.equal(undefined); expect(cleared.item(0)).to.equal(undefined);
    const restored = graphEngineColumnScene(result.value, []); expect(restored.data.nodeCount).to.equal(4); expect(restored.edgeRows.length).to.equal(4);
    expect(filtered.nodeRows.length).to.equal(2); expect(filtered.itemCount).to.equal(4);
  });

  it('preserves parallel and self-edge identities and leaves unnamed categories visible', () => {
    const input = { ...columns(2), category: new Uint16Array([0, 1]), source: new Uint32Array([0, 0, 1]), target: new Uint32Array([1, 1, 1]) };
    const result = admitGraphEngineColumns(input); expect(result.ok).to.equal(true); if (!result.ok) return;
    const scene = graphEngineColumnScene(result.value, ['0', '1']);
    expect([...scene.edgeRows]).to.deep.equal([0, 1, 2]); expect(scene.item(3)?.row).to.equal(1);
    expect(scene.item(-1)).to.equal(undefined); expect(scene.item(1.5)).to.equal(undefined); expect(scene.item(5)).to.equal(undefined);
  });

  it('bounds world diameters at admission without changing input sizes', () => {
    const size = new Float32Array([20_000_000, 0]);
    expect(admitGraphEngineColumns({ ...columns(2), size }).ok).to.equal(true);
    expect(admitGraphEngineColumns({ ...columns(2), size: new Float32Array([20_000_002, 0]) }).ok).to.equal(false);
    expect([...size]).to.deep.equal([20_000_000, 0]);
  });
});

describe('graph engine lifecycle seam', () => {
  it('does not probe or load for unset, hidden or ineligible requests', async () => {
    let loads = 0, probes = 0;
    const adapter = new GraphEngineAdapter({ create: async () => { loads++; return fake().engine; }, available: () => { probes++; return true; } });
    for (const extra of [{ preference: undefined }, { visible: false }, { eligible: false }]) await adapter.open(request(extra));
    expect(loads).to.equal(0); expect(probes).to.equal(0); adapter.close();
  });
  it('probes before loading and reports stable missing-peer reasons', async () => {
    const reasons: string[] = []; let loads = 0;
    const adapter = new GraphEngineAdapter({ create: async () => { loads++; return null; }, available: () => false });
    await adapter.open(request({ failure: (reason: string) => reasons.push(reason) })); expect(loads).to.equal(0); expect(reasons).to.deep.equal(['unsupported']);
    const missing = new GraphEngineAdapter({ create: async () => null, available: () => true });
    await missing.open(request({ failure: (reason: string) => reasons.push(reason) })); expect(reasons).to.deep.equal(['unsupported', 'unavailable']);
  });
  it('disposes a stale load and a disconnected pending mount exactly once', async () => {
    const loaded = deferred<Engine3dInstance | null>(); const first = fake(); const adapter = new GraphEngineAdapter({ create: () => loaded.promise, available: () => true });
    const pending = adapter.open(request()); adapter.close(); loaded.resolve(first.engine); expect(await pending).to.equal(null); expect(first.disposals()).to.equal(1);
    const mounted = deferred<void>(); const second = fake(); second.engine.mount = () => mounted.promise;
    const next = new GraphEngineAdapter({ create: async () => second.engine, available: () => true });
    const mount = next.open(request()); await Promise.resolve(); next.close(); mounted.resolve(); expect(await mount).to.equal(null); next.close(); expect(second.disposals()).to.equal(1);
  });
  it('drops obsolete host callbacks after replacement and maps mount failure', async () => {
    const old = fake(); let host: Parameters<Engine3dInstance['mount']>[1] | undefined; let cameras = 0;
    old.engine.mount = async (_container, callbacks) => { host = callbacks; };
    const adapter = new GraphEngineAdapter({ create: async () => old.engine, available: () => true });
    await adapter.open(request({ host: { hover() {}, pick() {}, camera() { cameras++; }, lost() {} } }));
    host!.camera({}); adapter.close(); host!.camera({}); expect(cameras).to.equal(1);
    const broken = fake(); broken.engine.mount = async () => { throw new Error('private detail'); }; const reasons: string[] = [];
    const failure = new GraphEngineAdapter({ create: async () => broken.engine, available: () => true });
    await failure.open(request({ failure: (reason: string) => reasons.push(reason) })); expect(reasons).to.deep.equal(['error']); expect(broken.disposals()).to.equal(1);
  });
});

 describe('graph adapter reentrancy', () => {
  it('does not download after a probe closes its request', async () => {
    let loads = 0; let adapter: GraphEngineAdapter;
    adapter = new GraphEngineAdapter({ available() { adapter.close(); return true; }, create: async () => { loads++; return null; } });
    expect(await adapter.open(request())).to.equal(null); expect(loads).to.equal(0);
  });
  it('propagates host errors from mount instead of reporting an engine fallback', async () => {
    const marker = new Error('host callback'); const value = fake(); let failures = 0;
    value.engine.mount = async (_container, host) => { host.camera({}); };
    const adapter = new GraphEngineAdapter({ available: () => true, create: async () => value.engine });
    let caught: unknown; try { await adapter.open(request({ host: { hover() {}, pick() {}, camera() { throw marker; }, lost() {} }, failure() { failures++; } })); } catch (error) { caught = error; }
    expect(caught).to.equal(marker); expect(failures).to.equal(0); expect(value.disposals()).to.equal(1);
  });
});


it('rejects a companion without paint transactions instead of resetting its data for style changes', async () => {
  const value = fake(); let mounts = 0; value.engine.mount = async () => { mounts++; };
  delete (value.engine as Engine3dInstance & { setAppearance?: unknown }).setAppearance;
  const reasons: string[] = []; const adapter = new GraphEngineAdapter({ available: () => true, create: async () => value.engine });
  expect(await adapter.open(request({ failure: (reason: string) => reasons.push(reason) }))).to.equal(null);
  expect(mounts).to.equal(0); expect(value.disposals()).to.equal(1); expect(reasons).to.deep.equal(['unavailable']);
});


it('projects clamped curvature by original edge rows without mutating borrowed columns', () => {
  const edgeCurvature = new Float32Array([-4, 0.25, -0.5, 4]);
  const input = { ids: ['a', 'b', 'c'], category: new Uint16Array([0, 1, 0]), categories: ['keep', 'hide'],
    source: new Uint32Array([0, 0, 1, 2]), target: new Uint32Array([2, 1, 2, 0]), edgeCurvature };
  const admitted = admitGraphEngineColumns(input); expect(admitted.ok).to.equal(true); if (!admitted.ok) return;
  const scene = graphEngineColumnScene(admitted.value, ['hide']);
  const curves = (scene.data as unknown as { edgeCurvature?: Float32Array }).edgeCurvature;
  expect(curves instanceof Float32Array).to.equal(true);
  expect(Array.from(curves ?? [])).to.deep.equal([-1, 1]); expect([...scene.edgeRows]).to.deep.equal([0, 3]);
  expect([...edgeCurvature]).to.deep.equal([-4, 0.25, -0.5, 4]); expect(curves === edgeCurvature).to.equal(false);
  expect(scene.item(3)).to.deep.equal({ kind: 'edge', row: 3, source: 'c', target: 'a' });
  const straight = admitGraphEngineColumns(columns(2)); if (!straight.ok) return;
  expect((graphEngineColumnScene(straight.value, []).data as unknown as { edgeCurvature?: Float32Array }).edgeCurvature).to.equal(undefined);
});
