import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { admitMapOverlays } from './map-overlay-admission.js';

// The reserved prototype names are rejected by design, so ordinary identifiers never include them.
const identifier = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/u).filter(id => id !== 'prototype' && id !== 'constructor');
const paintValue = fc.oneof(fc.string({ maxLength: 12 }), fc.double({ noNaN: true, noDefaultInfinity: true }), fc.boolean(),
  fc.array(fc.oneof(fc.string({ maxLength: 6 }), fc.integer()), { maxLength: 4 }));
const overlays = fc.record({
  sourceIds: fc.uniqueArray(identifier, { minLength: 1, maxLength: 4 }),
  layerIds: fc.uniqueArray(identifier, { minLength: 1, maxLength: 4 }),
  padding: fc.constantFrom('', ' ', '  '),
  paint: fc.dictionary(fc.stringMatching(/^[a-z][a-z-]{0,12}$/u), paintValue, { maxKeys: 4 }),
}).map(({ sourceIds, layerIds, padding, paint }) => ({
  sources: sourceIds.map(id => ({ id: `${padding}${id}${padding}`, source: { type: 'geojson', promoteId: 'name', attribution: 'credit' } })),
  layers: layerIds.map((id, index) => ({ layer: { id: `${padding}${id}${padding}`, type: 'fill', source: sourceIds[index % sourceIds.length], paint: { ...paint } } })),
}));

function deeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}

describe('map overlay admission properties', () => {
  it('never throws on arbitrary JSON and answers with a frozen admission result', () => {
    fc.assert(fc.property(fc.jsonValue(), fc.jsonValue(), (sources, layers) => {
      for (const input of [sources, { sources, layers }, { sources: [sources], layers: [layers] }]) {
        const result = admitMapOverlays(input);
        expect(Object.isFrozen(result)).to.equal(true);
        if (!result.ok) expect(['invalid-input', 'limit', 'duplicate-id']).to.include(result.code);
      }
    }), propertyRuns());
  });

  it('admits unique trimmed identifiers as a deeply frozen snapshot that later caller edits cannot change', () => {
    fc.assert(fc.property(overlays, input => {
      const result = admitMapOverlays(input);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(result.overlays.sources.map(row => row.id)).to.deep.equal(input.sources.map(row => row.id.trim()));
      expect(result.overlays.layers.map(row => row.layer.id)).to.deep.equal(input.layers.map(row => row.layer.id.trim()));
      expect(deeplyFrozen(result.overlays)).to.equal(true);
      const before = JSON.stringify(result.overlays);
      for (const row of input.sources) { row.source.type = 'changed'; row.id = 'changed'; }
      for (const row of input.layers) { row.layer.type = 'changed'; Object.assign(row.layer.paint, { injected: 'changed' }); }
      expect(JSON.stringify(result.overlays)).to.equal(before);
    }), propertyRuns());
  });

  it('rejects a repeated identifier whatever its padding', () => {
    fc.assert(fc.property(identifier, fc.constantFrom('', ' '), (id, padding) => {
      const row = { id, source: { type: 'geojson' } };
      expect(admitMapOverlays({ sources: [row, { ...row, id: `${padding}${id}${padding}` }] })).to.deep.equal({ ok: false, code: 'duplicate-id' });
    }), propertyRuns());
  });
});
