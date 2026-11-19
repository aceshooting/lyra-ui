import { expect } from '@open-wc/testing';
import { PANORAMA_DEFAULT_CAMERA, type LyraMediaProjection, type LyraPanoramaCamera, type LyraPanoramaHotspot } from './media-panorama.js';
import { PanoramaPropertyState } from './media-panorama-host.js';
import type { Engine3dPreference } from './engine-3d.js';

function probe() {
  const calls: string[] = [];
  const host = {
    ownerDocument: document,
    requestUpdate: (name?: PropertyKey, old?: unknown) => { calls.push(`update ${String(name)} ${JSON.stringify(old)}`); },
  };
  const state = new PanoramaPropertyState(host, () => { calls.push('invalidate'); });
  return { calls, state };
}

describe('PanoramaPropertyState', () => {
  it('normalizes projection and engine, ignoring unchanged writes and enabling only equirectangular WebGL', () => {
    const { calls, state } = probe();
    expect([state.projection, state.engine, state.enabled]).to.deep.equal(['flat', 'builtin', false]);
    state.setProjection('flat');
    state.setProjection('bogus' as LyraMediaProjection);
    state.setEngine('builtin');
    expect(calls, 'normalized to the current values').to.deep.equal([]);
    state.setProjection('equirectangular');
    expect(state.enabled).to.equal(false);
    state.setEngine('webgl');
    expect([state.projection, state.engine, state.enabled]).to.deep.equal(['equirectangular', 'webgl', true]);
    state.setEngine('other' as Engine3dPreference);
    expect(calls).to.deep.equal([
      'invalidate', 'update projection "flat"',
      'invalidate', 'update engine "builtin"',
      'invalidate', 'update engine "webgl"',
    ]);
  });

  it('normalizes authored camera writes silently, skips equal ones, and lets the newest reentrant write win', () => {
    const { calls, state } = probe();
    expect(state.camera === PANORAMA_DEFAULT_CAMERA).to.equal(true);
    state.setCamera({ ...PANORAMA_DEFAULT_CAMERA });
    expect(calls).to.deep.equal([]);
    state.setCamera({ yaw: 1, pitch: 0, fieldOfView: 500 });
    expect(state.camera.fieldOfView).to.equal(100);
    let reentered = false;
    const reentrant = new Proxy<LyraPanoramaCamera>({ yaw: 0.5, pitch: 0, fieldOfView: 60 }, {
      getOwnPropertyDescriptor(target, key) {
        if (!reentered) { reentered = true; state.setCamera({ yaw: 2, pitch: 0, fieldOfView: 50 }); }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    state.setCamera(reentrant);
    expect([state.camera.yaw, state.camera.fieldOfView]).to.deep.equal([2, 50]);
    expect(calls).to.have.length(2);
    const adopted = Object.freeze({ yaw: 0.25, pitch: 0.1, fieldOfView: 40 });
    state.adoptCamera(adopted);
    expect([state.camera === adopted, calls.length]).to.deep.equal([true, 3]);
  });

  it('snapshots hotspots once per source, invalidating, and lets the newest reentrant write win', () => {
    const { calls, state } = probe();
    const source: LyraPanoramaHotspot[] = [{ id: 'a', yaw: 0, pitch: 0, label: 'A' }];
    state.setHotspots(source);
    const snapshot = state.hotspots;
    expect([snapshot === source, Object.isFrozen(snapshot), snapshot.map(spot => spot.id)]).to.deep.equal([false, true, ['a']]);
    state.setHotspots(source);
    state.setHotspots(snapshot);
    expect(calls).to.deep.equal(['invalidate', 'update hotspots []']);
    const newest: LyraPanoramaHotspot[] = [{ id: 'n', yaw: 0, pitch: 0, label: 'N' }];
    let reentered = false;
    const reentrant = new Proxy<LyraPanoramaHotspot[]>([{ id: 'r', yaw: 0, pitch: 0, label: 'R' }], {
      getOwnPropertyDescriptor(target, key) {
        if (!reentered) { reentered = true; state.setHotspots(newest); }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    state.setHotspots(reentrant);
    expect(state.hotspots.map(spot => spot.id)).to.deep.equal(['n']);
  });

  it('snapshots hotspots without an owner realm', () => {
    const calls: string[] = [];
    const state = new PanoramaPropertyState({ ownerDocument: null, requestUpdate: () => { calls.push('update'); } }, () => undefined);
    state.setHotspots([{ id: 'a', yaw: 0, pitch: 0 }]);
    expect([state.hotspots.map(spot => spot.id), calls]).to.deep.equal([['a'], ['update']]);
  });
});
