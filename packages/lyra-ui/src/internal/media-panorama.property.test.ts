import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { normalizePanoramaCamera, snapshotPanoramaHotspots } from './media-panorama.js';

it('keeps panorama camera output finite and inside its documented viewing bounds', () => {
  const number = fc.oneof(fc.double(), fc.constant(Number.NaN), fc.constant(Infinity), fc.constant(-Infinity));
  fc.assert(fc.property(fc.record({ yaw: number, pitch: number, fieldOfView: number }), input => {
    const camera = normalizePanoramaCamera(input);
    expect(Object.isFrozen(camera)).to.equal(true);
    for (const value of Object.values(camera)) expect(Number.isFinite(value)).to.equal(true);
    expect(camera.yaw).to.be.at.least(-Math.PI).and.to.be.lessThan(Math.PI);
    expect(Math.abs(camera.pitch)).to.be.at.most(Math.PI / 2 - 0.01);
    expect(camera.fieldOfView).to.be.at.least(20).and.to.be.at.most(100);
  }), propertyRuns());
});

it('rejects non-array hotspot data and keeps accepted hotspot snapshots independent of their input', () => {
  const nonArray = fc.oneof(fc.constant(null), fc.constant(undefined), fc.boolean(), fc.integer(), fc.string(), fc.record({ id: fc.string() }));
  fc.assert(fc.property(nonArray, fc.string({ minLength: 1 }).filter(value => value.trim().length > 0), (invalid, id) => {
    const empty = snapshotPanoramaHotspots(invalid, window);
    expect(empty.length).to.equal(0);
    expect(Object.isFrozen(empty)).to.equal(true);
    const input = [{ id, yaw: 0, pitch: 0, label: 'Original' }];
    const snapshot = snapshotPanoramaHotspots(input, window);
    input[0]!.label = 'Changed'; input.length = 0;
    expect(snapshot.map(item => [item.id, item.label])).to.deep.equal([[id, 'Original']]);
    expect(Object.isFrozen(snapshot) && Object.isFrozen(snapshot[0])).to.equal(true);
  }), propertyRuns());
});
