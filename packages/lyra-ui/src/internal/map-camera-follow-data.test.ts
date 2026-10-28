import { expect } from '@open-wc/testing';
import { admitMapCameraFollowOptions, admitMapCameraFollowProfile, createMapCameraFollowAttempt, observeMapCameraFollowAttempt } from './map-camera-follow-data.js';

function facts() {
  return { latitude: 0, zoom: 8, pitch: 60, width: 640, height: 480, projectionTransition: 1,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }, explicitBounds: false, explicitZoomLimits: false,
    nativeBounds: false, nativeMinZoom: -2, nativeMaxZoom: 22, terrain: false,
    canPan: true, canObserveMotion: true, canStop: true, moving: false, hasProjection: true };
}
function observation(frame: number, residual: number) { return { frame, point: [320 + residual, 240] as const, width: 640, height: 480 }; }
const latitudeAdjustment = (latitude: number) => Math.log2(Math.cos(Math.min(Math.abs(latitude), 85.051129) * Math.PI / 180));

describe('map camera follow profile and correction budget', () => {
  it('admits explicit modes with the agreed scene ID grammar without normalization', () => {
    for (const mode of ['ground', 'geographic-visual'] as const) {
      for (const objectId of ['a', '  Station α  ', 'A/B# [node]', 'x'.repeat(1024), '😀'.repeat(512)]) {
        expect(admitMapCameraFollowOptions({ mode, objectId })).to.deep.equal({ mode, objectId });
      }
    }
    for (const objectId of ['', '   ', '\n\t', 'x'.repeat(1025), '😀'.repeat(513), 42]) {
      expect(() => admitMapCameraFollowOptions({ mode: 'ground', objectId })).to.throw();
    }
  });
  it('requires an explicit mode and snapshots finite optional axes using viewpoint conventions', () => {
    expect(() => admitMapCameraFollowOptions({ objectId: 'a' })).to.throw();
    expect(() => admitMapCameraFollowOptions(Object.assign(Object.create({ mode: 'ground' }), { objectId: 'a' }))).to.throw();
    expect(() => admitMapCameraFollowOptions({ objectId: 'a', mode: 'automatic' })).to.throw();
    const input = { objectId: 'a', mode: 'ground', zoom: -5, bearing: 540, pitch: 85 };
    const admitted = admitMapCameraFollowOptions(input); input.zoom = 9;
    expect(admitted).to.deep.equal({ objectId: 'a', mode: 'ground', zoom: -5, bearing: -180, pitch: 85 });
    expect(Object.isFrozen(admitted)).to.equal(true);
    for (const change of [{ zoom: Infinity }, { bearing: NaN }, { pitch: 85.001 }, { pitch: -1 }]) {
      expect(() => admitMapCameraFollowOptions({ objectId: 'a', mode: 'ground', ...change })).to.throw();
    }
  });
  it('rejects accessor and unknown follow fields without invoking caller code', () => {
    let reads = 0; const input = { objectId: 'a', mode: 'ground' };
    Object.defineProperty(input, 'objectId', { get() { reads++; return 'a'; } });
    expect(() => admitMapCameraFollowOptions(input)).to.throw(); expect(reads).to.equal(0);
    expect(() => admitMapCameraFollowOptions({ objectId: 'a', mode: 'ground', fallback: 'ground' })).to.throw();
  });
  it('distinguishes Mercator control from every positive projection transition', () => {
    for (const transition of [0.5, 1, Number.MIN_VALUE]) {
      expect(admitMapCameraFollowProfile({ ...facts(), projectionTransition: transition })).to.deep.equal({ status: 'admitted', helper: 'globe' });
    }
    expect(admitMapCameraFollowProfile({ ...facts(), projectionTransition: 0 })).to.deep.equal({ status: 'admitted', helper: 'mercator' });
  });
  it('uses the native latitude clamp and exact inward equatorial domain', () => {
    for (const latitude of [-90, -85.051129, 0, 85.051129, 90]) {
      for (const equatorial of [4, 20]) {
        const input = { ...facts(), latitude, zoom: equatorial + latitudeAdjustment(latitude) };
        expect(admitMapCameraFollowProfile(input).status).to.equal('admitted');
      }
    }
    for (const zoom of [4 - 1e-9, 20 + 1e-9]) {
      expect(admitMapCameraFollowProfile({ ...facts(), zoom })).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
    }
  });
  it('rechecks Mercator zoom independently after helper switching', () => {
    const input = { ...facts(), latitude: 85, zoom: 1 };
    expect(admitMapCameraFollowProfile(input).status).to.equal('admitted');
    expect(admitMapCameraFollowProfile({ ...input, projectionTransition: 0 })).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
    expect(admitMapCameraFollowProfile({ ...facts(), projectionTransition: 0, latitude: 85, zoom: 4 }).status).to.equal('admitted');
  });
  it('admits exact allocation and pitch limits without widening them', () => {
    for (const width of [64, 4096]) for (const height of [64, 4096]) for (const pitch of [0, 60]) {
      expect(admitMapCameraFollowProfile({ ...facts(), width, height, pitch }).status).to.equal('admitted');
    }
    for (const change of [{ width: 63 }, { height: 4097 }, { pitch: 60.001 }, { pitch: -1 }, { latitude: 91 },
      { projectionTransition: -1 }, { projectionTransition: 1.001 }, { zoom: NaN }, { height: Infinity }]) {
      expect(admitMapCameraFollowProfile({ ...facts(), ...change })).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
    }
  });
  it('refuses authored or native constraints and terrain explicitly', () => {
    for (const change of [{ explicitBounds: true }, { explicitZoomLimits: true }, { nativeBounds: true }, { nativeMinZoom: 0 }, { nativeMaxZoom: 24 }]) {
      expect(admitMapCameraFollowProfile({ ...facts(), ...change })).to.deep.equal({ status: 'unavailable', reason: 'camera-constraints' });
    }
    expect(admitMapCameraFollowProfile({ ...facts(), terrain: true })).to.deep.equal({ status: 'unavailable', reason: 'terrain' });
    expect(admitMapCameraFollowProfile({ ...facts(), padding: { top: 1, bottom: 0, left: 0, right: 0 } })).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
  });
  it('requires the actual projection and movement capabilities, with cancellation only while moving', () => {
    for (const change of [{ canPan: false }, { canObserveMotion: false }, { hasProjection: false }, { moving: true, canStop: false }]) {
      expect(admitMapCameraFollowProfile({ ...facts(), ...change })).to.deep.equal({ status: 'unavailable', reason: 'camera-capability' });
    }
    expect(admitMapCameraFollowProfile({ ...facts(), canStop: false }).status).to.equal('admitted');
  });
  it('never invokes accessor camera facts or treats incomplete facts as a supported profile', () => {
    let reads = 0; const input = facts();
    Object.defineProperty(input, 'zoom', { get() { reads++; throw new Error('Must not execute'); } });
    expect(admitMapCameraFollowProfile(input).status).to.equal('unavailable'); expect(reads).to.equal(0);
    expect(admitMapCameraFollowProfile({}).status).to.equal('unavailable');
    expect(admitMapCameraFollowProfile(null).status).to.equal('unavailable');
  });
  it('recognizes the exact centered tolerance before issuing a correction', () => {
    const initial = createMapCameraFollowAttempt();
    const centered = observeMapCameraFollowAttempt(initial, observation(1, 2));
    expect(centered.status).to.equal('centered'); expect(centered.correction).to.equal(undefined);
    const moving = observeMapCameraFollowAttempt(initial, observation(1, 2.001));
    expect(moving.status).to.equal('centering'); expect(moving.correction![0]).to.be.closeTo(2.001, 1e-10);
    expect(moving.attempt.corrections).to.equal(1); expect(initial.corrections).to.equal(0);
  });
  it('caps each screen axis and returns detached frozen data', () => {
    const initial = createMapCameraFollowAttempt(); const point: [number, number] = [1e200, -1e200];
    const next = observeMapCameraFollowAttempt(initial, { frame: 1, point, width: 640, height: 480 });
    expect(next.correction).to.deep.equal([320, -240]); point[0] = 0;
    expect(next.correction).to.deep.equal([320, -240]);
    expect(Object.isFrozen(next) && Object.isFrozen(next.attempt) && Object.isFrozen(next.correction)).to.equal(true);
  });
  it('compares improving overflowing distances independently of saturated diagnostics', () => {
    let attempt = createMapCameraFollowAttempt();
    for (const [index, fraction] of [1, 0.95, 0.9, 0.85].entries()) {
      const coordinate = Number.MAX_VALUE * fraction;
      const result = observeMapCameraFollowAttempt(attempt, { frame: index, point: [coordinate, coordinate], width: 640, height: 480 });
      expect(result.attempt.lastResidual).to.equal(Number.MAX_VALUE);
      expect(result.attempt.nonImproving).to.equal(0);
      expect(result.status).to.equal('centering'); expect(result.correction).to.deep.equal([320, 240]);
      expect(result.attempt.corrections).to.equal(index + 1); attempt = result.attempt;
    }
  });
  it('terminates a constant overflowing-distance plateau after two nonimprovements', () => {
    let attempt = createMapCameraFollowAttempt();
    for (const frame of [0, 1, 2]) {
      const result = observeMapCameraFollowAttempt(attempt, { frame, point: [Number.MAX_VALUE, Number.MAX_VALUE], width: 640, height: 480 });
      expect(result.attempt.lastResidual).to.equal(Number.MAX_VALUE);
      expect(result.attempt.nonImproving).to.equal(frame);
      expect(result.status).to.equal(frame === 2 ? 'limited' : 'centering');
      if (frame === 2) expect(result.correction).to.equal(undefined);
      attempt = result.attempt;
    }
    expect(attempt.corrections).to.equal(2);
  });
  it('ignores duplicate or older completed frames without spending a second correction', () => {
    const first = observeMapCameraFollowAttempt(createMapCameraFollowAttempt(), observation(4, 100));
    for (const frame of [4, 3, 0]) {
      const duplicate = observeMapCameraFollowAttempt(first.attempt, observation(frame, 50));
      expect(duplicate.attempt).to.equal(first.attempt); expect(duplicate.correction).to.equal(undefined);
      expect(duplicate.attempt.corrections).to.equal(1);
    }
  });
  it('allows four corrections and measures their final result before declaring the budget exhausted', () => {
    let attempt = createMapCameraFollowAttempt();
    for (const [index, residual] of [100, 80, 60, 40].entries()) {
      const result = observeMapCameraFollowAttempt(attempt, observation(index + 1, residual));
      expect(result.correction !== undefined).to.equal(true); attempt = result.attempt;
    }
    const limited = observeMapCameraFollowAttempt(attempt, observation(5, 20));
    expect(limited.status).to.equal('limited'); expect(limited.correction).to.equal(undefined); expect(limited.attempt.corrections).to.equal(4);
    const centered = observeMapCameraFollowAttempt(attempt, observation(5, 0));
    expect(centered.status).to.equal('centered'); expect(centered.correction).to.equal(undefined);
  });
  it('stops after two consecutive nonimproving observations', () => {
    let attempt = createMapCameraFollowAttempt();
    for (const frame of [1, 2]) attempt = observeMapCameraFollowAttempt(attempt, observation(frame, 100)).attempt;
    const result = observeMapCameraFollowAttempt(attempt, observation(3, 100));
    expect(result.status).to.equal('limited'); expect(result.correction).to.equal(undefined);
    expect(result.attempt.nonImproving).to.equal(2); expect(result.attempt.corrections).to.equal(2);
  });
  it('limits reduced-motion acquisition to one correction and never restarts a terminal attempt on later frames', () => {
    const first = observeMapCameraFollowAttempt(createMapCameraFollowAttempt({ reducedMotion: true }), observation(1, 100));
    const limited = observeMapCameraFollowAttempt(first.attempt, observation(2, 50));
    expect(limited.status).to.equal('limited'); expect(limited.attempt.corrections).to.equal(1);
    const later = observeMapCameraFollowAttempt(limited.attempt, observation(999, 0));
    expect(later.attempt).to.equal(limited.attempt); expect(later.status).to.equal('limited'); expect(later.correction).to.equal(undefined);
  });
  it('rejects fabricated attempts and invalid observation data without altering the admitted state', () => {
    expect(() => observeMapCameraFollowAttempt({} as never, observation(1, 20))).to.throw();
    expect(() => createMapCameraFollowAttempt({ reducedMotion: 'yes' } as never)).to.throw();
    const attempt = createMapCameraFollowAttempt();
    for (const change of [{ frame: -1 }, { frame: 1.5 }, { width: 0 }, { height: Infinity }, { point: [NaN, 2] as const }]) {
      expect(() => observeMapCameraFollowAttempt(attempt, { ...observation(1, 20), ...change })).to.throw();
    }
    expect(attempt.corrections).to.equal(0);
  });
});
