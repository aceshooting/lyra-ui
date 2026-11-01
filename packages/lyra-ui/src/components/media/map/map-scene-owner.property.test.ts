import { expect, fixture, html } from '@open-wc/testing';
import fc from 'fast-check';
import { createMapSceneSessionFacade } from '../../../internal/map-scene-session.js';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';
import { propertyRuns } from '../../../../test/property-options.js';
import { createMapSceneOwner } from './map-scene-owner.js';

describe('map scene owner properties', () => {
  it('keeps accepted snapshots and registry geography coherent through replacement and rejection', async () => {
    const element = await fixture<HTMLElement>(html`<div></div>`);
    fc.assert(fc.property(fc.array(fc.record({ longitude: fc.integer({ min: -720, max: 720 }),
      label: fc.string({ maxLength: 40 }).map(value => `Label ${value}`), reject: fc.boolean() }), { minLength: 1, maxLength: 20 }), steps => {
      const connection = Object.freeze({});
      const owner = createMapSceneOwner({ element, connection, isCurrentConnection: () => true, changed() {} });
      const facade = createMapSceneSessionFacade({ connection });
      expect(facade.bindState(owner.state)).to.equal(true);
      try {
        for (const step of steps) {
          const previous = owner.captureAccepted();
          const marker = { ...sceneMarker('target', step.longitude), label: step.label };
          owner.assign({ objects: step.reject ? [marker, marker] : [marker] });
          const accepted = owner.captureAccepted();
          expect(owner.state.capture().acceptedSceneRevision).to.equal(accepted.acceptedSceneRevision);
          if (step.reject) {
            expect(accepted === previous).to.equal(true);
            expect(owner.captureView().status?.code).to.equal('invalid');
          } else {
            const object = accepted.objects[0];
            if (!object || object.kind !== 'marker') throw new Error('Expected marker');
            const target = facade.attachment.target('target');
            if (target.status !== 'accepted') throw new Error('Expected target');
            expect(target.target.position).to.deep.equal(object.position);
            expect(object.label).to.equal(step.label);
            expect(object.position.lngLat[0]).to.equal(((step.longitude + 180) % 360 + 360) % 360 - 180);
            marker.position.lngLat[0] = 123;
            expect(object.position.lngLat[0]).to.equal(((step.longitude + 180) % 360 + 360) % 360 - 180);
            expect(target.target.position.lngLat[0]).to.equal(((step.longitude + 180) % 360 + 360) % 360 - 180);
            expect(target.target.position).to.deep.equal(object.position);
            expect(Object.isFrozen(accepted) && Object.isFrozen(object.position.lngLat)).to.equal(true);
          }
        }
      } finally { facade.close(); owner.close(); }
    }), propertyRuns());
  });
});
