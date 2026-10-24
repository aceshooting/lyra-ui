import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { GraphSourceController, type GraphSceneIntent, type GraphSceneSource } from '../components/retrieval/graph/graph-source-controller.js';

function setup() {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (value: ReactiveController) => controllers.add(value), removeController: (value: ReactiveController) => controllers.delete(value),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new GraphSourceController(host, { onChange: () => {} });
  return { control, dispose: () => { host.remove(); controllers.forEach(value => value.hostDisconnected?.()); } };
}
const scene = () => ({ nodes: [], edges: [], total: { nodes: 0, edges: 0 }, coverage: 'complete' as const, worldBounds: null });
const intent: GraphSceneIntent = { mode: 'neighborhood', centerKey: null, bounds: null, includeKeys: [] };
function source(read: GraphSceneSource['scene'] = async () => scene()): GraphSceneSource {
  return { revision: 1, scene: read, records: { revision: 1,
    query: async () => { throw new Error('Unexpected catalog query'); }, lookup: async () => [], locate: async () => null,
  } };
}

for (const [name, raw] of [
  ['null response', null], ['non-array nodes', { ...scene(), nodes: {} }],
  ['non-array edges', { ...scene(), edges: null }], ['unknown coverage', { ...scene(), coverage: 'sample' }],
] as const) it(`rejects a ${name} atomically and recovers with a current provider`, async () => {
  const test = setup();
  try {
    test.control.bind({ source: source(async () => raw as ReturnType<typeof scene>), epoch: 0, locale: 'en' });
    expect(await test.control.request(intent)).to.equal(false);
    expect(test.control.state.scene).to.equal(undefined); expect(test.control.state.error !== undefined).to.equal(true);
    test.control.bind({ source: source(), epoch: 1, locale: 'en' });
    expect(await test.control.request(intent)).to.equal(true);
    expect(test.control.state.error).to.equal(undefined); expect(test.control.state.scene?.coverage).to.equal('complete');
  } finally { test.dispose(); }
});

for (const [name, query] of [
  ['unknown mode', { ...intent, mode: 'all' }],
  ['neighborhood with viewport bounds', { ...intent, bounds: { x: 0, y: 0, width: 1, height: 1 } }],
  ['viewport without bounds', { ...intent, mode: 'viewport' }],
] as const) it(`rejects ${name} before invoking the scene provider`, async () => {
  const test = setup(); let reads = 0;
  try {
    test.control.bind({ source: source(async () => { reads++; return scene(); }), epoch: 0, locale: 'en' });
    expect(await test.control.request(query as GraphSceneIntent)).to.equal(false);
    expect(reads).to.equal(0); expect(test.control.state.pending).to.equal(false);
    expect(test.control.state.error !== undefined).to.equal(true);
  } finally { test.dispose(); }
});

it('rejects null source and non-string locale bindings without retaining the preceding scene', async () => {
  const test = setup();
  try {
    test.control.bind({ source: source(), epoch: 0, locale: 'en' });
    expect(await test.control.request(intent)).to.equal(true);
    for (const binding of [{ source: null, epoch: 1, locale: 'en' }, { source: source(), epoch: 2, locale: 42 }]) {
      expect(Reflect.apply(test.control.bind, test.control, [binding])).to.equal(false);
      expect(test.control.state.scene).to.equal(undefined); expect(test.control.state.error !== undefined).to.equal(true);
      expect(await test.control.request(intent)).to.equal(false);
    }
  } finally { test.dispose(); }
});
