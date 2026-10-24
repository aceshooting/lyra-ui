import { expect } from '@open-wc/testing';
import { snapshotMapStyle } from './map-style-input.js';

const style = (providers: Record<string, unknown>) => ({ version: 8, sources: {}, layers: [], ...providers });
const snapshot = (providers: Record<string, unknown>) => snapshotMapStyle(style(providers)) as Record<string, unknown>;

describe('map style font admission', () => {
  it('bounds family and face keys before inspecting their descriptors', () => {
    for (const kind of ['families', 'face']) {
      let reads = 0;
      const record = Object.fromEntries(Array.from({ length: kind === 'families' ? 65 : 3 }, (_, index) => [String(index), 'font.woff2']));
      const hostile = new Proxy(record, { getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
      const faces = kind === 'families' ? hostile : { Demo: [hostile] };
      expect(snapshot({ 'font-faces': faces })['font-faces']).to.equal(undefined);
      expect(reads).to.equal(0);
    }
  });

  it('rejects optional accessor providers and ranges without invoking them', () => {
    let reads = 0;
    const face = { url: 'font.woff2' };
    Object.defineProperty(face, 'unicode-range', { enumerable: true, get() { reads++; return ['U+0-7F']; } });
    expect(snapshot({ 'font-faces': { Demo: [face] } })['font-faces']).to.equal(undefined);
    const input = style({ 'font-faces': { Demo: 'font.woff2' } });
    Object.defineProperty(input, 'glyphs', { enumerable: true, get() { reads++; return 'glyphs/{fontstack}/{range}.pbf'; } });
    const result = snapshotMapStyle(input) as Record<string, unknown>;
    expect(result['font-faces']).to.equal(undefined);
    expect(result['glyphs']).to.equal(undefined);
    expect(reads).to.equal(0);
  });

  it('bounds face and range arrays before reading entries', () => {
    for (const kind of ['faces', 'ranges']) {
      let reads = 0;
      const entries = new Proxy(Array.from({ length: kind === 'faces' ? 257 : 65 }, () => 'U+0-7F'), {
        getOwnPropertyDescriptor(target, key) { if (key !== 'length') reads++; return Reflect.getOwnPropertyDescriptor(target, key); },
      });
      const faces = { Demo: kind === 'faces' ? entries : [{ url: 'font.woff2', 'unicode-range': entries }] };
      expect(snapshot({ 'font-faces': faces })['font-faces']).to.equal(undefined);
      expect(reads).to.equal(0);
    }
  });

  it('detaches and freezes valid providers and ordinary style fields', () => {
    const ranges = ['U+0-7F'];
    const input = style({ 'font-faces': { Demo: [{ url: 'font.woff2', 'unicode-range': ranges }] } });
    const result = snapshotMapStyle(input) as Record<string, unknown> & { layers: readonly unknown[] };
    ranges[0] = 'invalid'; input.layers.push({} as never);
    expect(result['font-faces']).to.deep.equal({ Demo: [{ url: 'font.woff2', 'unicode-range': ['U+0-7F'] }] });
    expect(result.layers.length).to.equal(0);
    expect(Object.isFrozen(result)).to.equal(true);
    expect(Object.isFrozen(result['font-faces'])).to.equal(true);
  });

  it('gives admitted font families an ordinary prototype without changing special own names', () => {
    const families = Object.create(null) as Record<string, unknown>;
    families['__proto__'] = [{ url: 'font.woff2' }];
    families['toString'] = 'other.woff2';
    const result = snapshot({ 'font-faces': families })['font-faces'] as Record<string, unknown>;
    expect(Object.getPrototypeOf(result) === Object.prototype).to.equal(true);
    expect(Object.hasOwn(result, '__proto__')).to.equal(true);
    expect(Object.getOwnPropertyDescriptor(result, '__proto__')?.value).to.deep.equal([{ url: 'font.woff2' }]);
    expect(Object.getOwnPropertyDescriptor(result, 'toString')?.value).to.equal('other.woff2');
    expect(Object.isFrozen(result)).to.equal(true);
    expect(Object.getPrototypeOf(families)).to.equal(null);
    expect(Object.getOwnPropertyDescriptor(Object.prototype, '__proto__')?.set !== undefined).to.equal(true);
  });

  it('retains a valid glyph provider when native face data is invalid', () => {
    const result = snapshot({ glyphs: 'glyphs/{fontstack}/{range}.pbf', 'font-faces': { Demo: [] } });
    expect(result['glyphs']).to.equal('glyphs/{fontstack}/{range}.pbf');
    expect(result['font-faces']).to.equal(undefined);
  });
});

describe('map style font declaration shape', () => {
  it('drops declarations that are not records of face lists', () => {
    for (const faces of ['font.woff2', 7, null, ['Demo'], { Demo: [null] }, { Demo: ['font.woff2'] }]) {
      expect(snapshot({ 'font-faces': faces })['font-faces'], String(faces)).to.equal(undefined);
    }
    expect(snapshot({ 'font-faces': { Demo: [{ url: 'font.woff2' }] } })['font-faces']).to.deep.equal({ Demo: [{ url: 'font.woff2' }] });
  });
});
