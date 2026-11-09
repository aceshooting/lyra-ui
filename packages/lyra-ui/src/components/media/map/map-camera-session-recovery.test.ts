import { expect, fixtureCleanup } from '@open-wc/testing';
import { mapCameraSessionAttachment, type MapCameraSessionCallbacks } from '../../../internal/map-camera-session.js';
import { admitMapViewpoint } from '../../../internal/map-camera-session-data.js';
import { installCameraPeerEnvironment, mountCameraPeerMap, type CameraPeer } from '../../../../test/map-camera-peer.js';
import './map.js';

const target = admitMapViewpoint({ center: [12, 5], zoom: 6, bearing: 30, pitch: 40 });
const commands = (peer: CameraPeer) => peer.calls.filter(name => ['jumpTo', 'easeTo', 'flyTo'].includes(name));

async function setup(overrides: Partial<MapCameraSessionCallbacks> = {}) {
  const mounted = await mountCameraPeerMap();
  const completed: object[] = [];
  const attachment = mapCameraSessionAttachment(mounted.element)!;
  const callbacks = { complete: (action: object) => { completed.push(action); }, interrupt: () => {}, motion: () => {}, ...overrides };
  const lease = attachment.acquire(callbacks);
  return { ...mounted, attachment, callbacks, lease, completed };
}

describe('map camera session capability recovery', () => {
  let restore: () => void;
  beforeEach(() => { restore = installCameraPeerEnvironment(); });
  afterEach(() => { fixtureCleanup(); restore(); });

  for (const method of ['getCenter', 'getZoom', 'getBearing', 'getPitch'] as const) {
    for (const failure of ['invalid', 'throw', 'disconnect'] as const) {
      it(`rejects a capture when ${method} produces ${failure} without publishing a viewpoint`, async () => {
        const { element, peer, lease, completed } = await setup();
        const before = [element.center, element.zoom];
        const original = peer[method];
        Reflect.set(peer, method, () => {
          if (failure === 'throw') throw new Error('Camera unavailable');
          if (failure === 'disconnect') element.remove();
          if (failure === 'invalid') return method === 'getCenter' ? { lng: Number.NaN, lat: 0 } : Number.NaN;
          return Reflect.apply(original, peer, []);
        });
        expect(() => lease.capture()).to.throw('unavailable');
        expect([element.center, element.zoom]).to.deep.equal(before);
        expect(completed).to.deep.equal([]);
        expect(commands(peer)).to.deep.equal([]);
        Reflect.set(peer, method, original);
        if (failure !== 'disconnect') {
          expect(lease.capture()).to.deep.equal({ center: [0, 0], zoom: 2, bearing: 0, pitch: 0 });
          lease.release();
        } else expect(lease.current()).to.equal(false);
      });
    }
  }

  it('releases a failed initial capture so another owner can acquire the camera', async () => {
    const { peer, lease, attachment, callbacks } = await setup();
    lease.release();
    peer.pitch = Number.NaN;
    expect(() => attachment.acquire(callbacks)).to.throw('unavailable');
    peer.pitch = 25;
    const next = attachment.acquire(callbacks);
    expect(next.capture().pitch).to.equal(25);
    next.release();
    expect(() => next.capture()).to.throw('unavailable');
  });

  for (const method of ['isMoving', 'jumpTo', 'easeTo', 'flyTo', 'stop'] as const) {
    it(`rejects preparation when reading ${method} releases the owning session`, async () => {
      const { peer, lease } = await setup();
      const original = peer[method];
      Object.defineProperty(peer, method, { configurable: true, get() { lease.release(); return original; } });
      const kind = method === 'easeTo' || method === 'stop' ? 'ease' : method === 'flyTo' ? 'fly' : 'jump';
      try {
        expect(() => lease.prepare({}, target, { kind, duration: 10 })).to.throw('unavailable');
        expect(commands(peer)).to.deep.equal([]);
        expect(lease.current()).to.equal(false);
      } finally { Object.defineProperty(peer, method, { configurable: true, writable: true, value: original }); }
    });
  }

  for (const result of [undefined, 0, 'false']) {
    it(`rejects the non-boolean moving state ${String(result)} during preparation`, async () => {
      const { peer, lease } = await setup();
      const original = peer.isMoving;
      Reflect.set(peer, 'isMoving', () => result);
      expect(() => lease.prepare({}, target, { kind: 'jump' })).to.throw('unavailable');
      expect(commands(peer)).to.deep.equal([]);
      peer.isMoving = original;
      expect(lease.commit(lease.prepare({}, target, { kind: 'jump' }))).to.equal(true);
    });
  }

  it('admits only its own unused preparations and reserves one pending action at a time', async () => {
    const { peer, lease, completed } = await setup();
    const first = {}, second = {};
    const prepared = lease.prepare(first, target, { kind: 'jump' });
    expect(lease.commit({ ...prepared })).to.equal(false);
    expect(lease.start(second)).to.equal(true);
    expect(lease.start(first)).to.equal(false);
    expect(lease.commit(prepared)).to.equal(false);
    expect(commands(peer)).to.deep.equal([]);
    lease.retire(second, false);
    expect(lease.start(first)).to.equal(true);
    expect(lease.start(first)).to.equal(true);
    expect(lease.commit(prepared)).to.equal(true);
    expect(lease.commit(prepared)).to.equal(false);
    expect(completed).to.deep.equal([first]);
    expect(commands(peer)).to.deep.equal(['jumpTo']);
  });

  for (const method of ['isMoving', 'jumpTo', 'easeTo', 'flyTo', 'stop'] as const) {
    for (const failure of ['missing', 'throw', 'release'] as const) {
      it(`rejects a prepared command when ${method} becomes ${failure} before commit`, async () => {
        const { peer, lease, completed } = await setup();
        const kind = method === 'easeTo' || method === 'stop' ? 'ease' : method === 'flyTo' ? 'fly' : 'jump';
        const prepared = lease.prepare({}, target, { kind, duration: 10 });
        const original = peer[method];
        Object.defineProperty(peer, method, { configurable: true, get() {
          if (failure === 'throw') throw new Error('Capability unavailable');
          if (failure === 'release') lease.release();
          return failure === 'missing' ? undefined : original;
        } });
        try {
          expect(lease.commit(prepared)).to.equal(false);
          expect(completed).to.deep.equal([]);
          expect(commands(peer)).to.deep.equal([]);
          expect(peer.center).to.deep.equal([0, 0]);
        } finally { Object.defineProperty(peer, method, { configurable: true, writable: true, value: original }); }
        if (lease.current()) {
          expect(lease.commit(lease.prepare({}, target, { kind: 'jump' }))).to.equal(true);
          expect(peer.center).to.deep.equal([12, 5]);
        }
      });
    }
  }

  for (const failure of ['invalid-moving', 'throw-moving', 'release-moving', 'still-moving', 'lost-moving', 'release-stop'] as const) {
    it(`does not replace a moving camera after ${failure}`, async () => {
      const { peer, lease, completed } = await setup();
      const prepared = lease.prepare({}, target, { kind: 'jump' });
      const originalMoving = peer.isMoving, originalStop = peer.stop;
      let reads = 0;
      Reflect.set(peer, 'isMoving', () => {
        reads++;
        if (failure === 'invalid-moving') return 'false';
        if (failure === 'throw-moving') throw new Error('Movement unavailable');
        if (failure === 'release-moving') lease.release();
        return true;
      });
      peer.stop = () => {
        if (failure === 'lost-moving') Reflect.set(peer, 'isMoving', undefined);
        if (failure === 'release-stop') lease.release();
        return peer;
      };
      expect(lease.commit(prepared)).to.equal(false);
      expect(reads).to.be.greaterThan(0);
      expect(commands(peer)).to.deep.equal([]);
      expect(completed).to.deep.equal([]);
      peer.isMoving = originalMoving; peer.stop = originalStop;
      if (lease.current()) expect(lease.commit(lease.prepare({}, target, { kind: 'jump' }))).to.equal(true);
    });
  }

  for (const event of ['webglcontextlost', 'webglcontextrestored']) {
    it(`unwinds context listener registration if ${event} registration disconnects the map`, async () => {
      const { peer, element, lease, attachment, callbacks } = await setup();
      lease.release();
      const added: string[] = [], removed: string[] = [];
      const add = peer.canvas.addEventListener, remove = peer.canvas.removeEventListener;
      peer.canvas.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
        added.push(type); add.call(this, type, listener, options);
        if (type === event) element.remove();
      };
      peer.canvas.removeEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
        removed.push(type); remove.call(this, type, listener, options);
      };
      expect(() => attachment.acquire(callbacks)).to.throw('unavailable');
      expect(added).to.deep.equal(event === 'webglcontextlost' ? ['webglcontextlost'] : ['webglcontextlost', 'webglcontextrestored']);
      expect(removed).to.include.members(added);
      expect(commands(peer)).to.deep.equal([]);
    });
  }
});
