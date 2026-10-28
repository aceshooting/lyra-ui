import { expect } from '@open-wc/testing';
import {
  admitMapTerrain,
  mapScenePreparation,
  mapSceneValueEqual,
  normalizeMapProjection,
  snapshotMapSceneBaseline,
} from './map-scene-configuration.js';

describe('map scene configuration', () => {
  it('normalizes only supported projection shorthands', () => {
    expect(normalizeMapProjection('mercator')).to.equal('mercator');
    expect(normalizeMapProjection('globe')).to.equal('globe');
    for (const value of [undefined, null, '', 'Globe', 'custom', {}, 0]) {
      expect(normalizeMapProjection(value)).to.equal(undefined);
    }
  });

  it('distinguishes unset terrain, disabled terrain and finite nonnegative exaggeration', () => {
    expect(admitMapTerrain(undefined)).to.equal(undefined);
    expect(admitMapTerrain(null)).to.equal(null);
    expect(admitMapTerrain({ source: 'dem' })).to.deep.equal({ source: 'dem', exaggeration: 1 });
    for (const exaggeration of [0, 1, 11, Number.MAX_VALUE]) {
      const result = admitMapTerrain({ source: 'dem', exaggeration });
      expect(result).to.deep.equal({ source: 'dem', exaggeration });
      expect(Object.isFrozen(result)).to.equal(true);
    }
    for (const value of [{}, { source: '' }, { source: 'dem', exaggeration: -1 }, { source: 'dem', exaggeration: NaN }, { source: 'dem', exaggeration: Infinity }]) {
      expect(() => admitMapTerrain(value)).to.throw();
    }
  });

  it('refuses accessors without invoking them', () => {
    let reads = 0;
    const hostile = Object.defineProperty({}, 'source', { get() { reads += 1; return 'dem'; } });
    expect(() => admitMapTerrain(hostile)).to.throw();
    const projection = Object.defineProperty({}, 'type', { get() { reads += 1; return 'globe'; } });
    expect(() => snapshotMapSceneBaseline(projection, null)).to.throw();
    expect(reads).to.equal(0);
  });

  it('keeps complete immutable replay specifications separate from preparation metadata', () => {
    const projection = { type: ['interpolate', ['linear'], ['zoom'], 0, 'globe', 12, 'mercator'], transition: { duration: 200 } };
    const baseline = snapshotMapSceneBaseline(projection, { source: 'dem', exaggeration: 2 });
    expect(baseline.projection).to.deep.equal(projection);
    expect(baseline.projection).not.to.equal(projection);
    expect(Object.isFrozen(baseline.projection)).to.equal(true);
    const preparation = mapScenePreparation(baseline.projection, baseline.terrain, { sources: { dem: { type: 'raster-dem', tiles: ['unused'] } } });
    expect(preparation).to.deep.equal({ projection: { type: 'globe' }, terrain: true, sources: { dem: { type: 'raster-dem' } } });
    expect(preparation.projection).not.to.equal(baseline.projection);
    expect(mapScenePreparation({ type: 'mercator' }, null, { sources: {} })).to.deep.equal({ projection: { type: 'mercator' }, terrain: false });
    expect(() => mapScenePreparation({ type: 'custom' }, null, { sources: {} })).to.throw();
  });

  it('uses genuine absent baseline defaults and rejects malformed or unbounded specifications', () => {
    expect(snapshotMapSceneBaseline(undefined, undefined)).to.deep.equal({ projection: { type: 'mercator' }, terrain: null });
    for (const projection of [null, {}, { type: 1 }, { type: 'globe', extra: new Array(300).fill(0) }]) {
      expect(() => snapshotMapSceneBaseline(projection, undefined)).to.throw();
    }
  });

  it('looks up only the exact current-style DEM descriptor beyond catalog limits', () => {
    const sources: Record<string, unknown> = {};
    for (let index = 0; index < 1025; index += 1) sources[`source-${index}`] = { type: 'vector' };
    sources['dem'] = { type: 'raster-dem' };
    Object.defineProperty(sources, 'unrelated', { enumerable: true, get() { throw new Error('unrelated'); } });
    expect(mapScenePreparation({ type: 'globe' }, { source: 'dem' }, { sources }).sources).to.deep.equal({ dem: { type: 'raster-dem' } });
    for (const invalid of [{}, { dem: { type: 'vector' } }, Object.create({ dem: { type: 'raster-dem' } })]) {
      expect(() => mapScenePreparation({ type: 'globe' }, { source: 'dem' }, { sources: invalid })).to.throw();
    }
    const hostile = Object.defineProperty({}, 'dem', { get() { throw new Error('accessor invoked'); } });
    expect(() => mapScenePreparation({ type: 'globe' }, { source: 'dem' }, { sources: hostile })).to.throw();
  });

  it('compares admitted values structurally without depending on insertion order', () => {
    expect(mapSceneValueEqual({ source: 'dem', exaggeration: 1 }, { exaggeration: 1, source: 'dem' })).to.equal(true);
    expect(mapSceneValueEqual(null, undefined)).to.equal(false);
    expect(mapSceneValueEqual({ type: 'globe' }, { type: 'mercator' })).to.equal(false);
  });
  it('omits unowned feature metadata without inventing a projection or terrain default', () => {
    expect(mapScenePreparation(undefined, undefined, undefined)).to.deep.equal({});
    expect(mapScenePreparation(undefined, null, undefined)).to.deep.equal({ terrain: false });
    expect(mapScenePreparation({ type: 'globe' }, undefined, undefined)).to.deep.equal({ projection: { type: 'globe' } });
  });

});
