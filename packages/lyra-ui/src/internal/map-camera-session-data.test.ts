import { expect } from '@open-wc/testing';
import { admitMapViewpoint, admitMapCameraTour, sampleMapCameraTour } from './map-camera-session-data.js';

const view = (center: readonly [number, number] = [0, 0], zoom = 2, bearing = 0, pitch = 0) => ({ center, zoom, bearing, pitch });
const tour = (first = view(), last = view([10, 20], 4, 40, 60), interpolation = 'linear') => ({ keyframes: [
  { instant: 0, view: first, interpolation }, { instant: 100, view: last },
] });

describe('camera session data', () => {
  it('admits detached deeply frozen viewpoints with normalized bearings', () => {
    const input = { center: [180, -90], zoom: -2, bearing: 540, pitch: 85 };
    const result = admitMapViewpoint(input); input.center[0] = 0; input.zoom = 10;
    expect(result).to.deep.equal(view([180, -90], -2, -180, 85));
    expect(Object.isFrozen(result) && Object.isFrozen(result.center)).to.equal(true);
    expect(admitMapViewpoint(view([0, 0], Number.MAX_VALUE, Number.MAX_VALUE)).bearing).to.be.within(-180, 180);
  });

  it('rejects missing, unknown, malformed, sparse and inherited viewpoint data', () => {
    for (const input of [null, {}, { ...view(), extra: 1 }, { center: [0, 0], zoom: 2, bearing: 0 },
      view([181, 0]), view([0, -91]), view([0, 0], NaN), view([0, 0], 2, Infinity), view([0, 0], 2, 0, 86),
      { ...view(), center: new Array(2) }, { ...view(), center: [0, 0, 0] }, Object.create(view())]) {
      expect(() => admitMapViewpoint(input)).to.throw();
    }
  });

  it('does not execute nested accessors, toJSON or hostile reflection during admission', () => {
    let reads = 0;
    const accessor = Object.defineProperty(view(), 'zoom', { get() { reads++; return 2; } });
    const center = Object.defineProperty([0, 0], '0', { get() { reads++; return 0; } });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    for (const input of [accessor, { ...view(), center }, { ...view(), toJSON() { reads++; return {}; } }, revoked.proxy]) {
      expect(() => admitMapViewpoint(input)).to.throw();
    }
    const frame = Object.defineProperty({ instant: 0 }, 'view', { get() { reads++; return view(); } });
    expect(() => admitMapCameraTour({ keyframes: [frame] })).to.throw();
    expect(reads).to.equal(0);
  });

  it('admits one to 1024 ordered epoch keyframes, copying values and defaulting interpolation', () => {
    const input = tour(); const result = admitMapCameraTour(input);
    input.keyframes[0]!.view.center = [50, 50]; input.keyframes.push({ instant: 200, view: view() });
    expect(result.keyframes.length).to.equal(2);
    expect(result.keyframes[0]!.view.center).to.deep.equal([0, 0]);
    expect(result.keyframes[1]!.interpolation).to.equal('linear');
    expect(Object.isFrozen(result) && Object.isFrozen(result.keyframes) && Object.isFrozen(result.keyframes[0])).to.equal(true);
    expect(admitMapCameraTour({ keyframes: Array.from({ length: 1024 }, (_, instant) => ({ instant, view: view() })) }).keyframes.length).to.equal(1024);
    const singleton = admitMapCameraTour({ keyframes: [{ instant: -8640000000000000, view: view() }] });
    expect(sampleMapCameraTour(singleton, 8640000000000000)).to.deep.equal(view());
  });

  it('rejects empty, excessive, duplicate, unordered, invalid epoch and unknown tour fields', () => {
    for (const input of [{ keyframes: [] }, { ...tour(), extra: true },
      { keyframes: new Array(2) }, { keyframes: Array.from({ length: 1025 }, (_, instant) => ({ instant, view: view() })) },
      { keyframes: [{ instant: 0, view: view(), extra: true }] },
      { keyframes: [{ instant: 0, view: view() }, { instant: 0, view: view() }] },
      { keyframes: [{ instant: 1, view: view() }, { instant: 0, view: view() }] },
      ...[NaN, Infinity, 8640000000000001, -8640000000000001].map(instant => ({ keyframes: [{ instant, view: view() }] })),
      { keyframes: [{ instant: 0, view: view(), interpolation: null }] },
      tour(view(), view(), 'smooth')]) expect(() => admitMapCameraTour(input)).to.throw();
  });

  it('samples exact and outside instants as immutable detached endpoints', () => {
    const admitted = admitMapCameraTour(tour());
    for (const instant of [-100, 0]) expect(sampleMapCameraTour(admitted, instant)).to.deep.equal(view());
    for (const instant of [100, 200]) expect(sampleMapCameraTour(admitted, instant)).to.deep.equal(view([10, 20], 4, 40, 60));
    const result = sampleMapCameraTour(admitted, 0);
    expect(result === admitted.keyframes[0]!.view).to.equal(false);
    expect(Object.isFrozen(result) && Object.isFrozen(result.center)).to.equal(true);
  });

  it('interpolates wrapped longitude/bearing along the shortest arc with positive 180 ties', () => {
    const wrapped = admitMapCameraTour(tour(view([170, 0], 2, 170), view([-170, 20], 4, -170, 60)));
    expect(sampleMapCameraTour(wrapped, 50)).to.deep.equal(view([-180, 10], 3, -180, 30));
    const tied = admitMapCameraTour(tour(view([0, 0], 2, 0), view([-180, 0], 2, -180)));
    expect(sampleMapCameraTour(tied, 50)).to.deep.equal(view([90, 0], 2, 90));
    const reversed = admitMapCameraTour(tour(view([-180, 0], 2, -180), view([0, 0], 2, 0)));
    expect(sampleMapCameraTour(reversed, 50)).to.deep.equal(view([-90, 0], 2, -90));
  });

  it('uses outgoing hold and reduced-motion lower keyframes without affecting exact endpoints', () => {
    const held = admitMapCameraTour(tour(view(), view([10, 20], 4, 40, 60), 'hold'));
    expect(sampleMapCameraTour(held, 99)).to.deep.equal(view());
    const linear = admitMapCameraTour(tour());
    expect(sampleMapCameraTour(linear, 99, { reducedMotion: true })).to.deep.equal(view());
    expect(sampleMapCameraTour(linear, 100, { reducedMotion: true })).to.deep.equal(view([10, 20], 4, 40, 60));
  });

  it('locates exact and interior segments across a longer irregular tour', () => {
    const admitted = admitMapCameraTour({ keyframes: [
      { instant: -100, view: view([0, 0], 0) },
      { instant: 7, view: view([0, 0], 10), interpolation: 'hold' },
      { instant: 9, view: view([0, 0], 20) },
      { instant: 100, view: view([0, 0], 30) },
    ] });
    expect(sampleMapCameraTour(admitted, 7).zoom).to.equal(10);
    expect(sampleMapCameraTour(admitted, 8).zoom).to.equal(10);
    expect(sampleMapCameraTour(admitted, 9).zoom).to.equal(20);
    expect(sampleMapCameraTour(admitted, 54.5).zoom).to.equal(25);
    expect(sampleMapCameraTour(admitted, 100).zoom).to.equal(30);
  });

  it('keeps interpolation finite across opposite huge finite zoom values', () => {
    const admitted = admitMapCameraTour({ keyframes: [
      { instant: -8640000000000000, view: view([0, 0], -Number.MAX_VALUE) },
      { instant: 8640000000000000, view: view([0, 0], Number.MAX_VALUE) },
    ] });
    expect(sampleMapCameraTour(admitted, 0).zoom).to.equal(0);
    expect(Number.isFinite(sampleMapCameraTour(admitted, 4320000000000000).zoom)).to.equal(true);
  });

  it('refuses unbranded sampling inputs and invalid sampling options without invoking accessors', () => {
    let reads = 0;
    const hostile = { get keyframes() { reads++; return []; } };
    expect(() => sampleMapCameraTour(hostile as never, 0)).to.throw();
    const admitted = admitMapCameraTour(tour());
    expect(() => sampleMapCameraTour({ ...admitted } as never, 0)).to.throw();
    for (const instant of [NaN, Infinity, 8640000000000001]) expect(() => sampleMapCameraTour(admitted, instant)).to.throw();
    const options = { get reducedMotion() { reads++; return true; } };
    expect(() => sampleMapCameraTour(admitted, 0, options)).to.throw();
    expect(reads).to.equal(0);
  });
});
