import { expect, fixture, html } from '@open-wc/testing';
import fc from 'fast-check';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';
import { propertyRuns } from '../../../../test/property-options.js';
import { createMapSceneOwner } from './map-scene-owner.js';
import { buildSceneRenderInput } from './map-scene-render-input.js';

describe('map scene render input properties', () => {
  it('keeps actual admitted marker projection immutable finite and joined to exact target revisions', async () => {
    const element = await fixture<HTMLElement>(html`<div></div>`);
    fc.assert(fc.property(fc.array(fc.record({ longitude: fc.integer({ min: -720, max: 720 }),
      opacity: fc.integer({ min: 0, max: 100 }), alpha: fc.integer({ min: 0, max: 100 }),
      red: fc.integer({ min: 0, max: 255 }) }), { minLength: 1, maxLength: 12 }), rows => {
      const owner = createMapSceneOwner({ element, connection: Object.freeze({}), isCurrentConnection: () => true, changed() {} });
      try {
        owner.assign({ objects: rows.map((row, index) => ({ ...sceneMarker(`marker-${index}`, row.longitude), opacity: row.opacity / 100 })) });
        const accepted = owner.captureAccepted(), state = owner.state.capture();
        const presentation = { reducedMotion: true, markers: rows.map((row, index) => ({ id: `marker-${index}`,
          rgba: [row.red / 255, 0.25, 0.5, row.alpha / 100] as [number, number, number, number] })) };
        const packet = buildSceneRenderInput({ accepted, state, phase: 'resolved', presentationRevision: 1, presentation });
        expect(packet?.markers.length).to.equal(rows.length);
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index]!, marker = packet!.markers[index]!, fact = state.targets.find(target => target.id === marker.id);
          if (!fact || fact.kind !== 'marker') throw new Error('Expected actual marker target');
          expect(marker.acceptedPositionRevision).to.equal(fact.acceptedPositionRevision);
          expect(marker.position).to.deep.equal(fact.position);
          expect(marker.rgba[3]).to.equal((row.alpha / 100) * (row.opacity / 100));
          expect(marker.rgba[0]).to.equal(row.red / 255);
          expect([...marker.rgba, ...marker.position.lngLat, marker.position.altitude, marker.radiusCss].every(Number.isFinite)).to.equal(true);
          const oldRed = marker.rgba[0]; presentation.markers[index]!.rgba[0] = 1 - oldRed;
          expect(marker.rgba[0]).to.equal(oldRed);
          expect(Object.isFrozen(marker) && Object.isFrozen(marker.rgba) && Object.isFrozen(marker.position.lngLat)).to.equal(true);
        }
        expect(packet!.acceptedSceneRevision).to.equal(state.acceptedSceneRevision);
        expect(Object.isFrozen(packet) && Object.isFrozen(packet!.markers)).to.equal(true);
      } finally { owner.close(); }
    }), propertyRuns());
  });
});
