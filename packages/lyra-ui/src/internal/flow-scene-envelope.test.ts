import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraGraphSceneRequest, LyraGraphSource } from '../data-sources.js';
import type { FlowNode, FlowEdge } from '../components/data/flow-canvas/flow-types.js';
import { GraphSceneController, type GraphSceneIntent } from './graph-scene-controller.js';
import { flowSceneDomain } from './flow-scene-envelope.js';
type FlowSource = LyraGraphSource<FlowNode, FlowEdge>;

const area = { x: -100, y: -100, width: 200, height: 200 };
const intent = (): GraphSceneIntent => ({ mode: 'viewport', centerKey: null, bounds: area, includeKeys: [] });
function scene() {
  return { nodes: [{ key: 'node:a', position: { x: -20, y: 30 }, value: { id: 'a', type: 'task', accessibleLabel: 'Task A',
    data: { label: 'Visible A', description: 'Details', nested: { ready: true, amount: 4 }, list: [1, null, 'done'] },
    inputs: [{ id: 'in', label: 'Input' }], outputs: [{ id: 'out', label: 'Output' }], disabled: true } }],
  edges: [{ key: 'edge:e', source: 'node:a', target: 'node:a', value: { id: 'e', source: 'a', target: 'a', sourceHandle: 'out', targetHandle: 'in', label: 'Loop', tone: 'brand' as const } }],
  total: { nodes: 1_000_000, edges: 1_000_000 }, coverage: 'neighborhood' as const, worldBounds: area };
}
function source(read: (request: LyraGraphSceneRequest) => Promise<unknown>): FlowSource {
  return { revision: 1, scene: async request => await read(request) as Awaited<ReturnType<FlowSource['scene']>>, records: { revision: 1,
    query: async () => { throw new Error('Unexpected page query'); }, lookup: async () => { throw new Error('Unexpected lookup'); }, locate: async () => { throw new Error('Unexpected locate'); } } };
}
const cleanups: (() => void)[] = [];
function control(onChange = () => {}) {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), { addController: (value: ReactiveController) => controllers.add(value),
    removeController: (value: ReactiveController) => controllers.delete(value), requestUpdate: () => {}, updateComplete: Promise.resolve(true) }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  cleanups.push(() => { host.remove(); controllers.forEach(value => value.hostDisconnected?.()); });
  return new GraphSceneController(host, { onChange, domain: flowSceneDomain });
}
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

it('preserves finite positioned flow fields and detached deeply frozen metadata', async () => {
  const owner = control(); const raw = scene();
  owner.bind({ source: source(async () => raw), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(true);
  const node = owner.state.scene!.nodes[0]!.value;
  expect(Object.getOwnPropertyDescriptor(node, 'data')?.value).to.deep.equal(raw.nodes[0]!.value.data);
  expect(Object.getOwnPropertyDescriptor(node, 'inputs')?.value).to.deep.equal(raw.nodes[0]!.value.inputs);
  expect(Object.getOwnPropertyDescriptor(node, 'outputs')?.value).to.deep.equal(raw.nodes[0]!.value.outputs);
  expect(Object.getOwnPropertyDescriptor(node, 'disabled')?.value).to.equal(true);
  expect(owner.state.scene!.edges[0]!.value).to.deep.equal(raw.edges[0]!.value);
  expect(node.position).to.deep.equal({ x: -20, y: 30 });
});

it('requires viewport geometry and matching authored positions without local layout', async () => {
  const owner = control(); let calls = 0;
  owner.bind({ source: source(async () => { calls++; return scene(); }), epoch: 0, locale: 'en' });
  expect(await owner.request({ ...intent(), mode: 'neighborhood', bounds: null })).to.equal(false);
  expect(calls).to.equal(0);
  const raw = scene();
  for (const invalid of [
    { ...raw, worldBounds: null },
    { ...raw, nodes: [{ key: 'node:a', value: raw.nodes[0]!.value }] },
    { ...raw, nodes: [{ ...raw.nodes[0], value: { ...raw.nodes[0]!.value, position: { x: 0, y: 0 } } }] },
  ]) {
    owner.bind({ source: source(async () => invalid), epoch: 0, locale: 'en' });
    expect(await owner.request(intent())).to.equal(false);
    expect(owner.state.scene === undefined).to.equal(true);
  }
});

it('rejects cumulative flow metadata text before accepting a partial scene', async () => {
  const owner = control();
  const raw = scene();
  const nodes = Array.from({ length: 31 }, (_, i) => ({ key: `node:${i}`, position: { x: i, y: 0 }, value: { id: String(i), data: { label: 'x'.repeat(65_000) } } }));
  owner.bind({ source: source(async () => ({ ...raw, nodes, edges: [] })), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(false);
  expect(owner.state.scene === undefined).to.equal(true);
});

it('rejects accessor metadata without evaluating it', async () => {
  const owner = control(); const raw = scene(); let calls = 0;
  const data = { get label() { calls++; return 'Getter'; } };
  owner.bind({ source: source(async () => ({ ...raw, nodes: [{ ...raw.nodes[0], value: { ...raw.nodes[0]!.value, data } }] })), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(false);
  expect(calls).to.equal(0);
});

it('retains one ignored-abort physical call and only the latest viewport intent', async () => {
  const owner = control(); const pending: { request: LyraGraphSceneRequest; resolve: (value: unknown) => void }[] = [];
  const provider = source(request => new Promise(resolve => pending.push({ request, resolve })));
  owner.bind({ source: provider, epoch: 0, locale: 'en' });
  const old = owner.request(intent()); await waitUntil(() => pending.length === 1);
  const middle = owner.request({ ...intent(), bounds: { ...area, x: -90 } });
  const latest = owner.request({ ...intent(), bounds: { ...area, x: -80 } });
  expect(await old).to.equal(false); expect(await middle).to.equal(false);
  expect(pending.length).to.equal(1); expect(pending[0]!.request.signal.aborted).to.equal(true);
  pending[0]!.resolve(scene()); await waitUntil(() => pending.length === 2);
  expect(pending[1]!.request.bounds?.x).to.equal(-80);
  pending[1]!.resolve(scene()); expect(await latest).to.equal(true);
});

it('preserves shared cyclic metadata without retaining mutable provider objects', async () => {
  const owner = control(); const raw = scene();
  const shared: Record<string, unknown> = { label: 'Shared', nested: { ready: true }, list: [1, 2] };
  shared['self'] = shared;
  const nodes = ['a', 'b'].map(id => ({ key: `node:${id}`, position: { x: 1, y: 2 }, value: { id, data: shared } }));
  owner.bind({ source: source(async () => ({ ...raw, nodes, edges: [] })), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(true);
  const data = owner.state.scene!.nodes[0]!.value.data!;
  expect(data === shared).to.equal(false);
  expect(data === owner.state.scene!.nodes[1]!.value.data).to.equal(true);
  expect(data['self'] === data).to.equal(true);
  expect(Object.isFrozen(data)).to.equal(true);
  expect(Object.isFrozen(data['nested'])).to.equal(true);
  expect(Object.isFrozen(data['list'])).to.equal(true);
  shared['label'] = 'Changed'; expect(data['label']).to.equal('Shared');
});

it('rejects opaque leaves, duplicate handles, malformed fields, identities and geometry atomically', async () => {
  const owner = control(); const raw = scene(); const entry = raw.nodes[0]!; const value = entry.value; const edge = raw.edges[0]!;
  const invalid: unknown[] = [
    { ...raw, nodes: [entry, entry] }, { ...raw, edges: [edge, edge] },
    { ...raw, edges: [{ ...edge, source: 'node:missing' }] },
    { ...raw, edges: [{ ...edge, value: { ...edge.value, target: 'missing' } }] },
    { ...raw, nodes: [{ ...entry, key: 'node:wrong' }] },
    { ...raw, nodes: [{ ...entry, position: { x: 1_000_001, y: 0 } }] },
    { ...raw, nodes: [{ ...entry, position: { x: 0, y: Number.NaN } }] },
    { ...raw, worldBounds: { x: 1_000_000, y: 0, width: 1, height: 0 } },
    { ...raw, nodes: [{ ...entry, value: { ...value, inputs: [{ id: 'a' }, { id: 'a' }] } }] },
    { ...raw, nodes: [{ ...entry, value: { ...value, disabled: 'true' } }] },
    { ...raw, nodes: [{ ...entry, value: { ...value, data: { date: new Date(0) } } }] },
    { ...raw, nodes: [{ ...entry, value: { ...value, data: { callback: () => {} } } }] },
    { ...raw, nodes: [{ ...entry, value: { ...value, data: { count: Infinity } } }] },
    { ...raw, nodes: [{ ...entry, value: { ...value, data: { label: 'x'.repeat(65_537) } } }] },
    { ...raw, edges: [{ ...edge, value: { ...edge.value, tone: 'accent' } }] },
  ];
  for (const candidate of invalid) {
    owner.bind({ source: source(async () => candidate), epoch: 0, locale: 'en' });
    expect(await owner.request(intent())).to.equal(false);
    expect(owner.state.scene === undefined).to.equal(true);
    expect(owner.state.error !== undefined).to.equal(true);
  }
});

it('rejects oversized collections and metadata keys before reading their entries', async () => {
  const owner = control(); const raw = scene(); const entry = raw.nodes[0]!; let descriptors = 0;
  const handles = new Array(10_001);
  Object.defineProperty(handles, '0', { get: () => { descriptors++; return { id: 'a' }; } });
  const data = new Proxy(Object.fromEntries(Array.from({ length: 10_001 }, (_, i) => [`k${i}`, i])), {
    getOwnPropertyDescriptor: (target, key) => { descriptors++; return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  const nodes = new Array(501); Object.defineProperty(nodes, '0', { get: () => { descriptors++; return entry; } });
  const edges = new Array(1001); Object.defineProperty(edges, '0', { get: () => { descriptors++; return raw.edges[0]; } });
  for (const invalid of [
    { ...raw, nodes }, { ...raw, edges },
    { ...raw, nodes: [{ ...entry, value: { ...entry.value, inputs: handles } }] },
    { ...raw, nodes: [{ ...entry, value: { ...entry.value, data } }] },
  ]) {
    owner.bind({ source: source(async () => invalid), epoch: 0, locale: 'en' });
    expect(await owner.request(intent())).to.equal(false);
    expect(descriptors).to.equal(0);
  }
});

it('bounds metadata fields across roots and accepts the exact field and depth limits', async () => {
  const owner = control(); const raw = scene();
  const roots = Array.from({ length: 5 }, () => Object.fromEntries(Array.from({ length: 10_000 }, (_, i) => [`k${i}`, i])));
  const nodes = roots.map((data, i) => ({ key: `node:${i}`, position: { x: 0, y: 0 }, value: { id: String(i), data } }));
  owner.bind({ source: source(async () => ({ ...raw, nodes, edges: [] })), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(true);
  expect(Object.keys(owner.state.scene!.nodes[4]!.value.data!).length).to.equal(10_000);
  nodes.push({ key: 'node:5', position: { x: 0, y: 0 }, value: { id: '5', data: { extra: 1 } } });
  owner.bind({ source: source(async () => ({ ...raw, nodes, edges: [] })), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(false);
  const data: Record<string, unknown> = {}; let tail = data;
  for (let i = 0; i < 16; i++) { const child = {}; tail['child'] = child; tail = child; }
  tail['label'] = 'deep';
  const deep = () => ({ ...raw, nodes: [{ key: 'node:a', position: { x: 0, y: 0 }, value: { id: 'a', data } }], edges: [] });
  owner.bind({ source: source(async () => deep()), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(true);
  tail['child'] = {};
  owner.bind({ source: source(async () => deep()), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(false);
});

it('stops reflective metadata work as soon as a descriptor or key trap replaces the source', async () => {
  for (const boundary of ['descriptor', 'keys', 'prototype'] as const) {
    const owner = control(); const raw = scene(); let triggered = false; let later = 0; let latest: Promise<boolean> | undefined;
    const replacement = source(async () => scene());
    const redirect = () => {
      if (triggered) { later++; return; }
      triggered = true; owner.bind({ source: replacement, epoch: 0, locale: 'fr' }); latest = owner.request(intent());
    };
    const data = new Proxy({ label: 'Old', description: 'Obsolete' }, {
      getPrototypeOf: target => { if (boundary === 'prototype') redirect(); return Reflect.getPrototypeOf(target); },
      ownKeys: target => { if (boundary === 'keys') redirect(); return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor: (target, key) => { if (boundary === 'descriptor') redirect(); return Reflect.getOwnPropertyDescriptor(target, key); },
    });
    owner.bind({ source: source(async () => ({ ...raw, nodes: [{ ...raw.nodes[0], value: { ...raw.nodes[0]!.value, data } }] })), epoch: 0, locale: 'en' });
    expect(await owner.request(intent())).to.equal(false);
    expect(await latest).to.equal(true);
    expect(later).to.equal(0);
    expect(owner.state.scene!.nodes[0]!.value.data!['label']).to.equal('Visible A');
  }
});

it('requires flow scene points inside exact world bounds including degenerate axes', async () => {
  const owner = control(); const raw = scene();
  for (const position of [{ x: -101, y: 0 }, { x: 0, y: 101 }]) {
    owner.bind({ source: source(async () => ({ ...raw, nodes: [{ ...raw.nodes[0], position }] })), epoch: 0, locale: 'en' });
    expect(await owner.request(intent())).to.equal(false);
  }
  for (const [worldBounds, position] of [
    [{ x: -100, y: -100, width: 200, height: 200 }, { x: 100, y: -100 }],
    [{ x: -20, y: -30, width: 0, height: 100 }, { x: -20, y: 70 }],
    [{ x: -20, y: -30, width: 0, height: 0 }, { x: -20, y: -30 }],
  ] as const) {
    owner.bind({ source: source(async () => ({ ...raw, worldBounds, nodes: [{ ...raw.nodes[0], position }] })), epoch: 0, locale: 'en' });
    expect(await owner.request(intent())).to.equal(true);
  }
});

it('accepts exact node, edge, reservation and handle collection ceilings', async () => {
  const owner = control(); let request: LyraGraphSceneRequest | undefined;
  const raw = scene();
  const nodes = Array.from({ length: 500 }, (_, i) => ({ key: `node:${i}`, position: { x: i % 100, y: 0 }, value: { id: String(i) } }));
  const edges = Array.from({ length: 1000 }, (_, i) => ({ key: `edge:${i}`, source: 'node:0', target: 'node:499', value: { id: String(i), source: '0', target: '499' } }));
  owner.bind({ source: source(async value => { request = value; return { ...raw, nodes, edges }; }), epoch: 0, locale: 'en' });
  expect(await owner.request({ ...intent(), includeKeys: nodes.slice(0, 32).map(node => node.key) })).to.equal(true);
  expect(owner.state.scene!.nodes.length).to.equal(500); expect(owner.state.scene!.edges.length).to.equal(1000);
  expect(request?.includeKeys.length).to.equal(32);
  expect(await owner.request({ ...intent(), includeKeys: nodes.slice(0, 33).map(node => node.key) })).to.equal(false);
  const inputs = Array.from({ length: 10_000 }, (_, i) => ({ id: `h${i}` }));
  owner.bind({ source: source(async () => ({ ...raw, nodes: [{ key: 'node:a', position: { x: 0, y: 0 }, value: { id: 'a', inputs } }] })), epoch: 0, locale: 'en' });
  expect(await owner.request(intent())).to.equal(true);
  expect(owner.state.scene!.nodes[0]!.value.inputs?.length).to.equal(10_000);
  expect(Object.isFrozen(owner.state.scene!.nodes[0]!.value.inputs)).to.equal(true);
});
