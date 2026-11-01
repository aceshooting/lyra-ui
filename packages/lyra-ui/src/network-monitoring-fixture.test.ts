import { expect } from '@open-wc/testing';
import { createSimulationClock } from './simulation-clock.js';
import {
  createNetworkMonitoringFixture,
  deriveNetworkFrame,
  type SyntheticNetworkFixture,
  type SyntheticNodeStatus,
  type SyntheticPosition,
} from '../test/network-monitoring-fixture.js';

interface Sample {
  readonly instant: number;
  readonly status: SyntheticNodeStatus;
  readonly position?: SyntheticPosition;
  readonly link?: 'available' | 'unavailable';
  readonly category?: 'clear' | 'advisory';
}
const position = (longitude: number, latitude: number, altitude: number): SyntheticPosition => ({
  lngLat: [longitude, latitude], altitude, altitudeReference: 'sea-level',
});
function scenario(samples: readonly Sample[]): SyntheticNetworkFixture {
  return {
    nodes: [{ id: 'station-a', label: 'Station A', kind: 'station' }, { id: 'relay-1', label: 'Relay 1', kind: 'relay' }],
    links: [{ id: 'link-1', label: 'Scheduled link 1', sourceId: 'station-a', targetId: 'relay-1' }],
    regions: [{ id: 'environment-1', label: 'Region 1', ring: [[-4, 48], [0, 48], [0, 50], [-4, 50], [-4, 48]] }],
    observations: samples.map(sample => ({
      instant: sample.instant,
      nodes: [{ id: 'station-a', status: 'available' as const, position: position(-3, 49, 0) },
        { id: 'relay-1', status: sample.status, ...(sample.position ? { position: sample.position } : {}) }],
      links: [{ id: 'link-1', status: sample.link ?? 'available' }],
      environment: [{ id: 'environment-1', category: sample.category ?? 'clear' }],
    })),
  };
}
const node = (frame: ReturnType<typeof deriveNetworkFrame>, id = 'relay-1') => {
  const found = frame.nodes.find(row => row.id === id);
  if (!found) throw new Error('Expected synthetic node row');
  return found;
};
function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).to.equal(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}

it('owns a small reproducible synthetic fixture with irregular UTC observations and stable references', () => {
  const fixture = createNetworkMonitoringFixture();
  const base = Date.UTC(2026, 0, 15, 12);
  expect(fixture.observations.map(sample => sample.instant - base)).to.deep.equal([0, 30, 75, 120, 210, 300, 420, 510, 600].map(seconds => seconds * 1000));
  expect(fixture.nodes.map(row => row.id)).to.deep.equal(['station-a', 'station-b', 'station-c', 'relay-1', 'relay-2']);
  expect(fixture.nodes.filter(row => row.kind === 'station').length).to.equal(3);
  expect(fixture.nodes.filter(row => row.kind === 'relay').length).to.equal(2);
  expect(fixture.links.length).to.be.within(1, 6);
  expect(new Set(fixture.links.map(row => row.id)).size).to.equal(fixture.links.length);
  expect(new Set([...fixture.nodes, ...fixture.links].map(row => row.id)).size).to.equal(fixture.nodes.length + fixture.links.length);
  expect(fixture.regions.map(row => row.id)).to.deep.equal(['environment-1', 'environment-2']);
  expect(fixture.regions.reduce((sum, region) => sum + region.ring.length, 0)).to.be.at.most(64);
  const ids = new Set(fixture.nodes.map(row => row.id));
  for (const link of fixture.links) {
    expect(ids.has(link.sourceId)).to.equal(true); expect(ids.has(link.targetId)).to.equal(true);
    expect(link.sourceId === link.targetId).to.equal(false);
  }
  for (const sample of fixture.observations) {
    expect(sample.nodes.map(row => row.id)).to.deep.equal(fixture.nodes.map(row => row.id));
    expect(sample.links.map(row => row.id)).to.deep.equal(fixture.links.map(row => row.id));
    expect(sample.environment.map(row => row.id)).to.deep.equal(fixture.regions.map(row => row.id));
    for (const row of sample.nodes) {
      if (!row.position) { expect(row.status).to.equal('missing'); continue; }
      expect(row.position.altitudeReference).to.equal('sea-level');
      expect(row.position.lngLat.every(Number.isFinite)).to.equal(true);
      expect(row.position.lngLat[0]).to.be.within(-10, 10); expect(row.position.lngLat[1]).to.be.within(45, 53);
      expect(row.position.altitude).to.be.within(0, 1999);
      if (row.id.startsWith('relay-')) expect(row.position.altitude).to.be.greaterThan(0);
    }
  }
  for (const definition of fixture.nodes) {
    const positions = fixture.observations.map(sample => sample.nodes.find(row => row.id === definition.id)?.position).filter(value => value !== undefined);
    const distinct = new Set(positions.map(value => JSON.stringify(value)));
    if (definition.kind === 'station') {
      expect(positions.length).to.equal(fixture.observations.length); expect(distinct.size).to.equal(1);
    } else expect(distinct.size).to.be.at.least(2);
  }
  const stationIds = new Set(fixture.nodes.filter(row => row.kind === 'station').map(row => row.id));
  const relay = fixture.observations.map(sample => sample.nodes.find(row => row.id === 'relay-2')?.status);
  const missing = relay.indexOf('missing');
  expect(missing).to.be.greaterThan(0); expect(relay.slice(missing + 1).some(status => status === 'available')).to.equal(true);
  expect(fixture.observations.some(sample => sample.nodes.some(row => row.status === 'degraded' && stationIds.has(row.id)))).to.equal(true);
  expect(fixture.observations.some(sample => sample.links.some(row => row.status === 'unavailable'))).to.equal(true);
  expectDeepFrozen(fixture);
  const second = createNetworkMonitoringFixture();
  expect(second).to.deep.equal(fixture); expect(second === fixture).to.equal(false);
});

it('keeps exact selected epoch time while locating irregular samples and clamping lookup endpoints', () => {
  const fixture = scenario([{ instant: 1000, status: 'available', position: position(-2, 48, 100) },
    { instant: 5000, status: 'available', position: position(2, 50, 900) },
    { instant: 13000, status: 'available', position: position(3, 51, 1100) }]);
  const middle = deriveNetworkFrame(fixture, 9000, { reducedMotion: false });
  expect(middle.instant).to.equal(9000);
  expect(middle.location).to.deep.equal({ lowerIndex: 1, upperIndex: 2, nearestIndex: 1, fraction: 0.5 });
  for (const [instant, index] of [[-1000, 0], [1000, 0], [5000, 1], [13000, 2], [20000, 2]] as const) {
    const frame = deriveNetworkFrame(fixture, instant, { reducedMotion: false });
    expect(frame.instant).to.equal(instant); expect(frame.location.lowerIndex).to.equal(index);
    expect(frame.location.upperIndex).to.equal(index); expect(frame.location.fraction).to.equal(0);
    const observedAt = fixture.observations[index]!.instant;
    expect(node(frame).positionSource).to.deep.equal({ kind: instant === observedAt ? 'observed' : 'held', instant: observedAt });
  }
});

it('interpolates only present relay coordinates and keeps categorical state at the lower observation', () => {
  const fixture = scenario([{ instant: 1000, status: 'available', position: position(-2, 48, 100), link: 'unavailable', category: 'clear' },
    { instant: 5000, status: 'degraded', position: position(2, 50, 900), link: 'available', category: 'advisory' }]);
  const frame = deriveNetworkFrame(fixture, 2000, { reducedMotion: false });
  expect(node(frame).position).to.deep.equal(position(-1, 48.5, 300));
  expect(node(frame).status).to.equal('available');
  expect(node(frame).positionSource).to.deep.equal({ kind: 'interpolated', lowerInstant: 1000, upperInstant: 5000, fraction: 0.25 });
  expect(node(frame, 'station-a').position).to.deep.equal(position(-3, 49, 0));
  expect(frame.links[0]?.status).to.equal('unavailable'); expect(frame.environment[0]?.category).to.equal('clear');
  const exact = deriveNetworkFrame(fixture, 5000, { reducedMotion: false });
  expect(node(exact).status).to.equal('degraded'); expect(exact.environment[0]?.category).to.equal('advisory');
  expect(node(exact).positionSource).to.deep.equal({ kind: 'observed', instant: 5000 });
});

it('holds a present lower position before a missing endpoint with explicit observed-at provenance', () => {
  const fixture = scenario([{ instant: 1000, status: 'available', position: position(-2, 48, 100) },
    { instant: 5000, status: 'missing' }, { instant: 9000, status: 'available', position: position(2, 50, 900) }]);
  const held = deriveNetworkFrame(fixture, 3000, { reducedMotion: false });
  expect(held.instant).to.equal(3000); expect(node(held).position).to.deep.equal(position(-2, 48, 100));
  expect(node(held).positionSource).to.deep.equal({ kind: 'held', instant: 1000 });
  expect(held.links[0]?.visible).to.equal(true);
  for (const instant of [5000, 7000, 8999]) {
    const missing = deriveNetworkFrame(fixture, instant, { reducedMotion: false });
    const reducedMissing = deriveNetworkFrame(fixture, instant, { reducedMotion: true });
    expect(reducedMissing.nodes).to.deep.equal(missing.nodes); expect(reducedMissing.links).to.deep.equal(missing.links);
    expect(node(missing).status).to.equal('missing'); expect(node(missing).position).to.equal(undefined);
    expect(node(missing).positionSource).to.deep.equal({ kind: 'missing', instant: 5000 });
    expect(missing.links[0]?.visible).to.equal(false); expect(missing.links[0]?.reason).to.equal('endpoint-unavailable');
    expect(missing.links[0]?.positions).to.equal(undefined);
  }
  const recovery = deriveNetworkFrame(fixture, 9000, { reducedMotion: false });
  expect(node(recovery).position).to.deep.equal(position(2, 50, 900));
  expect(node(recovery).positionSource).to.deep.equal({ kind: 'observed', instant: 9000 });
  expect(recovery.links[0]?.visible).to.equal(true); expect(recovery.links[0]?.reason).to.equal(undefined);
});

it('holds reduced-motion positions between samples without changing exact time, status or history', () => {
  const fixture = scenario([{ instant: 1000, status: 'available', position: position(-2, 48, 100) },
    { instant: 5000, status: 'unavailable', position: position(2, 50, 900) }]);
  const smooth = deriveNetworkFrame(fixture, 3000, { reducedMotion: false });
  const reduced = deriveNetworkFrame(fixture, 3000, { reducedMotion: true });
  expect(reduced.instant).to.equal(3000); expect(reduced.location).to.deep.equal(smooth.location);
  expect(node(reduced).position).to.deep.equal(position(-2, 48, 100));
  expect(node(reduced).positionSource).to.deep.equal({ kind: 'held', instant: 1000 });
  expect(node(reduced).status).to.equal(node(smooth).status); expect(reduced.history).to.deep.equal(smooth.history);
  const exact = deriveNetworkFrame(fixture, 5000, { reducedMotion: true });
  expect(node(exact).position).to.deep.equal(position(2, 50, 900));
  expect(node(exact).positionSource).to.deep.equal({ kind: 'observed', instant: 5000 });
});

it('keeps degraded availability binary and missing history absent without interpolating health', () => {
  const fixture = scenario([{ instant: 1000, status: 'available', position: position(-2, 48, 100) },
    { instant: 5000, status: 'degraded', position: position(-1, 49, 300) },
    { instant: 9000, status: 'unavailable', position: position(0, 50, 500) },
    { instant: 13000, status: 'missing' }]);
  const frame = deriveNetworkFrame(fixture, 7000, { reducedMotion: false });
  expect(frame.history.map(row => row.id)).to.deep.equal(['station-a', 'relay-1']);
  const history = frame.history.find(row => row.id === 'relay-1');
  expect(history?.instants).to.deep.equal([1000, 5000, 9000, 13000]);
  expect(history?.statuses).to.deep.equal(['available', 'degraded', 'unavailable', 'missing']);
  expect(history?.values).to.deep.equal([1, 1, 0, null]);
  expect(node(frame).status).to.equal('degraded');
});

it('does not infer link availability from geometry or environmental advisory categories', () => {
  const fixture = scenario([{ instant: 1000, status: 'unavailable', position: position(-2, 48, 100), link: 'available', category: 'advisory' },
    { instant: 5000, status: 'available', position: position(2, 50, 900), link: 'unavailable', category: 'clear' }]);
  const frame = deriveNetworkFrame(fixture, 1000, { reducedMotion: false });
  expect(node(frame).status).to.equal('unavailable'); expect(frame.links[0]?.status).to.equal('available');
  expect(frame.links[0]?.visible).to.equal(true); expect(frame.links[0]?.positions).to.deep.equal([position(-3, 49, 0), position(-2, 48, 100)]);
  expect(frame.environment[0]?.category).to.equal('advisory');
  expect(frame.links[0]?.sourceId).to.equal('station-a'); expect(frame.links[0]?.targetId).to.equal('relay-1');
});

it('returns detached deeply frozen frames and does not mutate caller data or earlier seeks', () => {
  const mutablePosition = { lngLat: [-2, 48] as [number, number], altitude: 100, altitudeReference: 'sea-level' as const };
  const mutableRegionPoint: [number, number] = [-4, 48];
  const baseFixture = scenario([{ instant: 1000, status: 'available', position: mutablePosition },
    { instant: 5000, status: 'available', position: position(2, 50, 900) }]);
  const fixture: SyntheticNetworkFixture = { ...baseFixture, regions: baseFixture.regions.map(region => ({
    ...region, ring: [mutableRegionPoint, ...region.ring.slice(1)],
  })) };
  const before = JSON.stringify(fixture);
  const first = deriveNetworkFrame(fixture, 1000, { reducedMotion: false });
  const later = deriveNetworkFrame(fixture, 3000, { reducedMotion: false });
  const back = deriveNetworkFrame(fixture, 1000, { reducedMotion: false });
  expect(JSON.stringify(fixture)).to.equal(before); expect(back).to.deep.equal(first);
  expect(node(later).position).to.deep.equal(position(0, 49, 500));
  expectDeepFrozen(first); expectDeepFrozen(later);
  expect(node(first).position === mutablePosition).to.equal(false);
  expect(node(first).position?.lngLat === mutablePosition.lngLat).to.equal(false);
  expect(first.environment[0]?.ring === fixture.regions[0]?.ring).to.equal(false);
  expect(Object.isFrozen(mutablePosition)).to.equal(false); expect(Object.isFrozen(mutablePosition.lngLat)).to.equal(false);
  expect(first.environment[0]?.ring[0] === mutableRegionPoint).to.equal(false); expect(Object.isFrozen(mutableRegionPoint)).to.equal(false);
  mutablePosition.lngLat[0] = -8; mutablePosition.altitude = 1800; mutableRegionPoint[0] = -9;
  expect(node(first).position).to.deep.equal(position(-2, 48, 100));
  expect(first.environment[0]?.ring[0]).to.deep.equal([-4, 48]);
  expect(first.history.find(row => row.id === 'relay-1')?.values).to.deep.equal([1, 1]);
});

it('derives one logical frame from a real paused shared-clock snapshot without a scheduling side effect', () => {
  const fixture = createNetworkMonitoringFixture();
  const start = fixture.observations[0]?.instant, end = fixture.observations.at(-1)?.instant;
  if (start === undefined || end === undefined) throw new Error('Expected observation domain');
  let scheduled = 0;
  const clock = createSimulationClock({ range: [start, end], instant: start }, { scheduler: {
    monotonicNow: () => 0, epochNow: () => start, requestFrame: () => { scheduled++; return 1; }, cancelFrame: () => undefined,
  } });
  const seen: ReturnType<typeof deriveNetworkFrame>[] = [];
  try {
    const unsubscribe = clock.subscribe(snapshot => { seen.push(deriveNetworkFrame(fixture, snapshot.instant, { reducedMotion: false })); });
    clock.seek(start + 90000);
    expect(seen.length).to.equal(2); expect(seen.at(-1)?.instant).to.equal(clock.snapshot.instant);
    expect(clock.snapshot.playing).to.equal(false); expect(scheduled).to.equal(0);
    unsubscribe();
  } finally { clock.dispose(); }
});

it('refuses nonfinite selected instants instead of emitting a plausible frame', () => {
  const fixture = createNetworkMonitoringFixture();
  for (const instant of [NaN, Infinity, -Infinity]) expect(() => deriveNetworkFrame(fixture, instant, { reducedMotion: false })).to.throw();
});
