import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { snapshotFeatureRequirements } from '../scripts/feature-requirements.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const rows = fc.array(fc.record({
  sourceType: fc.constantFrom('geojson', 'canvas', 'image', 'vector', 'registered-source'),
  layerType: fc.constantFrom('circle', 'fill', 'line', 'symbol', 'custom'),
  payload: fc.array(fc.integer(), { maxLength: 12 }),
  reference: fc.boolean()
}), { maxLength: 12 });

function fixture(values, globe, terrain, payloadOverride) {
  const sources = Object.fromEntries(values.map((row, index) => [index ? `source-${index}` : '__proto__', {
    type: row.sourceType,
    data: { type: 'FeatureCollection', features: (payloadOverride ?? row.payload).map(value => ({
      type: 'Feature', properties: { value }, geometry: { type: 'Point', coordinates: [value, value] }
    })) }
  }]));
  const layers = values.flatMap((row, index) => {
    const layer = { id: `layer-${index}`, type: row.layerType, source: index ? `source-${index}` : '__proto__',
      paint: { color: row.payload }, metadata: { payload: row.payload } };
    return row.reference ? [{ id: `ref-${index}`, ref: layer.id, paint: { opacity: 0.5 } }, layer] : [layer];
  });
  return { sources, layers, projection: { type: globe ? 'globe' : 'mercator', unused: values },
    terrain: terrain ? { source: 'dem', unused: values } : null };
}

function objects(value, result = new Set()) {
  if (!value || typeof value !== 'object' || result.has(value)) return result;
  result.add(value);
  for (const child of Object.values(value)) objects(child, result);
  return result;
}

test('metadata projection matches an independent plain-data oracle, including references and special source names', () => {
  fc.assert(fc.property(rows, fc.boolean(), fc.boolean(), (values, globe, terrain) => {
    const requirements = fixture(values, globe, terrain);
    const projected = snapshotFeatureRequirements(requirements);
    const expected = {
      version: 8,
      sources: Object.fromEntries(values.map((row, index) => [index ? `source-${index}` : '__proto__', { type: row.sourceType }])),
      layers: values.flatMap((row, index) => row.reference
        ? [{ id: `ref-${index}`, ref: `layer-${index}` }, { id: `layer-${index}`, type: row.layerType }]
        : [{ id: `layer-${index}`, type: row.layerType }]),
      projection: { type: globe ? 'globe' : 'mercator' },
      terrain
    };
    assert.deepEqual(projected, expected);
    assert.equal(Object.getPrototypeOf(projected.sources), Object.prototype);
    const inputObjects = objects(requirements);
    for (const value of objects(projected)) assert.equal(inputObjects.has(value), false, 'projection retains no caller-owned object');
    // Payload substitution cannot change the required feature families.
    assert.deepEqual(snapshotFeatureRequirements(fixture(values, globe, terrain, [17, 29])), projected);
    for (const source of Object.values(requirements.sources)) source.type = 'mutated-source';
    for (const layer of requirements.layers) { layer.id = 'mutated-id'; layer.type = 'mutated-type'; layer.ref = 'mutated-ref'; }
    requirements.projection.type = 'mutated-projection'; requirements.terrain = !terrain;
    assert.deepEqual(projected, expected, 'all metadata remains stable after caller mutation');
  }), runs);
});

test('absent optional containers preserve the default feature plan', () => {
  fc.assert(fc.property(fc.record({
    sources: fc.boolean(), layers: fc.boolean(), projection: fc.boolean(), terrain: fc.boolean()
  }), flags => {
    const requirements = {};
    if (flags.sources) requirements.sources = {};
    if (flags.layers) requirements.layers = [];
    if (flags.projection) requirements.projection = null;
    if (flags.terrain) requirements.terrain = false;
    const expected = { version: 8, sources: {}, layers: [] };
    if (flags.projection) expected.projection = null;
    if (flags.terrain) expected.terrain = false;
    assert.deepEqual(snapshotFeatureRequirements(requirements), expected);
  }), runs);
});
