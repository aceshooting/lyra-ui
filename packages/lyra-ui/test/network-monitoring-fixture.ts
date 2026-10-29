import { createTimeIndex, type TimeLocation } from '../src/time-index.js';

export type SyntheticNodeStatus = 'available' | 'degraded' | 'unavailable' | 'missing';
export type SyntheticLinkStatus = 'available' | 'unavailable';
export type SyntheticEnvironmentCategory = 'clear' | 'advisory';
export interface SyntheticPosition {
  readonly lngLat: readonly [number, number];
  readonly altitude: number;
  readonly altitudeReference: 'sea-level';
}
export interface SyntheticNode {
  readonly id: string;
  readonly label: string;
  readonly kind: 'station' | 'relay';
}
export interface SyntheticLink {
  readonly id: string;
  readonly label: string;
  readonly sourceId: string;
  readonly targetId: string;
}
export interface SyntheticRegion {
  readonly id: string;
  readonly label: string;
  readonly ring: readonly (readonly [number, number])[];
}
export interface SyntheticNodeObservation {
  readonly id: string;
  readonly status: SyntheticNodeStatus;
  readonly position?: SyntheticPosition;
}
export interface SyntheticObservation {
  readonly instant: number;
  readonly nodes: readonly SyntheticNodeObservation[];
  readonly links: readonly { readonly id: string; readonly status: SyntheticLinkStatus }[];
  readonly environment: readonly { readonly id: string; readonly category: SyntheticEnvironmentCategory }[];
}
export interface SyntheticNetworkFixture {
  readonly nodes: readonly SyntheticNode[];
  readonly links: readonly SyntheticLink[];
  readonly regions: readonly SyntheticRegion[];
  readonly observations: readonly SyntheticObservation[];
}
export type SyntheticPositionSource =
  | { readonly kind: 'observed' | 'held' | 'missing'; readonly instant: number }
  | { readonly kind: 'interpolated'; readonly lowerInstant: number; readonly upperInstant: number; readonly fraction: number };
export interface SyntheticFrameNode extends SyntheticNode {
  readonly status: SyntheticNodeStatus;
  readonly position?: SyntheticPosition;
  readonly positionSource: SyntheticPositionSource;
}
export interface SyntheticFrameLink extends SyntheticLink {
  readonly status: SyntheticLinkStatus;
  readonly visible: boolean;
  readonly reason?: 'endpoint-unavailable';
  readonly positions?: readonly [SyntheticPosition, SyntheticPosition];
}
export interface SyntheticAvailabilityHistory {
  readonly id: string;
  readonly instants: readonly number[];
  readonly statuses: readonly SyntheticNodeStatus[];
  readonly values: readonly (0 | 1 | null)[];
}
export interface SyntheticNetworkFrame {
  readonly instant: number;
  readonly location: TimeLocation;
  readonly nodes: readonly SyntheticFrameNode[];
  readonly links: readonly SyntheticFrameLink[];
  readonly environment: readonly (SyntheticRegion & { readonly category: SyntheticEnvironmentCategory })[];
  readonly history: readonly SyntheticAvailabilityHistory[];
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function point(longitude: number, latitude: number, altitude: number): SyntheticPosition {
  return { lngLat: [longitude, latitude], altitude, altitudeReference: 'sea-level' };
}
function copyPosition(value: SyntheticPosition): SyntheticPosition {
  return point(value.lngLat[0], value.lngLat[1], value.altitude);
}
function copyRing(ring: SyntheticRegion['ring']): SyntheticRegion['ring'] {
  return ring.map(([longitude, latitude]) => [longitude, latitude] as const);
}
function rowById<T extends { readonly id: string }>(rows: readonly T[], id: string): T {
  const row = rows.find(value => value.id === id);
  if (!row) throw new RangeError('Missing synthetic observation');
  return row;
}
function observedPosition(row: SyntheticNodeObservation): SyntheticPosition {
  if (!row.position) throw new RangeError('Missing synthetic position');
  return row.position;
}

/** Small authored observations, with no real telemetry or physical reachability calculation. */
export function createNetworkMonitoringFixture(): SyntheticNetworkFixture {
  const nodes: SyntheticNode[] = [
    { id: 'station-a', label: 'Station A', kind: 'station' },
    { id: 'station-b', label: 'Station B', kind: 'station' },
    { id: 'station-c', label: 'Station C', kind: 'station' },
    { id: 'relay-1', label: 'Relay 1', kind: 'relay' },
    { id: 'relay-2', label: 'Relay 2', kind: 'relay' },
  ];
  const links: SyntheticLink[] = [
    { id: 'link-1', label: 'Scheduled link 1', sourceId: 'station-a', targetId: 'station-b' },
    { id: 'link-2', label: 'Scheduled link 2', sourceId: 'station-b', targetId: 'station-c' },
    { id: 'link-3', label: 'Scheduled link 3', sourceId: 'station-c', targetId: 'station-a' },
    { id: 'link-4', label: 'Scheduled link 4', sourceId: 'station-a', targetId: 'relay-1' },
    { id: 'link-5', label: 'Scheduled link 5', sourceId: 'station-c', targetId: 'relay-2' },
    { id: 'link-6', label: 'Scheduled link 6', sourceId: 'relay-1', targetId: 'relay-2' },
  ];
  const regions: SyntheticRegion[] = [
    { id: 'environment-1', label: 'Region 1', ring: [[-4, 48], [-1, 48], [-1, 50], [-4, 50], [-4, 48]] },
    { id: 'environment-2', label: 'Region 2', ring: [[0, 48], [3, 48], [3, 51], [0, 51], [0, 48]] },
  ];
  const base = Date.UTC(2026, 0, 15, 12);
  const offsets = [0, 30, 75, 120, 210, 300, 420, 510, 600];
  const relayOne: readonly (readonly [number, number, number])[] = [
    [-3, 48.2, 900], [-2.8, 48.3, 1000], [-2.5, 48.5, 1100], [-2.2, 48.8, 1200],
    [-1.6, 49.1, 1300], [-0.8, 49.3, 1200], [0, 49.5, 1100], [0.8, 49.6, 1000], [1.4, 49.7, 900],
  ];
  const relayTwo: readonly (readonly [number, number, number])[] = [
    [2.5, 50.2, 800], [2.3, 50.1, 850], [2, 50, 900], [1.7, 49.9, 1000],
    [1.4, 49.8, 1100], [1.1, 49.7, 1000], [0.8, 49.5, 900], [0.5, 49.3, 850], [0.2, 49.1, 800],
  ];
  const observations = offsets.map<SyntheticObservation>((seconds, index) => {
    const first = relayOne[index]!, second = relayTwo[index]!;
    const relayMissing = index === 5;
    return {
      instant: base + seconds * 1000,
      nodes: [
        { id: 'station-a', status: 'available', position: point(-3.5, 48.4, 0) },
        { id: 'station-b', status: index === 3 || index === 4 ? 'degraded' : 'available', position: point(-0.4, 49.6, 0) },
        { id: 'station-c', status: 'available', position: point(2.6, 48.6, 0) },
        { id: 'relay-1', status: 'available', position: point(...first) },
        { id: 'relay-2', status: relayMissing ? 'missing' : 'available', ...(relayMissing ? {} : { position: point(...second) }) },
      ],
      links: links.map((link): SyntheticObservation['links'][number] => ({ id: link.id, status: link.id === 'link-2' && (index === 2 || index === 3) ? 'unavailable' : 'available' })),
      environment: regions.map((region): SyntheticObservation['environment'][number] => ({ id: region.id, category: region.id === 'environment-1' && index >= 2 && index <= 4 ? 'advisory' : 'clear' })),
    };
  });
  return freeze({ nodes, links, regions, observations });
}

/** Derives owned display data from trusted typed example observations; it does not render. */
export function deriveNetworkFrame(
  fixture: SyntheticNetworkFixture,
  instant: number,
  options: { readonly reducedMotion: boolean },
): SyntheticNetworkFrame {
  const index = createTimeIndex(fixture.observations.map(observation => observation.instant));
  const location = index.locate(instant);
  if (!location) throw new RangeError('Synthetic observations are empty');
  const lower = fixture.observations[location.lowerIndex]!, upper = fixture.observations[location.upperIndex]!;
  const nodes = fixture.nodes.map<SyntheticFrameNode>(definition => {
    const current = rowById(lower.nodes, definition.id);
    const metadata: SyntheticNode = { id: definition.id, label: definition.label, kind: definition.kind };
    if (current.status === 'missing') return {
      ...metadata, status: current.status, positionSource: { kind: 'missing', instant: lower.instant },
    };
    const first = observedPosition(current);
    const next = rowById(upper.nodes, definition.id);
    if (definition.kind === 'relay' && !options.reducedMotion && location.lowerIndex !== location.upperIndex && next.status !== 'missing') {
      const last = observedPosition(next), fraction = location.fraction;
      return {
        ...metadata, status: current.status,
        position: point(first.lngLat[0] + (last.lngLat[0] - first.lngLat[0]) * fraction,
          first.lngLat[1] + (last.lngLat[1] - first.lngLat[1]) * fraction,
          first.altitude + (last.altitude - first.altitude) * fraction),
        positionSource: { kind: 'interpolated', lowerInstant: lower.instant, upperInstant: upper.instant, fraction },
      };
    }
    return {
      ...metadata, status: current.status, position: copyPosition(first),
      positionSource: { kind: instant === lower.instant ? 'observed' : 'held', instant: lower.instant },
    };
  });
  const links = fixture.links.map<SyntheticFrameLink>(definition => {
    const status = rowById(lower.links, definition.id).status;
    const source = rowById(nodes, definition.sourceId).position, target = rowById(nodes, definition.targetId).position;
    const metadata: SyntheticLink = { id: definition.id, label: definition.label, sourceId: definition.sourceId, targetId: definition.targetId };
    return source && target
      ? { ...metadata, status, visible: true, positions: [copyPosition(source), copyPosition(target)] }
      : { ...metadata, status, visible: false, reason: 'endpoint-unavailable' };
  });
  const environment = fixture.regions.map(region => ({
    id: region.id, label: region.label, ring: copyRing(region.ring), category: rowById(lower.environment, region.id).category,
  }));
  const history = fixture.nodes.map<SyntheticAvailabilityHistory>(definition => {
    const statuses = fixture.observations.map(observation => rowById(observation.nodes, definition.id).status);
    return {
      id: definition.id, instants: fixture.observations.map(observation => observation.instant), statuses,
      values: statuses.map(status => status === 'missing' ? null : status === 'unavailable' ? 0 : 1),
    };
  });
  return freeze({ instant, location, nodes, links, environment, history });
}
