import { expect } from '@open-wc/testing';
import { MapFeatureStateStore } from './map-feature-state.js';

const target = (id: string | number = 0, sourceLayer?: string) => ({ source: 'roads', id, ...(sourceLayer === undefined ? {} : { sourceLayer }) });
function fixture() {
  const store = new MapFeatureStateStore(); store.setSources([{ source: 'roads', identity: 'dataset-a' }]);
  const calls: unknown[][] = [];
  const peer = { getSource: (_id: string): unknown => ({}), setFeatureState: (id: unknown, state: unknown) => { calls.push(['set', id, state]); }, removeFeatureState: (id: unknown, key: string) => { calls.push(['remove', id, key]); } };
  return { store, peer, calls };
}
describe('map retained feature state', () => {
  it('keeps numeric zero, string zero and vector source layers distinct', () => {
    const { store, peer, calls } = fixture();
    for (const id of [target(0), target('0'), target(0, 'bridges')]) expect(store.set(id, { selected: true }).accepted).to.equal(true);
    expect(store.replay(peer, 1).applied).to.equal(3); expect(calls.map((row) => row[1])).to.deep.equal([target(0), target('0'), target(0, 'bridges')]);
    expect(store.replay(peer, 1).applied).to.equal(0);
  });
  it('merges detached frozen values and removes only owned keys', () => {
    const { store, peer, calls } = fixture(); const input = { selected: true, nested: { values: [1, 2] } };
    store.set(target(), input); input.nested.values[0] = 99;
    expect(store.get(target())).to.deep.equal({ selected: true, nested: { values: [1, 2] } });
    expect(Object.isFrozen(store.get(target())!['nested'])).to.equal(true);
    store.replay(peer, 1); store.set(target(), { hover: true }); store.remove(target(), 'selected'); store.replay(peer, 1);
    expect(calls.some((row) => row[0] === 'remove' && row[2] === 'selected')).to.equal(true);
    expect(store.get(target())).to.deep.equal({ nested: { values: [1, 2] }, hover: true });
    store.remove(target()); store.replay(peer, 1); expect(store.get(target())).to.equal(undefined);
    expect(calls.filter((row) => row[0] === 'remove').map((row) => row[2])).to.deep.equal(['selected', 'nested', 'hover']);
  });
  it('rejects getters, polluted prototypes, cyclic values and overlarge writes atomically', () => {
    const { store } = fixture(); store.set(target(), { selected: true }); let reads = 0;
    const getter = Object.defineProperty({}, 'selected', { enumerable: true, get() { reads++; return false; } });
    const cycle: Record<string, unknown> = {}; cycle['self'] = cycle;
    for (const bad of [getter, Object.create({ selected: true }), cycle, { text: 'x'.repeat(4097) }, Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i]))]) expect(store.set(target(), bad).accepted).to.equal(false);
    expect(reads).to.equal(0); expect(store.get(target())).to.deep.equal({ selected: true });
    expect(store.set({ source: 'roads', id: NaN }, {}).accepted).to.equal(false);
  });
  it('replays retained state on a new style but drops it when source identity changes', () => {
    const { store, peer, calls } = fixture(); store.set(target(), { selected: true }); store.replay(peer, 1); store.replay(peer, 2);
    expect(calls.length).to.equal(2);
    store.setSources([{ source: 'roads', identity: 'dataset-a' }]); expect(store.get(target())).to.deep.equal({ selected: true });
    store.setSources([{ source: 'roads', identity: 'dataset-b' }]); expect(store.get(target())).to.equal(undefined); expect(store.replay(peer, 3).applied).to.equal(0);
  });
  it('retains desired writes and removals after partial peer failure for retry', () => {
    const { store, peer, calls } = fixture(); store.set(target(), { selected: true });
    const failing = { ...peer, setFeatureState() { throw new Error('peer detail'); } };
    expect(store.replay(failing, 1).diagnostics[0]?.code).to.equal('peer-error'); expect(store.get(target())).to.deep.equal({ selected: true });
    expect(store.replay(peer, 1).applied).to.equal(1); store.remove(target());
    const remove = peer.removeFeatureState; let once = true; peer.removeFeatureState = (id, key) => { if (once) { once = false; throw new Error('partial'); } remove(id, key); };
    expect(store.replay(peer, 1).diagnostics[0]?.code).to.equal('peer-error'); expect(store.replay(peer, 1).applied).to.equal(1); expect(calls.at(-1)?.[0]).to.equal('remove');
  });
  it('stops after abort, cancellation or source invalidation during peer callbacks', () => {
    for (const action of ['abort', 'cancel', 'source', 'dispose']) {
      const { store, peer, calls } = fixture(); const controller = new AbortController(); store.set(target(0), { a: 1 }); store.set(target(1), { a: 2 });
      peer.setFeatureState = (id, state) => { calls.push(['set', id, state]); if (action === 'abort') controller.abort(); else if (action === 'cancel') store.cancel(); else if (action === 'source') store.invalidateSource('roads'); else store.dispose(); };
      expect(store.replay(peer, 1, controller.signal).diagnostics.some((item) => item.code === 'cancelled')).to.equal(true); expect(calls.length).to.equal(1);
    }
  });
  it('rejects recursive mutations before reflection and does not commit after proxy cancellation', () => {
    const { store, peer } = fixture(); store.set(target(), { a: 1 });
    peer.setFeatureState = () => { expect(store.set(target(), { a: 2 }).code).to.equal('reentrant'); };
    store.replay(peer, 1); expect(store.get(target())).to.deep.equal({ a: 1 });
    const input = new Proxy({ b: 2 }, { ownKeys(value) { store.cancel(); return Reflect.ownKeys(value); } });
    expect(store.set(target(), input).code).to.equal('cancelled'); expect(store.get(target())).to.deep.equal({ a: 1 });
    store.dispose(); expect(store.set(target(), {}).code).to.equal('disposed');
  });
  it('caps retained entries and rejects invalid source replacement without clearing state', () => {
    const { store } = fixture(); for (let id = 0; id < 1024; id++) expect(store.set(target(id), { a: 1 }).accepted).to.equal(true);
    expect(store.set(target(1024), { a: 1 }).code).to.equal('limit');
    expect(store.setSources([{ source: 'roads', identity: 1 }, { source: 'roads', identity: 2 }]).accepted).to.equal(false);
    expect(store.get(target())).to.deep.equal({ a: 1 });
  });
  it('keeps tombstones after cancellation of the same style and retries missing sources', () => {
    const { store, peer, calls } = fixture(); store.set(target(), { selected: true, hover: true }); store.replay(peer, 1);
    store.remove(target(), 'selected'); store.set(target(), { hover: false });
    const write = peer.setFeatureState; let fail = true;
    peer.setFeatureState = (id, state) => { if (fail) { fail = false; throw new Error('partial'); } write(id, state); };
    expect(store.replay(peer, 1).diagnostics[0]?.code).to.equal('peer-error'); store.cancel();
    peer.getSource = () => undefined;
    expect(store.replay(peer, 1).diagnostics[0]?.code).to.equal('missing-source');
    peer.getSource = () => ({}); expect(store.replay(peer, 1).applied).to.equal(1);
    expect(calls.filter((row) => row[0] === 'remove').map((row) => row[2])).to.deep.equal(['selected', 'selected']);
    expect(store.get(target())).to.deep.equal({ hover: false });
  });
  it('never invokes accessor-backed peer capabilities or a function after reflection cancellation', () => {
    const { store, peer, calls } = fixture(); store.set(target(), { selected: true }); let reads = 0;
    const accessor = Object.defineProperty({ ...peer }, 'getSource', { get() { reads++; store.cancel(); return peer.getSource; } });
    expect(store.replay(accessor, 1).code).to.equal('invalid-input'); expect(reads).to.equal(0); expect(calls.length).to.equal(0);
    const proxy = new Proxy(peer, { getOwnPropertyDescriptor(value, key) { store.cancel(); return Reflect.getOwnPropertyDescriptor(value, key); } });
    expect(store.replay(proxy, 1).code).to.equal('cancelled'); expect(calls.length).to.equal(0);
  });

});

describe('map retained feature state boundaries', () => {
  const stateKeys = (prefix: string, count: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`${prefix}${index}`, index]));
  const nested = (levels: number) => { let value: Record<string, unknown> = { leaf: 1 }; for (let level = 0; level < levels; level++) value = { child: value }; return value; };

  it('rejects foreign identity members and oversized or malformed state without disturbing retained state', () => {
    const { store } = fixture(); store.set(target(), { kept: true });
    expect(store.set({ source: 'roads', id: 0, origin: 'basemap' }, { a: 1 }).code).to.equal('invalid-input');
    const invalid: Record<string, unknown> = {
      'nesting beyond eight levels': nested(8),
      'more than 1024 nodes': Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`k${index}`, new Array(20).fill(index)])),
      'an array above 256 entries': { rows: new Array(257).fill(0) },
      'a sparse array': { rows: [1, , 3] },
      'an array with an extra member': { rows: Object.assign([1, 2], { extra: true }) },
    };
    for (const [name, state] of Object.entries(invalid)) expect(store.set(target(), state), name).to.deep.equal({ accepted: false, code: 'invalid-input' });
    expect(store.set(target(1), nested(7)).accepted).to.equal(true);
    expect(store.set(target(2), { rows: new Array(256).fill(0) }).accepted).to.equal(true);
    expect(store.get(target())).to.deep.equal({ kept: true });
  });

  it('replaces logical sources only from a bounded list of exact source rows', () => {
    const { store } = fixture(); store.set(target(), { kept: true });
    for (const list of ['roads', {}, null]) expect(store.setSources(list).code, String(list)).to.equal('invalid-input');
    expect(store.setSources(Array.from({ length: 257 }, (_, index) => ({ source: `s${index}`, identity: index }))).code).to.equal('limit');
    for (const row of [{ source: 'roads' }, { source: 'roads', identity: 1, extra: true }, { source: 'roads', other: 1 }, { identity: 1 }, { source: 'roads', identity: undefined }, null]) {
      expect(store.setSources([row]).code, JSON.stringify(row)).to.equal('invalid-input');
    }
    expect(store.get(target())).to.deep.equal({ kept: true });
  });

  it('abandons a source replacement cancelled while its rows are being read', () => {
    const { store } = fixture(); store.set(target(), { kept: true });
    const rows = new Proxy([{ source: 'roads', identity: 'dataset-a' }], {
      getOwnPropertyDescriptor(object, key) { store.cancel(); return Reflect.getOwnPropertyDescriptor(object, key); },
    });
    expect(store.setSources(rows).code).to.equal('cancelled');
    expect(store.get(target())).to.deep.equal({ kept: true });
  });

  it('counts removed keys toward the per-feature key budget', () => {
    const { store } = fixture();
    expect(store.set(target(), stateKeys('first', 40)).accepted).to.equal(true);
    expect(store.remove(target()).accepted).to.equal(true);
    expect(store.set(target(), stateKeys('second', 25))).to.deep.equal({ accepted: false, code: 'limit' });
    expect(store.get(target())).to.equal(undefined);
    expect(store.set(target(), stateKeys('second', 24)).accepted).to.equal(true);
    expect(Object.keys(store.get(target())!).length).to.equal(24);
  });

  it('rejects state for an unknown logical source and ignores an empty patch on an untouched feature', () => {
    const { store, peer, calls } = fixture();
    expect(store.set({ source: 'unknown', id: 0 }, { a: 1 }).code).to.equal('unknown-source');
    expect(store.set(target(9), {})).to.deep.equal({ accepted: true });
    expect(store.get(target(9))).to.equal(undefined);
    expect(store.replay(peer, 1).applied).to.equal(0);
    expect(calls.length).to.equal(0);
  });

  it('validates removal keys, ignores absent features and stops when cancelled while reading the target', () => {
    const { store, peer, calls } = fixture(); store.set(target(), { a: 1 });
    for (const property of ['', '__proto__', 'x'.repeat(257), 5 as unknown as string]) expect(store.remove(target(), property).code, String(property)).to.equal('invalid-input');
    expect(store.remove(target(7), 'a')).to.deep.equal({ accepted: true });
    const cancelling = new Proxy(target(), { getOwnPropertyDescriptor(object, key) { store.cancel(); return Reflect.getOwnPropertyDescriptor(object, key); } });
    expect(store.remove(cancelling).code).to.equal('cancelled');
    expect(store.get(target())).to.deep.equal({ a: 1 });
    store.replay(peer, 1);
    expect(calls.some(row => row[0] === 'remove')).to.equal(false);
  });

  it('reports a replay whose signal is already aborted without touching the peer', () => {
    const { store, peer, calls } = fixture(); store.set(target(), { a: 1 });
    const controller = new AbortController(); controller.abort();
    const result = store.replay(peer, 1, controller.signal);
    expect(result.code).to.equal('cancelled');
    expect(result.applied).to.equal(0);
    expect(result.diagnostics.map(item => item.code)).to.deep.equal(['cancelled']);
    expect(calls.length).to.equal(0);
    expect(store.replay(peer, 1).applied).to.equal(1);
  });

  it('rejects a peer whose capability members are not callable functions', () => {
    const { store, peer } = fixture(); store.set(target(), { a: 1 });
    for (const broken of [{ ...peer, getSource: 1 }, { ...peer, setFeatureState: 'set' }, { ...peer, removeFeatureState: null }]) {
      expect(store.replay(broken as never, 1).code).to.equal('invalid-input');
    }
    expect(store.replay(peer, 1).applied).to.equal(1);
  });

  it('drops key tombstones of an emptied feature when the style generation changes', () => {
    const { store, peer, calls } = fixture(); store.set(target(), { a: 1 }); store.replay(peer, 1);
    store.remove(target());
    expect(store.replay(peer, 2).applied).to.equal(0);
    expect(calls.filter(row => row[0] === 'remove').length).to.equal(0);
    expect(store.get(target())).to.equal(undefined);
  });

  it('stops a replay cancelled while the peer resolves a source', () => {
    const { store, peer, calls } = fixture(); store.set(target(), { a: 1 });
    peer.getSource = () => { store.cancel(); return {}; };
    const result = store.replay(peer, 1);
    expect(result.code).to.equal('cancelled');
    expect(result.applied).to.equal(0);
    expect(calls.length).to.equal(0);
  });
});
