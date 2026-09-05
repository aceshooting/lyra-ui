import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type {
  LyraMapChoroplethLayer,
  LyraMapGeoJsonDataLayer,
  LyraMapLegendEntry,
  LyraMapMarker,
  LyraMapMarkerActivationDetail,
} from './map.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';
import '../../../../../../.storybook/maplibre-worker.js';

const legend = (): LyraMapLegendEntry[] => [
  { color: storyColor('brand'), label: 'Low', pattern: 'solid' },
  { color: storyColor('danger'), label: 'High', pattern: 'diagonal' },
];

const RASTER_STYLE = {
  version: 8,
  sources: {
    demo: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'demo', type: 'raster', source: 'demo' }],
};

// A self-contained raster style: the single tile is an inlined data-URI PNG (a neutral grid),
// so this style needs no network at all. The Default story uses it because that is the story the
// visual-regression harness screenshots -- a style fetching live tiles from tile.openstreetmap.org
// makes the baseline depend on an external service and network timing (non-deterministic offline /
// in CI, and the largest, noisiest baseline in the set). The component's real behavior under test
// here -- the raster layer, the declarative legend, the attribution row, and their RTL mirroring --
// is exercised identically over this fixed tile. The `LiveOsmTiles` story below keeps the real-OSM
// demo for the docs page.
const OFFLINE_RASTER_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAA/0lEQVR4AeXBsY1YMQxEwXeL3wJBqP+aHDm5jCBYhK0aqHBnfv78/f2HsY/rZLBVPZwMtqqHk8FW9XAy2BLmhDlhTpgT5oQ5YU6YE+aEOWFOmBPmhLmPq3p4UT28qB5eVA9bH9fJYKt6OBlsVQ8ng63q4WSwJcwJc8KcMCfMCXPCnDAnzAlzwpwwJ8wJcx9X9fCienhRPbyoHrY+rpPBVvVwMtiqHk4GW9XDyWBLmBPmhDlhTpgT5oQ5YU6YE+aEOWFOmBPmPq7q4UX18KJ6eFE9bH1cJ4Ot6uFksFU9nAy2qoeTwZYwJ8wJc8KcMCfMCXPCnDAnzAlzwpwwJ8z9B2UdSfWg4cuTAAAAAElFTkSuQmCC';
const OFFLINE_RASTER_STYLE = {
  version: 8,
  sources: {
    demo: {
      type: 'raster',
      tiles: [OFFLINE_RASTER_TILE],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'demo', type: 'raster', source: 'demo' }],
};

const longLtrLegend = 'LongestUnbrokenLegendLabelForNarrowMapLayouts'.repeat(10);
const longRtlLegend = 'أطولتسميةوسيلةإيضاحمتصلةلخريطةضيقة'.repeat(10);
const longLtrPopup = 'LongMarkerPopupContentWithoutSpaces'.repeat(10);
const longRtlPopup = 'محتوىنافذةعلامةطويلمتصل'.repeat(12);

const meta: Meta = {
  title: 'Map',
  component: 'lr-map',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Markers and popups keep the physical geographic projection origin in both text directions. Live ancestor theme changes refresh choropleth stop/base colors and opacity without rebuilding sources or layers. Requires an explicit `mapStyle`; the deterministic default story uses a network-silent inlined raster tile, while the opt-in live story demonstrates OpenStreetMap tiles. Explicit marker IDs and `dataLayers[].sourceId` values are trimmed, nonempty, and first-wins; idless colocated markers remain distinct by occurrence. Peer/custom markers retain a 24px minimum target in both axes even without intrinsic content size.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-map
      style="height: 20rem"
      center="[2.3522, 48.8566]"
      zoom="4"
      .legend=${legend()}
      .mapStyle=${OFFLINE_RASTER_STYLE}
    ></lr-map>
  `,
};

/** The legend owns a frozen 100-row projection, keeps a required non-color pattern for every
 * category, and reports omitted input through `legendProjection` plus visible localized text. */
export const BoundedSemanticLegend: Story = {
  render: () => {
    const patterns = ['solid', 'diagonal', 'dots', 'crosshatch'] as const;
    const entries: LyraMapLegendEntry[] = Array.from({ length: 104 }, (_, index) => ({
      color: index % 2 === 0 ? storyColor('brand') : storyColor('danger'),
      label: `Category ${index + 1}`,
      pattern: patterns[index % patterns.length]!,
    }));
    return html`
      <lr-map
        style="height: 20rem"
        .legend=${entries}
        .mapStyle=${OFFLINE_RASTER_STYLE}
      ></lr-map>
    `;
  },
};

/** A bare map never selects or contacts a style/tile provider. It fails closed with the localized
 * style-required state until `mapStyle` is assigned. */
export const ExplicitStyleRequired: Story = {
  render: () => html`<lr-map style="height: 12rem"></lr-map>`,
};

/**
 * The same map over a live OpenStreetMap raster tile source. Kept separate from `Default`
 * (which uses a self-contained offline tile so its screenshot is reproducible) so the docs
 * still show real geography. Needs network access to `tile.openstreetmap.org`.
 */
export const LiveOsmTiles: Story = {
  render: () => html`
    <lr-map
      style="height: 20rem"
      center="[2.3522, 48.8566]"
      zoom="4"
      .legend=${legend()}
      .mapStyle=${RASTER_STYLE}
    ></lr-map>
  `,
};

/**
 * `choropleth` adds a GeoJSON fill layer. This heavy-tailed example uses logarithmic interpolation
 * and feeds the exact same stops to the continuous legend, keeping the visible key truthful.
 */
export const Choropleth: Story = {
  render: () => {
    const choropleth: LyraMapChoroplethLayer = {
      sourceId: 'regions',
      field: 'value',
      stops: [
        [0, storyColor('brand')],
        [50, storyColor('warning')],
        [100, storyColor('danger')],
      ],
      interpolation: 'logarithmic',
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { value: 20 },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [2.25, 48.9],
                  [2.35, 48.9],
                  [2.35, 48.85],
                  [2.25, 48.85],
                  [2.25, 48.9],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { value: 80 },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [2.35, 48.9],
                  [2.45, 48.9],
                  [2.45, 48.85],
                  [2.35, 48.85],
                  [2.35, 48.9],
                ],
              ],
            },
          },
        ],
      },
    };
    return html`
      <lr-map
        style="height: 20rem"
        center="[2.3522, 48.8566]"
        zoom="10"
        .legendGradient=${choropleth.stops}
        .choropleth=${choropleth}
        .mapStyle=${RASTER_STYLE}
      ></lr-map>
    `;
  },
};

/**
 * `dataLayers` renders arbitrary GeoJSON shapes (routes, zones, points of
 * interest) as a source plus fill/line/circle layers, colored by an optional
 * `tone` -- independent of `choropleth`, which requires a `field`/`stops`
 * color ramp and can't display plain geometry.
 */
export const DataLayers: Story = {
  render: () => {
    const dataLayers: LyraMapGeoJsonDataLayer[] = [
      {
        sourceId: 'route',
        tone: 'success',
        geojson: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [2.2945, 48.8584],
              [2.3364, 48.8606],
              [2.3522, 48.8566],
            ],
          },
        },
      },
      {
        sourceId: 'poi',
        tone: 'danger',
        geojson: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
        },
      },
    ];
    return html`
      <lr-map
        style="height: 20rem"
        center="[2.3522, 48.8566]"
        zoom="12"
        .dataLayers=${dataLayers}
        .mapStyle=${RASTER_STYLE}
      ></lr-map>
    `;
  },
};

export const ThemedFillOpacity: Story = {
  name: 'Themed choropleth and data-layer fill opacity (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-map-choropleth-fill-opacity` is inherited from the wrapper and repaints both the choropleth and polygon data-layer fills without recreating their MapLibre sources or layers.',
      },
    },
  },
  render: () => {
    const choropleth: LyraMapChoroplethLayer = {
      sourceId: 'theme-regions',
      field: 'value',
      stops: [[0, storyColor('brand')], [100, storyColor('danger')]],
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { value: 70 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[2.26, 48.89], [2.34, 48.89], [2.34, 48.84], [2.26, 48.84], [2.26, 48.89]]],
          },
        }],
      },
    };
    const dataLayers: LyraMapGeoJsonDataLayer[] = [{
      sourceId: 'theme-zone',
      tone: 'success',
      geojson: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[2.35, 48.89], [2.43, 48.89], [2.43, 48.84], [2.35, 48.84], [2.35, 48.89]]],
        },
      },
    }];
    return html`
      <div style="--lr-map-choropleth-fill-opacity: 0.42">
        <lr-map
          style="block-size: var(--lr-size-20rem)"
          center="[2.3522, 48.8566]"
          zoom="11"
          .choropleth=${choropleth}
          .dataLayers=${dataLayers}
          .mapStyle=${OFFLINE_RASTER_STYLE}
        ></lr-map>
      </div>
    `;
  },
};

/**
 * `markers` renders a keyboard-focusable pin per entry. Pointer, Enter, and Space activation emit
 * `lr-map-marker-activate` with its authored id and marker snapshot. `renderWorldCopies = false`
 * is a construction-time option that keeps this story to one horizontal world.
 */
export const Markers: Story = {
  render: () => {
    const markers: LyraMapMarker[] = [
      { id: 'eiffel', lngLat: [2.2945, 48.8584], label: 'Eiffel Tower' },
      {
        id: 'louvre',
        lngLat: [2.3364, 48.8606],
        color: storyColor('danger'),
        unsafeHtml: '<strong>Louvre</strong><br>Museum',
      },
    ];
    return html`
      <lr-map
        style="height: 20rem"
        center="[2.3522, 48.8566]"
        zoom="12"
        .renderWorldCopies=${false}
        .markers=${markers}
        .mapStyle=${RASTER_STYLE}
        @lr-map-marker-activate=${(
          event: CustomEvent<LyraMapMarkerActivationDetail>,
        ) => console.log('marker activate', event.detail)}
      ></lr-map>
    `;
  },
};

/**
 * A deterministic scatter of points around Paris, dense enough that one DOM marker per entry --
 * what `markers` does -- would be both unreadable and expensive. `cluster` turns the entry's
 * GeoJSON source into a natively clustered one instead: an aggregate circle that grows with
 * `point_count`, a count label, and the points that stayed unclustered. Zoom past `maxZoom` and the
 * clusters resolve back into individual points.
 *
 * The count label needs a glyph source, which this deliberately network-silent raster style has
 * none of, so only the graduated circles paint here; a real basemap style renders the numbers. The
 * count is on `lr-map-click` either way, as `feature.properties.point_count` under
 * `origin: 'cluster'`.
 */
export const ClusteredPoints: Story = {
  name: 'Clustered points (thousands of pins)',
  render: () => {
    // A tiny LCG keeps the scatter identical on every render, so the visual baseline is stable.
    let seed = 20260820;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const dataLayers: LyraMapGeoJsonDataLayer[] = [
      {
        sourceId: 'listings',
        tone: 'accent',
        cluster: {
          radius: 60,
          maxZoom: 13,
          radiusSteps: [[0, 14], [25, 20], [100, 28]],
          colorSteps: [
            [0, storyColor('brand')],
            [25, storyColor('warning')],
            [100, storyColor('danger')],
          ],
        },
        geojson: {
          type: 'FeatureCollection',
          features: Array.from({ length: 600 }, (_unused, index) => ({
            type: 'Feature' as const,
            id: index,
            properties: { listing: index },
            geometry: {
              type: 'Point' as const,
              coordinates: [2.25 + random() * 0.22, 48.8 + random() * 0.12],
            },
          })),
        },
      },
    ];
    return html`
      <lr-map
        style="height: 20rem"
        center="[2.3522, 48.8566]"
        zoom="10"
        .dataLayers=${dataLayers}
        .mapStyle=${RASTER_STYLE}
      ></lr-map>
    `;
  },
};

/**
 * `kind: 'heatmap'` renders the same source as MapLibre's own density surface instead of the
 * geometry split. `heatmap.weightField` plus `weightRange` map a feature property onto MapLibre's
 * 0-1 weight, and `heatmap.stops` take the same `[value, color]` vocabulary as `choropleth.stops`
 * and `legendGradient` -- so the `legendGradient` bar below describes the ramp above it without a
 * second copy of the stops.
 */
export const HeatmapDensity: Story = {
  name: 'Heatmap density surface (kind)',
  render: () => {
    let seed = 987654321;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    // No density-0 stop here on purpose: a ramp that starts above zero gets a fully transparent
    // floor prepended by the component itself, so writing one out both duplicates that and forces a
    // raw colour literal into a story. Starting at 0.4 also demonstrates the auto-floor behaviour.
    const stops: [number, string][] = [
      [0.4, storyColor('brand')],
      [0.7, storyColor('warning')],
      [1, storyColor('danger')],
    ];
    const dataLayers: LyraMapGeoJsonDataLayer[] = [
      {
        sourceId: 'density',
        kind: 'heatmap',
        heatmap: {
          weightField: 'intensity',
          weightRange: [0, 10],
          radius: [[7, 14], [13, 40]],
          intensity: [[7, 1], [13, 3]],
          opacity: 0.75,
          stops,
        },
        geojson: {
          type: 'FeatureCollection',
          features: Array.from({ length: 400 }, (_unused, index) => ({
            type: 'Feature' as const,
            id: index,
            properties: { intensity: Math.round(random() * 10) },
            geometry: {
              type: 'Point' as const,
              coordinates: [2.28 + random() * 0.16, 48.82 + random() * 0.09],
            },
          })),
        },
      },
    ];
    return html`
      <lr-map
        style="height: 20rem"
        center="[2.3522, 48.8566]"
        zoom="11"
        .dataLayers=${dataLayers}
        .legendGradient=${stops.slice(1)}
        legend-gradient-lo-label="Sparse"
        legend-gradient-hi-label="Dense"
        .mapStyle=${RASTER_STYLE}
      ></lr-map>
    `;
  },
};

export const Narrow320LtrRtl: Story = {
  name: 'Narrow 320px long map content (LTR and RTL)',
  parameters: {
    docs: {
      description: {
        story:
          'Exact 320px LTR and Arabic RTL allocations keep long legend labels, marker popup content, MapLibre controls, and attribution contained over the offline raster style.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l)">
      <div dir="ltr" style="inline-size: 320px; max-inline-size: 100%">
        <lr-map
          style="block-size: var(--lr-size-20rem)"
          center="[2.3522, 48.8566]"
          zoom="10"
          .legend=${[{ color: storyColor('brand'), label: longLtrLegend, pattern: 'solid' }]}
          .markers=${[{ id: 'long-ltr', lngLat: [2.3522, 48.8566], label: longLtrPopup }]}
          .mapStyle=${OFFLINE_RASTER_STYLE}
        ></lr-map>
      </div>
      <div dir="rtl" lang="ar" style="inline-size: 320px; max-inline-size: 100%">
        <lr-map
          style="block-size: var(--lr-size-20rem)"
          center="[2.3522, 48.8566]"
          zoom="10"
          .legend=${[{ color: storyColor('danger'), label: longRtlLegend, pattern: 'crosshatch' }]}
          .markers=${[{ id: 'long-rtl', lngLat: [2.3522, 48.8566], label: longRtlPopup }]}
          .mapStyle=${OFFLINE_RASTER_STYLE}
        ></lr-map>
      </div>
    </div>
  `,
};
