import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { deriveNetworkFrame, type SyntheticNetworkFixture, type SyntheticPosition } from '../test/network-monitoring-fixture.js';

const coordinates = fc.record({ longitude: fc.integer({ min: -4000, max: 4000 }), latitude: fc.integer({ min: 46000, max: 51000 }), altitude: fc.integer({ min: 100, max: 1900 }) });
const position = (value: { longitude: number; latitude: number; altitude: number }): SyntheticPosition => ({
  lngLat: [value.longitude / 1000, value.latitude / 1000], altitude: value.altitude, altitudeReference: 'sea-level',
});
function pair(first: SyntheticPosition, last: SyntheticPosition, missingLower = false, missingUpper = false): SyntheticNetworkFixture {
  return {
    nodes: [{ id: 'relay-1', label: 'Relay 1', kind: 'relay' }], links: [], regions: [],
    observations: [
      { instant: 1000, nodes: [{ id: 'relay-1', status: missingLower ? 'missing' : 'available', ...(missingLower ? {} : { position: first }) }], links: [], environment: [] },
      { instant: 11000, nodes: [{ id: 'relay-1', status: missingUpper ? 'missing' : 'degraded', ...(missingUpper ? {} : { position: last }) }], links: [], environment: [] },
    ],
  };
}

it('keeps every nearby finite relay interpolation inside its authored endpoint bounds', () => {
  fc.assert(fc.property(coordinates, coordinates, fc.integer({ min: 0, max: 1000 }), (a, b, thousandths) => {
    const first = position(a), last = position(b), fixture = pair(first, last), instant = 1000 + thousandths * 10;
    const frame = deriveNetworkFrame(fixture, instant, { reducedMotion: false });
    const current = frame.nodes[0]?.position;
    if (!current) throw new Error('Expected present relay');
    const values = [...current.lngLat, current.altitude], lower = [...first.lngLat, first.altitude], upper = [...last.lngLat, last.altitude];
    expect(frame.instant).to.equal(instant); expect(current.altitudeReference).to.equal('sea-level');
    values.forEach((value, axis) => {
      const start = lower[axis]!, end = upper[axis]!;
      expect(Number.isFinite(value)).to.equal(true);
      expect(value).to.be.at.least(Math.min(start, end) - 1e-10); expect(value).to.be.at.most(Math.max(start, end) + 1e-10);
      expect(value).to.be.closeTo(start + (end - start) * thousandths / 1000, 1e-8);
    });
    expect(frame.history[0]?.values).to.deep.equal([1, 1]);
    expect(fixture.observations[0]?.nodes[0]?.position).to.deep.equal(first);
  }), propertyRuns());
});

it('never fills a missing lower observation or interpolates toward a missing upper endpoint', () => {
  fc.assert(fc.property(coordinates, coordinates, fc.integer({ min: 1, max: 9999 }), (a, b, elapsed) => {
    const first = position(a), last = position(b), instant = 1000 + elapsed;
    const absent = deriveNetworkFrame(pair(first, last, true, false), instant, { reducedMotion: false });
    expect(absent.nodes[0]?.position).to.equal(undefined); expect(absent.nodes[0]?.status).to.equal('missing');
    expect(absent.nodes[0]?.positionSource).to.deep.equal({ kind: 'missing', instant: 1000 });
    expect(absent.history[0]?.values).to.deep.equal([null, 1]);
    const held = deriveNetworkFrame(pair(first, last, false, true), instant, { reducedMotion: false });
    expect(held.nodes[0]?.position).to.deep.equal(first);
    expect(held.nodes[0]?.positionSource).to.deep.equal({ kind: 'held', instant: 1000 });
    expect(held.history[0]?.values).to.deep.equal([1, null]);
    const both = deriveNetworkFrame(pair(first, last, true, true), instant, { reducedMotion: false });
    const reducedBoth = deriveNetworkFrame(pair(first, last, true, true), instant, { reducedMotion: true });
    expect(both.nodes[0]?.position).to.equal(undefined); expect(both.nodes[0]?.status).to.equal('missing');
    expect(both.nodes[0]?.positionSource).to.deep.equal({ kind: 'missing', instant: 1000 });
    expect(both.history[0]?.values).to.deep.equal([null, null]); expect(reducedBoth).to.deep.equal(both);
    expect(deriveNetworkFrame(pair(first, last, true, false), instant, { reducedMotion: true }).nodes).to.deep.equal(absent.nodes);
    expect(deriveNetworkFrame(pair(first, last, false, true), instant, { reducedMotion: true }).nodes).to.deep.equal(held.nodes);
  }), propertyRuns());
});

it('holds reduced-motion positions and reproduces prior frames after arbitrary seek order', () => {
  fc.assert(fc.property(coordinates, coordinates, fc.integer({ min: 1, max: 9999 }), (a, b, elapsed) => {
    const first = position(a), last = position(b), fixture = pair(first, last), instant = 1000 + elapsed;
    const before = deriveNetworkFrame(fixture, instant, { reducedMotion: true });
    deriveNetworkFrame(fixture, 11000, { reducedMotion: false });
    const after = deriveNetworkFrame(fixture, instant, { reducedMotion: true });
    expect(after).to.deep.equal(before); expect(after.instant).to.equal(instant);
    expect(after.nodes[0]?.position).to.deep.equal(first);
    expect(after.nodes[0]?.positionSource).to.deep.equal({ kind: 'held', instant: 1000 });
    expect(after.history[0]?.values).to.deep.equal([1, 1]);
  }), propertyRuns());
});
