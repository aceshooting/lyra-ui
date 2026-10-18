import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraGraphScene, LyraGraphSceneRequest } from '../../../data-sources.js';
import { GraphSourceController, type GraphSceneIntent, type GraphSceneSource, type GraphSourceEdge } from './graph-source-controller.js';
import type { LyraGraphNode } from './graph-model.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

type Scene = LyraGraphScene<LyraGraphNode, GraphSourceEdge>;
const intent = (centerKey: string | null = null): GraphSceneIntent => ({ mode: 'neighborhood', centerKey, bounds: null, includeKeys: centerKey ? [centerKey] : [] });
function scene(id = 'a'): Scene {
  return { nodes: [{ key: `node:${id}`, value: { id, label: id }, position: { x: 1, y: 2 } }], edges: [],
    total: { nodes: 1_000_000, edges: 1_000_000 }, coverage: 'neighborhood', worldBounds: null };
}
function source(read: (request: LyraGraphSceneRequest) => Promise<Scene>): GraphSceneSource {
  return { revision: 1, scene: read, records: { revision: 1,
    query: async () => { throw new Error('Scene controller must not page records'); },
    lookup: async () => { throw new Error('Scene controller must not look up records'); },
    locate: async () => { throw new Error('Scene controller must not locate records'); },
  } };
}
interface HostFixture {
  readonly host: HTMLElement & ReactiveControllerHost;
  disconnect(): void;
  connect(owner?: Document): void;
}
const fixtures: HostFixture[] = [];
function makeHost(): HostFixture {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => { throw new Error('Use the named repaint callback'); }, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const fixture = { host,
    disconnect: () => { host.remove(); controllers.forEach(controller => controller.hostDisconnected?.()); },
    connect: (owner = document) => { owner.body.append(host); controllers.forEach(controller => controller.hostConnected?.()); },
  };
  fixtures.push(fixture);
  return fixture;
}
afterEach(() => { for (const fixture of fixtures.splice(0)) fixture.disconnect(); });

it('accepts one bounded scene for a million-node million-edge source without reading its record catalog', async () => {
  const fixture = makeHost(); let calls = 0; let request: LyraGraphSceneRequest | undefined;
  const raw: Scene = { nodes: Array.from({ length: 500 }, (_, index) => ({ key: `node:${index}`, value: { id: String(index), label: `Node ${index}` } })),
    edges: Array.from({ length: 1000 }, (_, index) => ({ key: `edge:${index}`, source: 'node:0', target: 'node:499', value: { id: String(index), source: '0', target: '499' } })),
    total: { nodes: 1_000_000, edges: 1_000_000 }, coverage: 'aggregate', worldBounds: { x: -100, y: -100, width: 200, height: 200 } };
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  expect(control.bind({ source: source(async value => { calls++; request = value; return raw; }), epoch: 0, locale: 'en' })).to.equal(true);
  expect(await control.request({ ...intent(), includeKeys: Array.from({ length: 32 }, (_, index) => `node:${index}`) })).to.equal(true);
  expect(control.state.scene?.nodes.length).to.equal(500);
  expect(control.state.scene?.edges.length).to.equal(1000);
  expect(control.state.scene?.total).to.deep.equal({ nodes: 1_000_000, edges: 1_000_000 });
  expect(control.state.scene === raw).to.equal(false);
  expect(Object.isFrozen(control.state.scene?.nodes[0]?.value)).to.equal(true);
  expect(request?.nodeLimit).to.equal(500); expect(request?.edgeLimit).to.equal(1000);
  expect(request?.includeKeys.length).to.equal(32);
  recordScaleMeasurement('lr-graph', 'n=1000000 bounded source scene', { sceneCalls: calls, acceptedNodes: control.state.scene!.nodes.length, acceptedEdges: control.state.scene!.edges.length, reservedKeys: request!.includeKeys.length });
});

it('rejects oversized arrays before reading any element and never invokes record accessors', async () => {
  const fixture = makeHost(); const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  let reads = 0;
  for (const [field, count] of [['nodes', 501], ['edges', 1001]] as const) {
    const values = new Array(count); Object.defineProperty(values, '0', { get: () => { reads++; throw new Error('oversized element'); } });
    control.bind({ source: source(async () => ({ ...scene(), [field]: values })), epoch: 0, locale: 'en' });
    expect(await control.request(intent())).to.equal(false); expect(control.state.error !== undefined).to.equal(true);
  }
  const bad = { ...scene(), nodes: [{ key: 'node:a', value: { id: 'a', get label() { reads++; return 'unsafe'; } } }] };
  control.bind({ source: source(async () => bad), epoch: 0, locale: 'en' });
  expect(await control.request(intent())).to.equal(false); expect(control.state.error !== undefined).to.equal(true);
  expect(reads).to.equal(0);
});

it('rejects ambiguous identities, dangling endpoints, invalid geometry and inconsistent complete totals', async () => {
  const fixture = makeHost(); const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  const edge = { key: 'edge:e', source: 'node:a', target: 'node:a', value: { id: 'e', source: 'a', target: 'a' } };
  const invalid: unknown[] = [
    { ...scene(), nodes: [scene().nodes[0], scene().nodes[0]] },
    { ...scene(), edges: [edge, edge] },
    { ...scene(), nodes: [{ key: 'node:wrong', value: { id: 'a' } }] },
    { ...scene(), edges: [{ ...edge, value: { source: 'a', target: 'a' } }] },
    { ...scene(), edges: [{ ...edge, target: 'node:missing' }] },
    { ...scene(), edges: [{ ...edge, value: { ...edge.value, target: 'missing' } }] },
    { ...scene(), coverage: 'complete' },
    { ...scene(), total: { nodes: -1, edges: 0 } },
    { ...scene(), worldBounds: { x: 0, y: 0, width: Infinity, height: 1 } },
    { ...scene(), nodes: [{ ...scene().nodes[0], position: { x: 1_000_001, y: 0 } }] },
    { ...scene(), nodes: [{ key: `node:${'x'.repeat(65_536)}`, value: { id: 'x'.repeat(65_536) } }] },
    { ...scene(), nodes: [{ key: 'node:a', value: { id: 'a', label: 'x'.repeat(65_537) } }] },
  ];
  for (const raw of invalid) {
    control.bind({ source: source(async () => raw as Scene), epoch: 0, locale: 'en' });
    expect(await control.request(intent())).to.equal(false); expect(control.state.error !== undefined).to.equal(true);
    expect(control.state.scene === undefined).to.equal(true);
  }
  const id = 'edge:arbitrary:名';
  control.bind({ source: source(async () => ({ ...scene(id), total: { nodes: 1, edges: 0 }, coverage: 'complete' })), epoch: 0, locale: 'en' });
  expect(await control.request(intent(`node:${id}`))).to.equal(true);
  expect(control.state.scene?.nodes[0]?.value.position).to.deep.equal({ x: 1, y: 2, z: 0 });
  control.bind({ source: source(async () => ({ nodes: [], edges: [], total: { nodes: 0, edges: 0 }, coverage: 'complete', worldBounds: null })), epoch: 0, locale: 'en' });
  expect(await control.request(intent())).to.equal(true); expect(control.state.scene?.nodes.length).to.equal(0);
});

it('bounds combined domain text and does not retain arbitrary provider metadata', async () => {
  const fixture = makeHost(); const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  const nodes = Array.from({ length: 31 }, (_, index) => ({ key: `node:${index}`, value: { id: String(index), label: 'x'.repeat(65_000), opaque: { secret: true } } }));
  control.bind({ source: source(async () => ({ ...scene(), nodes })), epoch: 0, locale: 'en' });
  expect(await control.request(intent())).to.equal(false); expect(control.state.error !== undefined).to.equal(true);
  nodes.pop();
  control.bind({ source: source(async () => ({ ...scene(), nodes })), epoch: 0, locale: 'en' });
  expect(await control.request(intent())).to.equal(true);
  expect(Object.hasOwn(control.state.scene!.nodes[0]!.value, 'opaque')).to.equal(false);
});

it('rejects excess reservations and invalid source metadata before invoking a provider', async () => {
  const fixture = makeHost(); let calls = 0;
  const provider = source(async () => { calls++; return scene(); });
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  control.bind({ source: provider, epoch: 0, locale: 'en' });
  for (const query of [{ ...intent(), includeKeys: Array.from({ length: 33 }, (_, i) => `node:${i}`) }, intent('edge:e'), { ...intent(), includeKeys: ['node:a', 'node:a'] }]) {
    expect(await control.request(query)).to.equal(false); expect(control.state.error !== undefined).to.equal(true);
  }
  expect(calls).to.equal(0);
  expect(control.bind({ source: { ...provider, revision: 2 }, epoch: 0, locale: 'en' })).to.equal(false);
  expect(control.state.error !== undefined).to.equal(true);
});

it('retains one physical callback and only the latest queued intent across cancellation and rebinding', async () => {
  const fixture = makeHost(); const pending: { request: LyraGraphSceneRequest; resolve: (value: Scene) => void }[] = [];
  const provider = source(request => new Promise(resolve => pending.push({ request, resolve })));
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  control.bind({ source: provider, epoch: 0, locale: 'en' });
  const first = control.request(intent('node:a')); await waitUntil(() => pending.length === 1);
  const second = control.request(intent('node:b'));
  expect(await first).to.equal(false); expect(pending[0]!.request.signal.aborted).to.equal(true);
  control.bind({ source: provider, epoch: 1, locale: 'fr' });
  const final = control.request(intent('node:c')); expect(await second).to.equal(false);
  expect(pending.length).to.equal(1);
  pending[0]!.resolve(scene('a')); await waitUntil(() => pending.length === 2);
  expect(pending[1]!.request.centerKey).to.equal('node:c'); expect(pending[1]!.request.locale).to.equal('fr');
  pending[1]!.resolve(scene('c')); expect(await final).to.equal(true);
  expect(control.state.scene?.nodes[0]?.value.id).to.equal('c');
});

it('preserves newer requests made by abort listeners and provider callbacks', async () => {
  const fixture = makeHost(); let release!: (value: Scene) => void; let signal!: AbortSignal; let calls = 0;
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  const provider = source(request => { calls++; signal = request.signal;
    return calls === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve(scene(request.centerKey!.slice(5)));
  });
  control.bind({ source: provider, epoch: 0, locale: 'en' });
  const old = control.request(intent('node:old')); await waitUntil(() => calls === 1);
  let latest!: Promise<boolean>;
  signal.addEventListener('abort', () => { latest = control.request(intent('node:newest')); }, { once: true });
  const obsolete = control.request(intent('node:outer'));
  expect(await old).to.equal(false); expect(await obsolete).to.equal(false);
  release(scene('old')); expect(await latest).to.equal(true);
  expect(control.state.scene?.nodes[0]?.value.id).to.equal('newest');
  let nested = false;
  control.bind({ source: source(async request => {
    if (!nested) { nested = true; latest = control.request(intent('node:redirect')); }
    return scene(request.centerKey!.slice(5));
  }), epoch: 0, locale: 'en' });
  expect(await control.request(intent('node:original'))).to.equal(false);
  expect(await latest).to.equal(true); expect(control.state.scene?.nodes[0]?.value.id).to.equal('redirect');
});

it('rejects late revision changes and reconnects or adopts without committing stale geometry', async () => {
  const fixture = makeHost(); const pending: { request: LyraGraphSceneRequest; resolve: (value: Scene) => void }[] = [];
  const provider = { ...source(request => new Promise(resolve => pending.push({ request, resolve }))) };
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  control.bind({ source: provider, epoch: 0, locale: 'en' });
  const old = control.request(intent()); await waitUntil(() => pending.length === 1);
  provider.revision = 2; pending[0]!.resolve(scene());
  expect(await old).to.equal(false); expect(control.state.error !== undefined).to.equal(true);
  provider.revision = 1;
  control.bind({ source: provider, epoch: 1, locale: 'en' });
  const detached = control.request(intent()); await waitUntil(() => pending.length === 2);
  fixture.disconnect(); expect(await detached).to.equal(false); expect(pending[1]!.request.signal.aborted).to.equal(true);
  expect(control.state.scene === undefined).to.equal(true);
  const owner = document.implementation.createHTMLDocument(); fixture.connect(owner); control.adopted();
  control.bind({ source: provider, epoch: 2, locale: 'en' });
  const current = control.request(intent('node:current')); pending[1]!.resolve(scene('stale'));
  await waitUntil(() => pending.length === 3); pending[2]!.resolve(scene('current'));
  expect(await current).to.equal(true); expect(control.state.scene?.nodes[0]?.value.id).to.equal('current');
});

it('reads array lengths through own descriptors without invoking proxy property reads', async () => {
  const fixture = makeHost(); let reads = 0;
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  const nodes = new Proxy([...scene().nodes], { get: (target, key, receiver) => { reads++; return Reflect.get(target, key, receiver); } });
  control.bind({ source: source(async () => ({ ...scene(), nodes })), epoch: 0, locale: 'en' });
  expect(await control.request(intent())).to.equal(true);
  expect(reads).to.equal(0);
});

it('preserves a newer source installed by abort while an invalid outer binding is rejected', async () => {
  const fixture = makeHost(); let release!: (value: Scene) => void; let signal!: AbortSignal;
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  control.bind({ source: source(request => { signal = request.signal; return new Promise(resolve => { release = resolve; }); }), epoch: 0, locale: 'en' });
  const old = control.request(intent()); await waitUntil(() => signal !== undefined);
  let latest!: Promise<boolean>;
  signal.addEventListener('abort', () => {
    control.bind({ source: source(async () => scene('newest')), epoch: 0, locale: 'en' });
    latest = control.request(intent('node:newest'));
  }, { once: true });
  const invalid = { ...source(async () => scene('invalid')), revision: Number.NaN };
  expect(control.bind({ source: invalid, epoch: 0, locale: 'en' })).to.equal(false);
  expect(await old).to.equal(false); release(scene('old'));
  expect(await latest).to.equal(true);
  expect(control.state.scene?.nodes[0]?.value.id).to.equal('newest');
});

for (const mutation of ['source-revision', 'records-revision', 'records-identity'] as const) {
  it(`rejects ${mutation} changes from a descriptor trap during scene projection`, async () => {
    const fixture = makeHost();
    const control = new GraphSourceController(fixture.host, { onChange: () => {} });
    let projected = false;
    const provider = { ...source(async () => raw) };
    const records = { ...provider.records };
    provider.records = records;
    const value = new Proxy({ id: 'a' }, { getOwnPropertyDescriptor: (target, key) => {
      if (!projected) {
        projected = true;
        if (mutation === 'source-revision') provider.revision = 2;
        else if (mutation === 'records-revision') records.revision = 2;
        else provider.records = { ...records };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    const raw: Scene = { ...scene(), nodes: [{ key: 'node:a', value }] };
    control.bind({ source: provider, epoch: 0, locale: 'en' });
    expect(await control.request(intent())).to.equal(false);
    expect(projected).to.equal(true);
    expect(control.state.scene === undefined).to.equal(true);
    expect(control.state.error !== undefined).to.equal(true);
  });
}

it('preserves newer source authority installed by the final revision read after projection', async () => {
  const fixture = makeHost();
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  let projected = false; let redirected = false; let latest: Promise<boolean> | undefined;
  const newest = source(async () => scene('newest'));
  const value = new Proxy({ id: 'a' }, { getOwnPropertyDescriptor: (target, key) => {
    projected = true;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const provider: GraphSceneSource = { ...source(async () => ({ ...scene(), nodes: [{ key: 'node:a', value }] })), get revision() {
    if (projected && !redirected) {
      redirected = true;
      control.bind({ source: newest, epoch: 0, locale: 'en' });
      latest = control.request(intent('node:newest'));
    }
    return 1;
  } };
  control.bind({ source: provider, epoch: 0, locale: 'en' });
  expect(await control.request(intent())).to.equal(false);
  expect(redirected).to.equal(true);
  expect(await latest).to.equal(true);
  expect(control.state.scene?.nodes[0]?.value.id).to.equal('newest');
  expect(control.state.error === undefined).to.equal(true);
});

it('does not invoke a scene method after its revision changes before dispatch', async () => {
  const fixture = makeHost(); let calls = 0;
  const provider = { ...source(async () => { calls++; return scene(); }) };
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  control.bind({ source: provider, epoch: 0, locale: 'en' });
  const accepted = control.request(intent());
  provider.revision = 2;
  expect(await accepted).to.equal(false);
  expect(calls).to.equal(0);
});

it('keeps the original method receiver and guards revision-getter reentry before dispatch', async () => {
  const fixture = makeHost(); let oldCalls = 0; let redirected = false; let dispatch = false; let latest: Promise<boolean> | undefined;
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  const newest: GraphSceneSource = { ...source(async () => scene('newest')), async scene() {
    expect(this === newest).to.equal(true); return scene('newest');
  } };
  const provider: GraphSceneSource = { ...source(async () => { oldCalls++; return scene('old'); }), get revision() {
    if (dispatch && !redirected) {
      redirected = true;
      control.bind({ source: newest, epoch: 0, locale: 'en' });
      latest = control.request(intent('node:newest'));
    }
    return 1;
  } };
  control.bind({ source: provider, epoch: 0, locale: 'en' });
  dispatch = true;
  expect(await control.request(intent())).to.equal(false);
  expect(await latest).to.equal(true);
  expect(oldCalls).to.equal(0);
  expect(control.state.scene?.nodes[0]?.value.id).to.equal('newest');
});

it('stops reading obsolete capabilities when the scene getter installs a newer binding', async () => {
  const fixture = makeHost(); let obsoleteReads = 0; let redirected = false;
  const control = new GraphSourceController(fixture.host, { onChange: () => {} });
  const newest = source(async () => scene('newest'));
  const records = { ...newest.records, get query() { obsoleteReads++; return newest.records.query; } };
  const provider: GraphSceneSource = { ...newest, records, get scene() {
    if (!redirected) { redirected = true; control.bind({ source: newest, epoch: 0, locale: 'en' }); }
    return newest.scene;
  } };
  expect(control.bind({ source: provider, epoch: 0, locale: 'en' })).to.equal(false);
  expect(obsoleteReads).to.equal(0);
  expect(await control.request(intent())).to.equal(true);
  expect(control.state.scene?.nodes[0]?.value.id).to.equal('newest');
});
