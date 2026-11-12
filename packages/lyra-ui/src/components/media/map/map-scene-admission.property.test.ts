import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { snapshotMapSceneRequest, stageMapSceneAdmission } from './map-scene-admission.js';
import { sceneMarker, sceneModel, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';

describe('map scene admission properties', () => {
  it('snapshots positive safe request counters without cloning the opaque connection identity', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), revision => {
      const connection = {};
      const request = { connection, revision };
      const accepted = snapshotMapSceneRequest(request);
      request.revision = 0;
      expect(accepted.connection === connection).to.equal(true);
      expect(accepted.revision).to.equal(revision);
      expect(Object.isFrozen(accepted)).to.equal(true);
      expect(Object.isFrozen(connection)).to.equal(false);
    }), propertyRuns());
  });

  it('rejects invalid request counters before allocating or resolving model sources', () => {
    const invalidRevision = fc.oneof(fc.integer({ max: 0 }),
      fc.integer({ min: 0, max: 1000 }).map(value => value + 0.5),
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1));
    fc.assert(fc.property(invalidRevision, revision => {
      const h = sceneSourceHarness();
      try {
        expect(() => stageMapSceneAdmission({ objects: [sceneModel()] }, {
          request: { connection: h.connection, revision }, sources: h.sources,
        })).to.throw();
        expect(h.allocations).to.equal(0);
        expect(h.resolutions).to.equal(0);
        expect(h.liveBytes).to.equal(0);
      } finally { h.sources.dispose(); }
    }), propertyRuns());
  });

  it('normalizes equivalent longitudes and detaches authored position data', () => {
    fc.assert(fc.property(fc.integer({ min: -179, max: 179 }), fc.integer({ min: -20, max: 20 }),
      fc.integer({ min: -80, max: 80 }), fc.integer({ min: -12000, max: 100000000 }),
      (longitude, turns, latitude, altitude) => {
        const h = sceneSourceHarness();
        const object = { ...sceneMarker(), position: { lngLat: [longitude + turns * 360, latitude], altitude } };
        const candidate = stageMapSceneAdmission({ objects: [object] }, { request: h.request(), sources: h.sources });
        object.position.lngLat.fill(0); object.position.altitude = 1;
        const admitted = candidate.objects[0]!;
        if (admitted.kind !== 'marker') throw new Error('Expected marker');
        expect(admitted.position.lngLat).to.deep.equal([longitude === 0 ? 0 : longitude, latitude === 0 ? 0 : latitude]);
        expect(admitted.position.altitude).to.equal(altitude);
        expect(admitted.position.altitudeReference).to.equal('sea-level');
        candidate.dispose(); h.sources.dispose();
      }), propertyRuns());
  });

  it('preserves exact nonblank identifiers and never normalizes distinct strings together', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), fc.boolean(), (length, spaced) => {
      const h = sceneSourceHarness();
      const id = `${spaced ? ' ' : ''}${'A'.repeat(length)}`;
      const candidate = stageMapSceneAdmission({ objects: [sceneMarker(id), sceneMarker(id.toLowerCase())] }, { request: h.request(), sources: h.sources });
      expect(candidate.objects.map(object => object.id)).to.deep.equal([id, id.toLowerCase()]);
      candidate.dispose(); h.sources.dispose();
    }), propertyRuns());
  });

  it('never allocates a valid leading source when a later object is invalid', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 32 }), fc.integer({ min: 0, max: 20 }), (byteLength, validRows) => {
      const h = sceneSourceHarness();
      const objects = [sceneModel('model', { format: 'glb', bytes: new Uint8Array(byteLength) }),
        ...Array.from({ length: validRows }, (_, i) => sceneMarker(`m${i}`)),
        { ...sceneMarker('invalid'), position: { lngLat: [0, 91] } }];
      expect(() => stageMapSceneAdmission({ objects }, { request: h.request(), sources: h.sources })).to.throw();
      expect(h.allocations).to.equal(0); expect(h.liveBytes).to.equal(0); h.sources.dispose();
    }), propertyRuns());
  });
});
