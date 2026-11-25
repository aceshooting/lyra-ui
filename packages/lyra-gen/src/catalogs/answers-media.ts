import type { LyraGenCatalog, LyraGenComponent, LyraGenNode, LyraGenSchema } from '../types.js';
import { array, boolean, choice, documentation, label, number, object, string } from './shared.js';

/**
 * Media and entity answer roles. A media card shows an image, video or file whose address must sit
 * on an exact HTTPS origin the host approved; the content policy validates every generated value
 * against those origins. The entity card renders plain text and numbers only: no type palette,
 * callbacks or addresses.
 */
export interface LyraGenMediaOptions {
  /** Exact canonical HTTPS origins (for example `https://cdn.example.com`) generated media may use. */
  readonly origins: readonly string[];
}

const example = (id: string, type: string, props: Record<string, unknown>): LyraGenNode => ({ id, type, props } as LyraGenNode);
const identity: LyraGenSchema = { type: 'string', minLength: 1, maxLength: 128 };
const frame = choice('card', 'plain');

function admitOrigins(options: LyraGenMediaOptions | undefined): readonly string[] {
  const origins = options?.origins;
  if (!Array.isArray(origins) || origins.length === 0 || origins.length > 32) throw new TypeError('A media catalog needs 1-32 exact HTTPS origins.');
  const admitted = origins.map(origin => {
    let url: URL | undefined;
    try { url = typeof origin === 'string' && origin.startsWith('https://') && !origin.includes('*') ? new URL(origin) : undefined; } catch { url = undefined; }
    if (!url || url.origin !== origin) throw new TypeError('Media origins must be canonical HTTPS origins without wildcards, paths or credentials.');
    return url.origin;
  });
  return Object.freeze([...new Set(admitted)]);
}

function mediaComponent(origins: readonly string[]): LyraGenComponent {
  return {
    tag: 'lr-media-card',
    properties: { src: string(2048), kind: choice('image', 'video', 'file'), alt: label, filename: string(256), frame },
    required: ['src', 'kind', 'alt'],
    accessibleName: { required: true, properties: ['alt'] },
    urlSinks: { src: { kind: 'media', origins } },
    minimumBlockSize: '10rem',
    useWhen: `Show one image, video or downloadable file from an approved media origin (${origins.join(', ')}); src must be an https URL on one of those origins, kind is image, video or file, and alt describes it.`,
    examples: [example('diagram', 'media-card', { src: `${origins[0]}/media/architecture.png`, kind: 'image', alt: 'Architecture diagram', filename: 'architecture.png' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-media-card.js'),
    documentation: documentation('lr-media-card'),
  };
}

/** Overlay role definitions; throws when the base already defines `media-card` or no origin is supplied. */
export function mediaComponents(base: LyraGenCatalog, options: LyraGenMediaOptions): Readonly<Record<string, LyraGenComponent>> {
  if (Object.hasOwn(base.components, 'media-card')) throw new TypeError('The base catalog already defines media-card.');
  return { 'media-card': mediaComponent(admitOrigins(options)) };
}

const scalarText: LyraGenSchema = { anyOf: [string(512), number] };
const entity = object({
  id: identity,
  label,
  description: string(2048),
  properties: { type: 'object', properties: {}, additionalProperties: scalarText, maxProperties: 40, propertyNames: { maxLength: 128 } },
  degree: { type: 'integer', minimum: 0, maximum: 1e9 },
  communityId: string(128),
}, ['id', 'label']);

/** An ISO 8601 date or date-time (`2026-11-24` or `2026-11-24T09:30:00Z`); the component ignores any other shape for that field. */
const isoMoment: LyraGenSchema = { type: 'string', minLength: 1, maxLength: 40 };
const calendarEvent = object({ id: identity, title: label, start: isoMoment, end: isoMoment, allDay: boolean, location: string(256), description: string(1024) }, ['title', 'start']);

const coordinate: LyraGenSchema = { type: 'number', minimum: -1e7, maximum: 1e7 };
const position: LyraGenSchema = { type: 'array', items: coordinate, minItems: 2, maxItems: 3 };
const positions = (maximum: number, minimum: number): LyraGenSchema => ({ type: 'array', items: position, minItems: minimum, maxItems: maximum });
const rings = (maximum: number): LyraGenSchema => ({ type: 'array', items: positions(maximum, 4), minItems: 1, maxItems: 2 });
const geometryOf = (kind: string, coordinates: LyraGenSchema): LyraGenSchema => object({ type: choice(kind), coordinates }, ['type', 'coordinates']);
const multi = (item: LyraGenSchema): LyraGenSchema => ({ type: 'array', items: item, minItems: 1, maxItems: 5 });
// Each part holds at most 200 positions, a collection at most 50 features: a few thousand positions in practice.
const geometry: LyraGenSchema = { anyOf: [
  geometryOf('Point', position),
  geometryOf('LineString', positions(200, 2)),
  geometryOf('Polygon', rings(200)),
  geometryOf('MultiPoint', positions(200, 1)),
  geometryOf('MultiLineString', multi(positions(200, 2))),
  geometryOf('MultiPolygon', multi(rings(200))),
] };
const featureProperties: LyraGenSchema = { type: 'object', properties: {}, additionalProperties: scalarText, maxProperties: 20, propertyNames: { maxLength: 64 } };
const feature = object({ type: choice('Feature'), geometry, properties: featureProperties }, ['type', 'geometry']);
const geojsonData: LyraGenSchema = { anyOf: [feature, object({ type: choice('FeatureCollection'), features: { ...array(feature, 50), minItems: 1 } as LyraGenSchema }, ['type', 'features'])] };

/** Roles needing no host configuration, in a stable order. */
export const answerMediaRoles: Readonly<Record<string, LyraGenComponent>> = {
  calendar: {
    tag: 'lr-calendar-viewer',
    properties: { events: array(calendarEvent, 250), name: label },
    required: ['events', 'name'],
    accessibleName: { required: true, properties: ['name'] },
    minimumBlockSize: '12rem',
    useWhen: 'Show at most 250 dated events (title, ISO 8601 start, optional end, allDay, location, description) as an agenda list; dates are YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ.',
    examples: [example('schedule', 'calendar', { name: 'Release schedule', events: [{ id: 'freeze', title: 'Code freeze', start: '2026-12-01', allDay: true }, { id: 'ship', title: 'Release', start: '2026-12-03T09:00:00Z', end: '2026-12-03T10:00:00Z', location: 'Online' }] })],
    load: () => import('@aceshooting/lyra-ui/components/lr-calendar-viewer.js'),
    documentation: documentation('lr-calendar-viewer'),
  },
  geojson: {
    tag: 'lr-geojson-viewer',
    properties: { data: geojsonData, name: label },
    required: ['data', 'name'],
    accessibleName: { required: true, properties: ['name'] },
    minimumBlockSize: '16rem',
    useWhen: 'Draw reviewed GeoJSON geometry (one Feature or a FeatureCollection of at most 50 features: Point, LineString, Polygon and their Multi forms; coordinates are [longitude, latitude]) on a map; properties are short text or number values.',
    examples: [example('route', 'geojson', { name: 'Delivery route', data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Depot' }, geometry: { type: 'Point', coordinates: [8.54, 47.37] } }, { type: 'Feature', properties: { name: 'Route' }, geometry: { type: 'LineString', coordinates: [[8.54, 47.37], [8.7, 47.4]] } }] } })],
    load: () => import('@aceshooting/lyra-ui/components/lr-geojson-viewer.js'),
    documentation: documentation('lr-geojson-viewer'),
  },
  'entity-card': {
    tag: 'lr-entity-card',
    properties: { entity, communityLabel: string(256), headingLevel: choice('1', '2', '3', '4', '5', '6', 'none'), size: choice('s', 'm', 'l'), frame },
    required: ['entity'],
    hostProperties: ['withoutFocusButton'],
    // The focus button asks a host to move a graph; generated content has no handler for it.
    prepareProperties: props => ({ ...props, withoutFocusButton: true }),
    useWhen: 'Show a dossier card for one named entity: its label, a description, up to 40 text or number rows in properties, a relationship count (degree) and a community id; no type badge colours, links or actions.',
    examples: [example('vendor', 'entity-card', { entity: { id: 'acme', label: 'Acme Corp', description: 'Primary hardware supplier.', properties: { Region: 'EU', Contracts: 4 }, degree: 12, communityId: 'suppliers' }, communityLabel: 'Suppliers', headingLevel: '3' })],
    load: () => import('@aceshooting/lyra-ui/components/lr-entity-card.js'),
    documentation: documentation('lr-entity-card'),
  },
};
