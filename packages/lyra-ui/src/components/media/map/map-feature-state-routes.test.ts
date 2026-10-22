import { expect } from '@open-wc/testing';
import { MapFeatureStateRoutes, type MapFeatureStateRoute } from './map-feature-state-routes.js';
import type { MapFeatureStatePeer, LyraMapFeatureIdentifier } from './map-feature-state.js';

const route = (extra: Partial<MapFeatureStateRoute> = {}): MapFeatureStateRoute => ({ origin: 'data-layer', source: 'roads', nativeSource: 'private-1', identity: 0, ...extra });
const target = (extra: Record<string, unknown> = {}) => ({ source: 'roads', id: 0, ...extra });
function fixture() {
  const routes = new MapFeatureStateRoutes(); const calls: unknown[][] = []; const source = {};
  const peer: MapFeatureStatePeer = { getSource: id => { calls.push(['get', id]); return source; },
    setFeatureState: (address, state) => { calls.push(['set', address, state]); },
    removeFeatureState: (address, key) => { calls.push(['remove', address, key]); } };
  return { routes, peer, calls };
}

describe('map feature-state logical routing', () => {
  it('retains numeric zero and string IDs separately and returns detached immutable desired data', () => {
    const { routes, peer, calls } = fixture(); expect(routes.configure([route()]).accepted).to.equal(true);
    const state = { selected: true, nested: { values: [1, 2] } };
    expect(routes.set(target(), state).accepted).to.equal(true); state.nested.values[0] = 99;
    routes.set(target({ id: '0' }), { selected: false });
    expect(routes.get(target())).to.deep.equal({ selected: true, nested: { values: [1, 2] } });
    expect(Object.isFrozen(routes.get(target())!['nested'])).to.equal(true);
    routes.replay(peer, 1); expect(calls.filter(row => row[0] === 'set').map(row => (row[1] as LyraMapFeatureIdentifier).id)).to.deep.equal([0, '0']); routes.dispose();
  });
  it('requires an origin for ambiguous public sources and rejects unknown identities atomically', () => {
    const { routes } = fixture(); routes.configure([route(), route({ origin: 'overlay', nativeSource: 'overlay' })]);
    expect(routes.set(target(), { selected: true }).accepted).to.equal(false);
    expect(routes.set(target({ origin: 'data-layer' }), { selected: true }).accepted).to.equal(true);
    expect(routes.resolve(target({ origin: 'data-layer' }))).to.deep.equal({ origin: 'data-layer', source: 'roads', id: 0 });
    expect(Object.isFrozen(routes.resolve(target({ origin: 'data-layer' })))).to.equal(true);
    expect(routes.set(target({ origin: 'basemap' }), { selected: false }).accepted).to.equal(false);
    expect(routes.get(target({ origin: 'data-layer' }))).to.deep.equal({ selected: true }); routes.dispose();
  });
  it('enforces exact vector source layers and never forwards an invalid target', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route({ sourceLayers: ['roads', 'bridges'] })]);
    for (const input of [target(), target({ sourceLayer: 'other' }), target({ sourceLayer: undefined })]) expect(routes.set(input, { hover: true }).accepted).to.equal(false);
    routes.set(target({ sourceLayer: 'bridges' }), { hover: true }); routes.replay(peer, 1);
    expect(calls.find(row => row[0] === 'set')?.[1]).to.deep.equal({ source: 'private-1', sourceLayer: 'bridges', id: 0 });
    routes.configure([route({ identity: 'geojson' })]); expect(routes.set(target({ sourceLayer: 'roads' }), {}).accepted).to.equal(false); routes.dispose();
  });
  it('preserves desired state through native ID/style remapping and clears changed semantic identities', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); routes.replay(peer, 1);
    routes.configure([route({ nativeSource: 'private-2' })]); routes.replay(peer, 1);
    expect(calls.filter(row => row[0] === 'set').map(row => (row[1] as LyraMapFeatureIdentifier).source)).to.deep.equal(['private-1', 'private-2']);
    routes.replay(peer, 2); expect(calls.filter(row => row[0] === 'set').length).to.equal(3);
    routes.configure([route({ nativeSource: 'private-2', identity: 'replacement' })]); expect(routes.get(target())).to.equal(undefined); routes.dispose();
  });
  it('preserves key-specific tombstones on the same peer/style and retries native failures', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true, unrelated: true }); routes.replay(peer, 1);
    routes.remove(target(), 'selected'); let failNextRemoval = true; const remove = peer.removeFeatureState;
    peer.removeFeatureState = (address, key) => { if (failNextRemoval) { failNextRemoval = false; throw new Error('private'); } return remove(address, key); };
    const failed = routes.replay(peer, 1);
    expect(failed.diagnostics.some(issue => issue.code === 'peer-error')).to.equal(true);
    expect(failed.diagnostics[0]!.target).to.deep.equal({ origin: 'data-layer', source: 'roads', id: 0 });
    expect(Object.isFrozen(failed.diagnostics[0]!.target)).to.equal(true);
    routes.replay(peer, 1); expect(calls.filter(row => row[0] === 'remove').map(row => row[2])).to.deep.equal(['selected']);
    expect(routes.get(target())).to.deep.equal({ unrelated: true }); routes.dispose();
  });
  it('keeps an unchanged source tombstone when another route is added or remapped', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); routes.replay(peer, 1); routes.remove(target());
    routes.configure([route(), route({ origin: 'overlay', source: 'other', nativeSource: 'other-native' })]); routes.replay(peer, 1);
    expect(calls.filter(row => row[0] === 'remove').map(row => row[2])).to.deep.equal(['selected']); routes.dispose();
  });
  it('restores clean state after physical same-ID replacement without discarding pending key removals', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true, hover: true }); routes.replay(peer, 1);
    routes.remove(target(), 'hover'); routes.refreshNative('data-layer', 'private-1'); routes.replay(peer, 1);
    expect(calls.filter(row => row[0] === 'remove').map(row => row[2])).to.deep.equal(['hover']);
    expect(calls.filter(row => row[0] === 'set').length).to.equal(2);
    routes.refreshNative('data-layer', 'private-1'); routes.replay(peer, 1); expect(calls.filter(row => row[0] === 'set').length).to.equal(3); routes.dispose();
  });
  it('invalidates only the matching origin/native source before native removal', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route(), route({ origin: 'overlay', source: 'other' })]);
    routes.set(target(), { selected: true }); routes.set({ source: 'other', id: 0 }, { selected: true });
    routes.invalidateNative('data-layer', 'private-1'); expect(routes.get(target())).to.equal(undefined);
    routes.replay(peer, 1); expect(calls.filter(row => row[0] === 'set').length).to.equal(1);
    expect(routes.set(target(), {}).accepted).to.equal(false); routes.dispose();
  });
  it('clears retired native owned keys across cancelled dataset preparation while preserving caller state', () => {
    const { routes, peer, calls } = fixture(); const native: Record<string, unknown> = { caller: 'retained' };
    peer.setFeatureState = (_address, state) => { Object.assign(native, state); };
    peer.removeFeatureState = (address, key) => { calls.push(['remove', address, key]); delete native[key]; };
    routes.configure([route()]); routes.set(target(), { selected: true, hover: true }); routes.replay(peer, 1);
    routes.remove(target(), 'hover'); routes.invalidateNative('data-layer', 'private-1'); routes.cancel();
    routes.configure([route({ identity: 'updated' })]);
    expect(routes.get(target())).to.equal(undefined); expect(native).to.deep.equal({ caller: 'retained', selected: true, hover: true });
    const replay = routes.replay(peer, 1);
    expect(replay.accepted).to.equal(true); expect(replay.applied).to.equal(1);
    expect(calls.filter(row => row[0] === 'remove').map(row => row[2])).to.deep.equal(['selected', 'hover']);
    expect(native).to.deep.equal({ caller: 'retained' }); routes.dispose();
  });
  it('retires old keys before replaying new desired state for the same native feature', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); routes.replay(peer, 1);
    routes.configure([route({ identity: 'updated' })]); routes.set(target(), { selected: false }); calls.length = 0;
    expect(routes.replay(peer, 1).accepted).to.equal(true);
    expect(calls.filter(row => row[0] !== 'get').map(row => row[0])).to.deep.equal(['remove', 'set']);
    expect(routes.get(target())).to.deep.equal({ selected: false }); routes.dispose();
  });
  it('retains retirement keys after native failure and stops mutations when ownership changes', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true, hover: true }); routes.replay(peer, 1);
    routes.invalidateNative('data-layer', 'private-1'); routes.configure([route({ identity: 'updated' })]);
    const remove = peer.removeFeatureState; let nested: unknown;
    peer.removeFeatureState = () => { nested = routes.configure([route()]); throw new Error('Private native failure'); };
    expect(routes.replay(peer, 1).code).to.equal('peer-error'); expect(nested).to.deep.equal({ accepted: false, code: 'reentrant' });
    let current = true; peer.removeFeatureState = (address, key) => { remove(address, key); current = false; };
    expect(routes.replay(peer, 1, undefined, () => current).code).to.equal('cancelled');
    expect(calls.filter(row => row[0] === 'remove').map(row => row[2])).to.deep.equal(['selected']);
    peer.removeFeatureState = remove;
    expect(routes.replay(peer, 1).accepted).to.equal(true);
    expect(calls.filter(row => row[0] === 'remove').map(row => row[2])).to.deep.equal(['selected', 'selected', 'hover']); routes.dispose();
  });
  it('does not apply old retirement keys to a new style generation or peer', () => {
    for (const replacePeer of [false, true]) {
      const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); routes.replay(peer, 1);
      routes.invalidateNative('data-layer', 'private-1'); routes.configure([route({ identity: 'updated' })]);
      const nextPeer = replacePeer ? { ...peer } : peer;
      expect(routes.replay(nextPeer, replacePeer ? 1 : 2).accepted).to.equal(true);
      expect(calls.filter(row => row[0] === 'remove').length).to.equal(0); routes.dispose();
    }
  });
  it('does not remove caller state from a replacement native source with the same ID', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); routes.replay(peer, 1);
    routes.invalidateNative('data-layer', 'private-1'); routes.configure([route({ identity: 'updated' })]);
    const replacement = {}; peer.getSource = () => replacement;
    const native: Record<string, unknown> = { selected: 'caller-owned' };
    peer.removeFeatureState = (address, key) => { calls.push(['remove', address, key]); delete native[key]; };
    expect(routes.replay(peer, 1).accepted).to.equal(true);
    expect(calls.filter(row => row[0] === 'remove').length).to.equal(0);
    expect(native).to.deep.equal({ selected: 'caller-owned' }); routes.dispose();
  });
  it('preflights retirement capacity atomically and permits retry after pending removals settle', () => {
    const { routes, peer } = fixture(); routes.configure([route()]);
    for (let id = 0; id < 1024; id++) expect(routes.set(target({ id }), { selected: true }).accepted).to.equal(true);
    routes.replay(peer, 1); routes.invalidateNative('data-layer', 'private-1'); routes.configure([route({ identity: 'next' })]);
    expect(routes.set(target({ id: 1024 }), { selected: true }).accepted).to.equal(true);
    expect(routes.configure([route({ identity: 'overflow' })])).to.deep.equal({ accepted: false, code: 'limit' });
    expect(routes.get(target({ id: 1024 }))).to.deep.equal({ selected: true });
    expect(() => routes.invalidateNative('data-layer', 'private-1')).to.throw('Feature-state retirement limit.');
    expect(routes.get(target({ id: 1024 }))).to.deep.equal({ selected: true });
    expect(routes.replay(peer, 1).accepted).to.equal(true);
    expect(routes.configure([route({ identity: 'overflow' })]).accepted).to.equal(true);
    expect(routes.get(target({ id: 1024 }))).to.equal(undefined); expect(routes.replay(peer, 1).accepted).to.equal(true); routes.dispose();
  });
  it('rejects accessor/sparse/duplicate route configuration without disturbing the previous snapshot', () => {
    const { routes } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); let reads = 0;
    const accessor = { ...route(), get nativeSource() { reads++; return 'bad'; } };
    for (const input of [[accessor], [route(), route()], new Array(1), [{ ...route(), identity: undefined }]]) expect(routes.configure(input).accepted).to.equal(false);
    expect(reads).to.equal(0); expect(routes.get(target())).to.deep.equal({ selected: true });
    expect(routes.set({ ...target(), get origin() { reads++; return 'data-layer'; } }, {}).accepted).to.equal(false);
    expect(reads).to.equal(0); routes.dispose();
  });
  it('rejects reentrant configuration and stops before native state writes after cancellation', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); let nested: unknown;
    peer.getSource = () => { nested = routes.configure([route({ nativeSource: 'stale' })]); routes.cancel(); return {}; };
    expect(routes.replay(peer, 1).code).to.equal('cancelled'); expect(nested).to.deep.equal({ accepted: false, code: 'reentrant' });
    expect(calls.filter(row => row[0] === 'set').length).to.equal(0); routes.dispose();
  });
  it('checks external ownership after native reads and before tombstone mutations', () => {
    const { routes, peer, calls } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); routes.replay(peer, 1); routes.remove(target());
    let current = true; peer.getSource = () => { current = false; return {}; };
    expect(routes.replay(peer, 1, undefined, () => current).code).to.equal('cancelled'); expect(calls.filter(row => row[0] === 'remove').length).to.equal(0);
    const signal = new AbortController(); signal.abort(); expect(routes.replay(peer, 1, signal.signal).code).to.equal('cancelled');
    routes.dispose(); expect(routes.set(target(), {}).code).to.equal('disposed');
  });
  it('rejects optional missing/accessor capabilities without reading them and keeps desired state for retry', () => {
    const { routes, peer } = fixture(); routes.configure([route()]); routes.set(target(), { selected: true }); let reads = 0;
    const bad = { getSource: peer.getSource, get setFeatureState() { reads++; return peer.setFeatureState; }, removeFeatureState: peer.removeFeatureState };
    expect(routes.replay(bad, 1).diagnostics.some(issue => issue.code === 'peer-error')).to.equal(true); expect(reads).to.equal(0);
    expect(routes.get(target())).to.deep.equal({ selected: true }); expect(routes.replay(peer, 1).applied).to.equal(1);
    routes.cancel(); expect(routes.replay(peer, 2, undefined, () => { throw new Error('private'); }).code).to.equal('cancelled'); routes.dispose();
  });
  it('cancels target reflection reentry before committing state and snapshots route arrays', () => {
    const { routes } = fixture(); const layers = ['roads']; const input = { ...route(), sourceLayers: layers };
    routes.configure([input]); layers[0] = 'changed'; input.nativeSource = 'changed';
    expect(routes.resolve(target({ sourceLayer: 'roads' }))?.sourceLayer).to.equal('roads');
    const reentrant = new Proxy(target({ sourceLayer: 'roads' }), {
      getOwnPropertyDescriptor(object, key) { if (key === 'id') routes.cancel(); return Reflect.getOwnPropertyDescriptor(object, key); },
    });
    expect(routes.set(reentrant, { selected: true }).accepted).to.equal(false); expect(routes.get(target({ sourceLayer: 'roads' }))).to.equal(undefined); routes.dispose();
  });
});
