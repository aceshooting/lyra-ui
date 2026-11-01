import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { createSimulationClock } from './simulation-clock.js';

it('clamps every admitted seek to the selected range without starting playback', () => {
  fc.assert(fc.property(fc.integer({ min: -1000000, max: 1000000 }), fc.integer({ min: 0, max: 1000000 }), fc.integer({ min: -2000000, max: 2000000 }), (start, span, instant) => {
    const clock = createSimulationClock({ range: [start, start + span], instant: start });
    clock.seek(instant);
    expect(clock.snapshot.instant).to.equal(Math.max(start, Math.min(start + span, instant)));
    expect(clock.snapshot.playing).to.equal(false);
    clock.dispose();
  }), propertyRuns());
});
