import type { JsonValue, LyraGenCatalog, LyraGenComponent, LyraGenSchema } from '../types.js';
import { array, documentation, label, object, string } from './shared.js';

/** A host-reviewed region set generated content may colour by id; geometry never comes from content. */
interface LyraGenMapRegions {
  /** GeoJSON FeatureCollection of at most 1000 features, each carrying a unique string id. */
  readonly geojson: { readonly type: 'FeatureCollection'; readonly features: readonly { readonly type: 'Feature'; readonly properties?: Readonly<Record<string, unknown>> | null; readonly geometry: unknown }[] };
  /** Feature property holding each region's id. */
  readonly idProperty: string;
  /** Ascending fill colours; CSS custom-property references follow the theme. Defaults to the brand fill ramp. */
  readonly palette?: readonly string[];
}

/** Host-owned map resources. Generated content can never select a style, tile source, engine or geometry. */
export interface LyraGenMapOptions {
  /** MapLibre style URL or style specification, assigned as `mapStyle` only by the host adapter. */
  readonly mapStyle: string | Readonly<Record<string, unknown>>;
  /** Optional reviewed regions; enables generated `choropleth` values keyed by region id. */
  readonly regions?: LyraGenMapRegions;
}

const DEFAULT_PALETTE = Object.freeze(['var(--lr-color-brand-fill-quiet)', 'var(--lr-color-brand-fill-normal)', 'var(--lr-color-brand-fill-loud)']);
const REGION_FIELD = 'value';

interface AdmittedRegions { readonly features: readonly Readonly<Record<string, unknown>>[]; readonly ids: ReadonlyMap<string, number>; readonly idProperty: string; readonly palette: readonly string[] }
function admitRegions(regions: LyraGenMapRegions): AdmittedRegions {
  const features = regions?.geojson?.type === 'FeatureCollection' && Array.isArray(regions.geojson.features) ? regions.geojson.features : undefined;
  const palette = regions.palette ?? DEFAULT_PALETTE;
  if (!features || features.length === 0 || features.length > 1000 || typeof regions.idProperty !== 'string' || !regions.idProperty || !Array.isArray(palette) || palette.length === 0 || palette.length > 16 || palette.some(color => typeof color !== 'string' || !color || color.length > 256)) throw new TypeError('Map regions need 1-1000 features, an id property and a 1-16 colour palette.');
  const ids = new Map<string, number>();
  const copies = features.map((feature, index) => {
    const id = feature?.properties?.[regions.idProperty];
    if (feature?.type !== 'Feature' || typeof id !== 'string' || !id || id.length > 128 || ids.has(id)) throw new TypeError('Every map region needs a unique string id.');
    ids.set(id, index);
    return Object.freeze(structuredClone(feature) as Record<string, unknown>);
  });
  return Object.freeze({ features: Object.freeze(copies), ids, idProperty: regions.idProperty, palette: Object.freeze([...palette]) });
}

/** Build the lr-map choropleth layer from generated values; unknown region ids fail closed. */
function regionChoropleth(regions: AdmittedRegions, values: Readonly<Record<string, number>>, interpolation?: string): Readonly<Record<string, unknown>> {
  const entries = Object.entries(values);
  for (const [id] of entries) if (!regions.ids.has(id)) throw new TypeError('Choropleth values must name declared regions.');
  const features = entries.map(([id, value]) => {
    const feature = regions.features[regions.ids.get(id)!]!;
    return { ...feature, properties: { ...(feature['properties'] as Record<string, unknown> | null ?? {}), [REGION_FIELD]: value } };
  });
  const numbers = entries.map(([, value]) => value);
  const minimum = numbers.length ? Math.min(...numbers) : 0;
  const maximum = numbers.length ? Math.max(...numbers) : 0;
  const { palette } = regions;
  const stops = palette.length === 1 || minimum === maximum ? [[minimum, palette[palette.length - 1]!]] : palette.map((color, index) => [minimum + (maximum - minimum) * index / (palette.length - 1), color]);
  return { sourceId: 'lyra-gen-regions', geojson: { type: 'FeatureCollection', features }, field: REGION_FIELD, stops, ...(interpolation === 'logarithmic' && minimum > 0 ? { interpolation } : {}) };
}

const coordinate: LyraGenSchema = { type: 'number', minimum: -180, maximum: 180 };
const lngLat: LyraGenSchema = { type: 'array', items: coordinate, minItems: 2, maxItems: 2 };
const marker = object({ id: string(128), lngLat, label }, ['lngLat', 'label']);

/** The `map` role: bounded markers and camera over a host-owned basemap. */
function mapComponent(options: LyraGenMapOptions): LyraGenComponent {
  const style = options?.mapStyle;
  if (!(typeof style === 'string' ? style.length > 0 : style !== null && typeof style === 'object')) throw new TypeError('A map catalog needs a host-owned mapStyle.');
  const mapStyle = typeof style === 'string' ? style : Object.freeze(structuredClone(style));
  const regions = options.regions ? admitRegions(options.regions) : undefined;
  const choropleth: LyraGenSchema = object({
    values: { type: 'object', properties: {}, additionalProperties: { type: 'number', minimum: -1e12, maximum: 1e12 }, minProperties: 1, maxProperties: Math.min(1000, regions?.ids.size ?? 1), propertyNames: { maxLength: 128 } },
    interpolation: { type: 'string', enum: ['linear', 'logarithmic'] },
  }, ['values']);
  return {
    tag: 'lr-map',
    properties: { label, center: lngLat, zoom: { type: 'number', minimum: 0, maximum: 22 }, markers: array(marker, 500), ...(regions ? { choropleth, choroplethLegend: { type: 'boolean' } } : {}) },
    required: ['label'],
    accessibleName: { required: true, properties: ['label'] },
    hostProperties: ['mapStyle'],
    prepareProperties: (props: Readonly<Record<string, JsonValue>>) => {
      const generated = props['choropleth'] as { readonly values: Readonly<Record<string, number>>; readonly interpolation?: string } | undefined;
      const { choropleth: _omitted, ...rest } = props;
      return { ...rest, mapStyle, ...(regions && generated ? { choropleth: regionChoropleth(regions, generated.values, generated.interpolation) } : {}) };
    },
    minimumBlockSize: '18rem',
    useWhen: regions
      ? `Place at most 500 labelled points on a map, or colour the declared regions by value with choropleth.values keyed by region id (${[...regions.ids.keys()].slice(0, 40).join(', ')}${regions.ids.size > 40 ? ', ...' : ''}); center is [longitude, latitude] and zoom ranges 0-22.`
      : 'Place at most 500 labelled points on a map; center is [longitude, latitude] and zoom ranges 0-22.',
    examples: [{ id: 'sites', type: 'map', props: { label: 'Data centre locations', center: [8.5, 47.4], zoom: 4, markers: [{ id: 'zurich', lngLat: [8.54, 47.37], label: 'Zurich' }, { id: 'paris', lngLat: [2.35, 48.86], label: 'Paris' }] } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-map.js'),
    documentation: documentation('lr-map'),
  };
}

/** Overlay role definitions; throws when the base already defines `map`. */
export function mapComponents(base: LyraGenCatalog, options: LyraGenMapOptions): Readonly<Record<string, LyraGenComponent>> {
  if (Object.hasOwn(base.components, 'map')) throw new TypeError('The base catalog already defines map.');
  return { map: mapComponent(options) };
}
