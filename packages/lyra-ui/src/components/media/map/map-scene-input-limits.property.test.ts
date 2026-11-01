import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { sceneArc, sceneMarker, scenePath, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import { mapSceneAdmissionErrorCode } from './map-scene-errors.js';

describe('map scene input limit properties', () => {
  it('matches independent label and color length predicates around their exact ceilings', () => {
    fc.assert(fc.property(fc.integer({ min: -8, max: 8 }), fc.integer({ min: -8, max: 8 }), fc.boolean(), (labelDelta, colorDelta, astral) => {
      const h = sceneSourceHarness();
      try {
        const labelLength = 16_384 + labelDelta;
        const colorLength = 1_024 + colorDelta;
        const label = astral ? `${'😀'.repeat(Math.floor(labelLength / 2))}${labelLength % 2 ? 'x' : ''}` : 'l'.repeat(labelLength);
        const accepted = labelLength <= 16_384 && colorLength <= 1_024;
        let error: unknown;
        let candidate: ReturnType<typeof stageMapSceneAdmission> | undefined;
        try {
          candidate = stageMapSceneAdmission({ objects: [{ ...sceneMarker(), label,
            color: `${' '.repeat(colorLength - 3)}red` }] }, { request: h.request(), sources: h.sources });
        } catch (caught) { error = caught; }
        expect(candidate !== undefined).to.equal(accepted);
        if (accepted) {
          expect(error).to.equal(undefined);
          expect(candidate!.objects[0]!.label.length).to.equal(labelLength);
          expect(candidate!.objects[0]!.color?.length).to.equal(colorLength);
        } else {
          expect(error).to.be.instanceOf(TypeError);
          expect(mapSceneAdmissionErrorCode(error)).to.equal('limit');
        }
        candidate?.dispose();
        expect(h.allocations).to.equal(0);
      } finally { h.sources.dispose(); }
    }), propertyRuns());
  });

  it('rejects aggregate authored-position excess independently of marker and arc distribution', () => {
    const positions = Array.from({ length: 4096 }, (_, index) => ({ lngLat: [index / 100, 0] as [number, number] }));
    fc.assert(fc.property(fc.integer({ min: 0, max: 24 }), fc.integer({ min: 1, max: 24 }), (markers, arcs) => {
      const h = sceneSourceHarness();
      try {
        const objects = [
          ...Array.from({ length: 16 }, (_, index) => ({ ...scenePath(`path-${index}`), positions })),
          ...Array.from({ length: markers }, (_, index) => sceneMarker(`pin-${index}`)),
          ...Array.from({ length: arcs }, (_, index) => sceneArc(`arc-${index}`)),
        ];
        const authoredCount = 16 * 4096 + markers + 2 * arcs;
        expect(authoredCount > 65_536).to.equal(true);
        expect(objects.length <= 2000).to.equal(true);
        let error: unknown;
        let candidate: ReturnType<typeof stageMapSceneAdmission> | undefined;
        try { candidate = stageMapSceneAdmission({ objects }, { request: h.request(), sources: h.sources }); }
        catch (caught) { error = caught; }
        candidate?.dispose();
        expect(error).to.be.instanceOf(TypeError);
        expect(mapSceneAdmissionErrorCode(error)).to.equal('limit');
        expect(h.allocations).to.equal(0);
        expect(h.resolutions).to.equal(0);
      } finally { h.sources.dispose(); }
    }), propertyRuns());
  });

  it('does not classify caller errors through arbitrary names, messages or code-shaped properties', () => {
    fc.assert(fc.property(fc.string({ maxLength: 128 }), fc.constantFrom('invalid', 'limit'), fc.boolean(),
      (message, code, typeError) => {
        const error = typeError ? new TypeError(message) : new Error(message);
        Object.assign(error, { code, name: 'TypeError' });
        expect(mapSceneAdmissionErrorCode(error)).to.equal(undefined);
        expect(mapSceneAdmissionErrorCode({ message, code, name: 'TypeError' })).to.equal(undefined);
      }), propertyRuns());
  });
});
