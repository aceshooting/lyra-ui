import { expect } from '@open-wc/testing';
import { planMapSourceUpdate } from './map-source-updates.js';

const coordinates = () => Object.freeze([[0, 1], [1, 1], [1, 0], [0, 0]].map(pair => Object.freeze(pair)));
const movedCoordinates = () => Object.freeze([[2, 3], [3, 3], [3, 2], [2, 2]].map(pair => Object.freeze(pair)));
const image = (extra: Record<string, unknown> = {}) => Object.freeze({ type: 'image', url: 'https://example.test/a.png', coordinates: coordinates(), ...extra });
const canvasSource = (canvas: HTMLCanvasElement, extra: Record<string, unknown> = {}) => Object.freeze({ type: 'canvas', canvas, coordinates: coordinates(), ...extra });

describe('map source update planning', () => {
  it('updates admitted GeoJSON data in place without changing source configuration', () => {
    const oldData = { type: 'FeatureCollection', features: [] };
    const nextData = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } }] };
    const previous = { type: 'geojson', data: oldData, promoteId: 'id' };
    const next = { ...previous, data: nextData };
    const calls: unknown[] = [];
    const source = { setData(this: unknown, data: unknown) { calls.push(this, data); } };
    const apply = planMapSourceUpdate(source, previous, next);
    expect(typeof apply).to.equal('function'); expect(calls.length).to.equal(0);
    apply!(); expect(calls[0] === source).to.equal(true); expect(calls[1] === nextData).to.equal(true);
    expect(planMapSourceUpdate(source, previous, { ...next, promoteId: 'other' })).to.equal(undefined);
    expect(planMapSourceUpdate(source, previous, previous)).to.equal(undefined);
    expect(planMapSourceUpdate({}, previous, next)).to.equal(undefined);
    const cancelled = planMapSourceUpdate(source, previous, next, () => { throw new Error('obsolete'); });
    expect(cancelled).to.throw('obsolete'); expect(calls.length).to.equal(2);
    expect(planMapSourceUpdate(source, { type: 'geojson', data: { value: 1 } }, { type: 'geojson', data: { value: 2 } })).to.equal(undefined);
    let reads = 0;
    const unsafeData = Object.defineProperty({ type: 'FeatureCollection' }, 'features', { get() { reads++; return []; } });
    expect(planMapSourceUpdate(source, previous, { ...next, data: unsafeData })).to.equal(undefined);
    expect(reads).to.equal(0);
  });

  it('updates a single image footprint Feature without replacing its native source', () => {
    const footprint = (offset: number) => ({ type: 'Feature', properties: {}, geometry: {
      type: 'Polygon', coordinates: [[[offset, 1], [offset + 1, 1], [offset + 1, 0], [offset, 0], [offset, 1]]],
    } });
    const previous = { type: 'geojson', data: footprint(0) };
    const next = { type: 'geojson', data: footprint(2) };
    const calls: unknown[] = [];
    const source = { setData(this: unknown, data: unknown) { calls.push(this, data); } };
    const apply = planMapSourceUpdate(source, previous, next);
    expect(typeof apply).to.equal('function'); expect(calls.length).to.equal(0);
    apply!(); expect(calls[0] === source).to.equal(true); expect(calls[1] === next.data).to.equal(true);
    expect(planMapSourceUpdate(source, previous, { ...next, cluster: true })).to.equal(undefined);
    expect(planMapSourceUpdate(source, previous, previous)).to.equal(undefined);
    const cancelled = planMapSourceUpdate(source, previous, next, () => { throw new Error('obsolete'); });
    expect(cancelled).to.throw('obsolete'); expect(calls.length).to.equal(2);
    for (const data of [{ value: 2 }, { type: 'Feature' },
      { type: 'Feature', properties: {}, geometry: {} },
      { type: 'Feature', properties: [], geometry: null },
      { type: 'FeatureCollection', features: [{ value: 2 }] }]) {
      expect(planMapSourceUpdate(source, previous, { ...next, data })).to.equal(undefined);
    }
    let reads = 0;
    const accessor = Object.defineProperty({ type: 'Feature', properties: {} }, 'geometry', { get() { reads++; return next.data.geometry; } });
    expect(planMapSourceUpdate(source, previous, { ...next, data: accessor })).to.equal(undefined);
    const cycle: Record<string, unknown> = { type: 'Feature', geometry: null }; cycle['properties'] = cycle;
    expect(planMapSourceUpdate(source, previous, { ...next, data: cycle })).to.equal(undefined);
    expect(reads).to.equal(0); expect(calls.length).to.equal(2);
  });

  it('plans image coordinates without mutation and preserves the method receiver and coordinates', () => {
    const calls: unknown[] = [];
    const source = { setCoordinates(this: unknown, value: unknown) { calls.push(this, value); } };
    const next = image({ coordinates: movedCoordinates() });
    const apply = planMapSourceUpdate(source, image(), next);
    expect(typeof apply).to.equal('function');
    expect(calls.length).to.equal(0);
    apply!();
    expect(calls.length).to.equal(2);
    expect(calls[0] === source).to.equal(true);
    expect(calls[1] === next.coordinates).to.equal(true);
  });

  it('uses updateImage for URL changes with the exact next URL and coordinates', () => {
    for (const nextCoordinates of [coordinates(), movedCoordinates()]) {
      const calls: unknown[] = [];
      const source = {
        updateImage(this: unknown, options: unknown) { calls.push(this, options); },
        setCoordinates() { throw new Error('URL updates must use updateImage'); },
      };
      const next = image({ url: 'https://example.test/b.png', coordinates: nextCoordinates });
      const apply = planMapSourceUpdate(source, image(), next);
      expect(calls.length).to.equal(0);
      expect(typeof apply).to.equal('function');
      apply!();
      expect(calls[0] === source).to.equal(true);
      const options = calls[1] as Record<string, unknown>;
      expect(options['url']).to.equal(next.url);
      expect(options['coordinates'] === nextCoordinates).to.equal(true);
      expect(Object.keys(options)).to.deep.equal(['url', 'coordinates']);
    }
  });

  it('retains native canvas identity while applying coordinates and animation in order', () => {
    const canvas = document.createElement('canvas');
    const calls: unknown[] = [];
    const source = {
      setCoordinates(this: unknown, value: unknown) { calls.push(this, value); },
      pause(this: unknown) { calls.push(this, 'pause'); },
    };
    const next = canvasSource(canvas, { coordinates: movedCoordinates(), animate: false });
    const apply = planMapSourceUpdate(source, canvasSource(canvas), next);
    expect(calls.length).to.equal(0);
    expect(typeof apply).to.equal('function');
    apply!();
    expect(calls.length).to.equal(4);
    expect(calls[0] === source).to.equal(true);
    expect(calls[1] === next.coordinates).to.equal(true);
    expect(calls[2] === source).to.equal(true);
    expect(calls[3]).to.equal('pause');
  });

  it('plans animation alone with only the capability needed for the next state', () => {
    const canvas = document.createElement('canvas');
    for (const animate of [false, true]) {
      const calls: string[] = [];
      const source = animate ? { play() { calls.push('play'); } } : { pause() { calls.push('pause'); } };
      const apply = planMapSourceUpdate(source, canvasSource(canvas, { animate: !animate }), canvasSource(canvas, { animate }));
      expect(typeof apply).to.equal('function');
      expect(calls.length).to.equal(0);
      apply!();
      expect(calls).to.deep.equal([animate ? 'play' : 'pause']);
    }
  });

  it('plans canvas coordinates alone without requiring animation capabilities', () => {
    const canvas = document.createElement('canvas');
    const calls: unknown[] = [];
    const source = { setCoordinates(value: unknown) { calls.push(value); } };
    const next = canvasSource(canvas, { coordinates: movedCoordinates() });
    const apply = planMapSourceUpdate(source, canvasSource(canvas), next);
    expect(typeof apply).to.equal('function');
    expect(calls.length).to.equal(0);
    apply!();
    expect(calls.length).to.equal(1);
    expect(calls[0] === next.coordinates).to.equal(true);
  });

  it('checks current ownership before each canvas operation and stops after coordinate cancellation', () => {
    const canvas = document.createElement('canvas'); const calls: string[] = [];
    let current = true; let checks = 0;
    const cancelled = new Error('cancelled update');
    const source = {
      setCoordinates() { calls.push('coordinates'); current = false; },
      pause() { calls.push('pause'); },
    };
    const apply = planMapSourceUpdate(source, canvasSource(canvas),
      canvasSource(canvas, { coordinates: movedCoordinates(), animate: false }), () => {
        checks += 1; if (!current) throw cancelled;
      });
    expect(checks).to.equal(0); expect(calls.length).to.equal(0);
    expect(apply).to.throw('cancelled update');
    expect(checks).to.equal(2); expect(calls).to.deep.equal(['coordinates']);
  });

  it('checks current ownership before applying either image operation', () => {
    for (const next of [image({ coordinates: movedCoordinates() }), image({ url: 'https://example.test/b.png' })]) {
      const calls: string[] = [];
      const source = { setCoordinates() { calls.push('coordinates'); }, updateImage() { calls.push('image'); } };
      const apply = planMapSourceUpdate(source, image(), next, () => { throw new Error('obsolete'); });
      expect(typeof apply).to.equal('function'); expect(calls.length).to.equal(0);
      expect(apply).to.throw('obsolete'); expect(calls.length).to.equal(0);
    }
  });

  it('does not plan unchanged descriptors or semantically unchanged default animation', () => {
    const canvas = document.createElement('canvas');
    const source = { setCoordinates() {}, updateImage() {}, play() {}, pause() {} };
    expect(planMapSourceUpdate(source, image(), image())).to.equal(undefined);
    expect(planMapSourceUpdate(source, canvasSource(canvas), canvasSource(canvas))).to.equal(undefined);
    expect(planMapSourceUpdate(source, canvasSource(canvas), canvasSource(canvas, { animate: true }))).to.equal(undefined);
  });

  it('falls back for missing or non-callable capabilities before applying any operation', () => {
    const canvas = document.createElement('canvas');
    let calls = 0;
    expect(planMapSourceUpdate({}, image(), image({ coordinates: movedCoordinates() }))).to.equal(undefined);
    expect(planMapSourceUpdate({ updateImage: true }, image(), image({ url: 'https://example.test/b.png' }))).to.equal(undefined);
    expect(planMapSourceUpdate({ setCoordinates() { calls += 1; } }, canvasSource(canvas),
      canvasSource(canvas, { coordinates: movedCoordinates(), animate: false }))).to.equal(undefined);
    expect(planMapSourceUpdate({ pause() { calls += 1; } }, canvasSource(canvas),
      canvasSource(canvas, { coordinates: movedCoordinates(), animate: false }))).to.equal(undefined);
    expect(calls).to.equal(0);
  });

  it('supports inherited native methods without evaluating an accessor capability', () => {
    let reads = 0;
    const calls: unknown[] = [];
    class NativeSource {
      setCoordinates(this: unknown, value: unknown) { calls.push(this, value); }
    }
    const source = new NativeSource();
    const apply = planMapSourceUpdate(source, image(), image({ coordinates: movedCoordinates() }));
    expect(typeof apply).to.equal('function');
    apply!();
    expect(calls[0] === source).to.equal(true);
    const accessor = Object.defineProperty(source, 'setCoordinates', { get() { reads += 1; return () => undefined; } });
    expect(planMapSourceUpdate(accessor, image(), image({ coordinates: movedCoordinates() }))).to.equal(undefined);
    expect(reads).to.equal(0);
  });

  it('falls back for changed metadata, source kinds, canvas handles and unrelated source families', () => {
    const canvas = document.createElement('canvas');
    const source = { setCoordinates() {}, updateImage() {}, play() {}, pause() {}, setData() {} };
    expect(planMapSourceUpdate(source, image({ attribution: 'A' }), image({ attribution: 'B', coordinates: movedCoordinates() }))).to.equal(undefined);
    expect(planMapSourceUpdate(source, image(), image({ metadata: 'new', coordinates: movedCoordinates() }))).to.equal(undefined);
    expect(planMapSourceUpdate(source, image(), canvasSource(canvas))).to.equal(undefined);
    expect(planMapSourceUpdate(source, canvasSource(canvas), canvasSource(document.createElement('canvas')))).to.equal(undefined);
    expect(planMapSourceUpdate(source, { type: 'geojson', data: { value: 1 } }, { type: 'geojson', data: { value: 2 } })).to.equal(undefined);
    expect(planMapSourceUpdate(source, { type: 'video', coordinates: coordinates() }, { type: 'video', coordinates: movedCoordinates() })).to.equal(undefined);
  });

  it('compares unchanged plain metadata structurally without serializing native canvas handles', () => {
    const canvas = document.createElement('canvas');
    let reads = 0;
    Object.defineProperty(canvas, 'toJSON', { get() { reads += 1; throw new Error('must stay opaque'); } });
    const metadata = () => Object.freeze({ value: Object.freeze(['a', Object.freeze({ b: 2 })]) });
    const previous = canvasSource(canvas, { metadata: metadata() });
    const next = canvasSource(canvas, { metadata: metadata(), coordinates: movedCoordinates() });
    const apply = planMapSourceUpdate({ setCoordinates() {} }, previous, next);
    expect(typeof apply).to.equal('function');
    expect(reads).to.equal(0);
  });

  it('rejects unsafe descriptor records and nested accessors without invoking getters', () => {
    let reads = 0;
    const source = { setCoordinates() {}, updateImage() {} };
    const unsafe = Object.defineProperty({ type: 'image', coordinates: coordinates() }, 'url', {
      get() { reads += 1; return 'https://example.test/a.png'; },
    });
    expect(planMapSourceUpdate(source, unsafe, image({ coordinates: movedCoordinates() }))).to.equal(undefined);
    const metadata = Object.defineProperty({}, 'value', { get() { reads += 1; return 1; } });
    expect(planMapSourceUpdate(source, image({ metadata }), image({ metadata, coordinates: movedCoordinates() }))).to.equal(undefined);
    const inherited = Object.assign(Object.create({ extra: true }) as Record<string, unknown>, image());
    expect(planMapSourceUpdate(source, inherited, image({ coordinates: movedCoordinates() }))).to.equal(undefined);
    expect(planMapSourceUpdate(source, image({ metadata: new Date() }), image({ metadata: new Date(), coordinates: movedCoordinates() }))).to.equal(undefined);
    expect(reads).to.equal(0);
  });

  it('rejects unsafe coordinates, cycles and malformed canvas handles', () => {
    const source = { setCoordinates() {}, updateImage() {}, pause() {} };
    const cycle: Record<string, unknown> = {}; cycle['self'] = cycle;
    expect(planMapSourceUpdate(source, image({ metadata: cycle }), image({ metadata: cycle, coordinates: movedCoordinates() }))).to.equal(undefined);
    for (const invalid of [[[0, 1]], [[0, 1], [1, 1], [1, 0], [Infinity, 0]], [[0, 1], [1, 1], [1, 0], [181, 0]], [, [1, 1], [1, 0], [0, 0]]]) {
      expect(planMapSourceUpdate(source, image(), image({ coordinates: invalid }))).to.equal(undefined);
    }
    const canvas = {} as HTMLCanvasElement;
    expect(planMapSourceUpdate(source, canvasSource(canvas), canvasSource(canvas, { animate: false }))).to.equal(undefined);
    const realCanvas = document.createElement('canvas');
    expect(planMapSourceUpdate(source, canvasSource(realCanvas), canvasSource(realCanvas, { animate: 'false' }))).to.equal(undefined);
  });

  it('does not read accessor array entries or accept custom array prototypes', () => {
    let reads = 0;
    const corners = coordinates().map(pair => [...pair]);
    Object.defineProperty(corners[0], '0', { get() { reads += 1; return 0; } });
    const source = { setCoordinates() {} };
    expect(planMapSourceUpdate(source, image(), image({ coordinates: corners }))).to.equal(undefined);
    const custom = coordinates().map(pair => [...pair]);
    Object.setPrototypeOf(custom, Object.create(Array.prototype));
    expect(planMapSourceUpdate(source, image(), image({ coordinates: custom }))).to.equal(undefined);
    expect(reads).to.equal(0);
  });

  it('propagates native application failures for the registry to handle', () => {
    const error = new Error('native update failed');
    const apply = planMapSourceUpdate({ setCoordinates() { throw error; } }, image(), image({ coordinates: movedCoordinates() }));
    expect(typeof apply).to.equal('function');
    expect(apply).to.throw('native update failed');
  });
});
