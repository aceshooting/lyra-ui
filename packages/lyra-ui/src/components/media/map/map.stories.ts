import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type {
  LyraMapChoroplethLayer,
  LyraMapGeoJsonDataLayer,
  LyraMapLegendEntry,
  LyraMapMarker,
  LyraMapMarkerActivationDetail,
  LyraMapPointIcon,
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

export const CompactAttribution: StoryObj = {
  render: () => html`
    <style>
      lr-map.compact-attribution::part(attribution) { --lr-icon-button-size: var(--lr-size-24px); }
    </style>
    <lr-map class="compact-attribution" label="Map attribution" .mapStyle=${OFFLINE_RASTER_STYLE}
      style="inline-size: min(100%, 24rem); block-size: 18rem"></lr-map>
  `,
};
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

export const RouteSpeed: Story = {
  parameters: { docs: { description: { story: 'Numeric route colors, width and opacity are managed by dataLayers. The same stops feed the gradient legend; reassign dataLayers when a filter or speed metric changes. Style reloads and ancestor theme changes preserve the declarative layer.' } } },
  render: () => {
    const stops: [number, string][] = [[0, storyColor('brand')], [50, storyColor('warning')], [100, storyColor('danger')]];
    const layer: LyraMapGeoJsonDataLayer = {
      sourceId: 'routes',
      geojson: { type: 'FeatureCollection', features: [20, 50, 85].map((speed, index) => ({
        type: 'Feature', id: `route-${index}`, properties: { speed },
        geometry: { type: 'LineString', coordinates: [[-0.025, (index - 1) * 0.01], [0.025, (index - 1) * 0.01]] },
      })) },
      line: { field: 'speed', stops, width: 5, opacity: 0.9 },
    };
    return html`<lr-map label="Route speeds" .mapStyle=${OFFLINE_RASTER_STYLE} zoom="12"
      .dataLayers=${[layer]} .legendGradient=${stops}
      legend-gradient-lo-label="0 km/h" legend-gradient-hi-label="100 km/h"></lr-map>`;
  },
};

export const NavigationAndScale: Story = {
  parameters: { docs: { description: { story: 'Standard MapLibre NavigationControl and ScaleControl added through the public map getter receive shadow-root styles, localized button names and public CSS parts. Positions follow text direction. The legend reserves room for controls and attribution; ScaleControl owns unit formatting and viewport updates.' } } },
  render: () => html`<lr-map label="Map with navigation controls" .mapStyle=${OFFLINE_RASTER_STYLE}
    .legendGradient=${[[0, storyColor('brand')], [100, storyColor('danger')]]}
    @lr-map-load=${async (event: Event) => {
      const el = event.currentTarget as import('./map.js').LyraMap;
      const { NavigationControl, ScaleControl } = await import('maplibre-gl');
      const map = el.map as import('maplibre-gl').Map | undefined;
      if (!el.isConnected || !map) return;
      map.addControl(new NavigationControl(), 'bottom-right');
      map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    }}></lr-map>`,
};

export const ClassifiedPoints: Story = {
  args: { zoom: 13 },
  argTypes: { zoom: { control: { type: 'range', min: 10, max: 18, step: 1 } } },
  parameters: { docs: { description: { story: 'One clustered source retains cross-category aggregation. Increase zoom past 14 to see category colors, visit bands (10/12/14/16px radii), and filled/outlined path icons. point.radius names its own numeric field independently of category colors; cluster-count sizes stay independent. The same feature is returned by lr-map-click on its circle or icon, and CSS token colors follow the theme. Each legend row is handed the very icon record its category draws on the map, so the key shows the symbol instead of describing it in color alone.' } } },
  render: ({ zoom }) => {
    const categories = ['home', 'work', 'shop'];
    const icons = [
      { value: 'home', path: 'M2 12L12 2L22 12V22H2Z' },
      { value: 'work', path: 'M8 6V3H16V6M3 6H21V21H3ZM3 11H21',
        mode: 'stroke', strokeWidth: 1.75, lineCap: 'round', lineJoin: 'round' },
      { value: 'shop', path: 'M4 2H20L23 9H21V22H3V9H1ZM6 12V20H10V12Z' },
    ] as const satisfies readonly LyraMapPointIcon[];
    const layer: LyraMapGeoJsonDataLayer = {
      sourceId: 'places', cluster: {},
      geojson: { type: 'FeatureCollection', features: Array.from({ length: 1200 }, (_, index) => ({
        type: 'Feature', id: index, properties: { category: categories[index % 3], visits: [1, 20, 70, 150][Math.floor(index / 3) % 4] },
        geometry: { type: 'Point', coordinates: [((index % 40) - 20) * 0.001, (Math.floor(index / 40) - 15) * 0.001] },
      })) },
      point: { field: 'category', colors: [['home', storyColor('brand')], ['work', storyColor('success')], ['shop', storyColor('warning')]],
        radius: { field: 'visits', stops: [[0, 10], [10, 12], [50, 14], [100, 16]], fallback: 10 },
        strokeWidth: 1, iconSize: 14,
        icons,
      },
    };
    return html`<lr-map label="Classified locations" .mapStyle=${OFFLINE_RASTER_STYLE} .zoom=${zoom}
      .dataLayers=${[layer]} .legend=${[
        { label: 'Home', color: storyColor('brand'), pattern: 'solid', icon: icons[0] },
        { label: 'Work', color: storyColor('success'), pattern: 'diagonal', icon: icons[1] },
        { label: 'Shop', color: storyColor('warning'), pattern: 'dots', icon: icons[2] },
      ]}></lr-map>`;
  },
};

/** Shared with both interactive-legend stories so the key and the layer can never describe
 *  different categories: one record drives `point.colors`, `point.icons` and every legend row. */
const INTERACTIVE_CATEGORIES = [
  { value: 'home', label: 'Home', tone: 'brand', pattern: 'solid',
    path: 'M2 12L12 2L22 12V22H2Z' },
  { value: 'work', label: 'Work', tone: 'success', pattern: 'diagonal',
    path: 'M8 6V3H16V6M3 6H21V21H3ZM3 11H21' },
  { value: 'shop', label: 'Shop', tone: 'warning', pattern: 'dots',
    path: 'M4 2H20L23 9H21V22H3V9H1ZM6 12V20H10V12Z' },
] as const;

function interactiveLayer(): LyraMapGeoJsonDataLayer {
  const icons = INTERACTIVE_CATEGORIES.map(
    ({ value, path }) => ({ value, path }) satisfies LyraMapPointIcon,
  );
  return {
    sourceId: 'places',
    geojson: { type: 'FeatureCollection', features: Array.from({ length: 900 }, (_, index) => ({
      type: 'Feature', id: index,
      properties: { category: INTERACTIVE_CATEGORIES[index % 3]!.value },
      geometry: { type: 'Point', coordinates: [((index % 30) - 15) * 0.0015, (Math.floor(index / 30) - 15) * 0.0015] },
    })) },
    point: {
      field: 'category',
      colors: INTERACTIVE_CATEGORIES.map(({ value, tone }) => [value, storyColor(tone)] as const),
      radius: 8, strokeWidth: 1, iconSize: 12, icons,
    },
  };
}

function interactiveLegend(): LyraMapLegendEntry[] {
  return INTERACTIVE_CATEGORIES.map(({ value, label, tone, pattern, path }) => ({
    value, label, color: storyColor(tone), pattern, icon: { value, path },
  }));
}

export const InteractiveLegend: Story = {
  parameters: { docs: { description: { story: 'Opt-in with `legend-interactive`. Every legend row that carries its own `value` becomes a native toggle button: Tab reaches each one, Enter and Space activate it, and its `aria-pressed` renders the literal "true"/"false" rather than being dropped when unpressed. Hiding a category mutes its points, point strokes and point icons through `--lr-map-hidden-category-opacity` (default 0.15) instead of removing them, so the geography stays legible; the row itself dims only its decorative swatch and re-colours its label through the quiet text token, keeping AA contrast. Interactive rows carry the shared `--lr-icon-button-size` hit-area floor, so they are ~40px tall instead of ~18px; the panel scrolls within the map allocation. Each activation emits the cancelable `lr-map-legend-toggle` and announces through the shared polite live region.' } } },
  render: () => html`<lr-map
    label="Interactive category legend"
    legend-interactive
    .mapStyle=${OFFLINE_RASTER_STYLE}
    .zoom=${13}
    .dataLayers=${[interactiveLayer()]}
    .legend=${interactiveLegend()}
  ></lr-map>`,
};

export const InteractiveLegendCheckboxRole: Story = {
  parameters: { docs: { description: { story: 'Opt-in with `legend-control-role="checkbox"` alongside `legend-interactive`. Renders the SAME row -- swatch, label, click handler, Tab/Enter/Space activation -- but exposes it as `role="checkbox"` with `aria-checked` in place of `aria-pressed`. Prefer this when the legend reads as a set of independent show/hide toggles (a checklist) rather than a set of pressed/unpressed actions; prefer the default `button` role when the legend reads as filtering actions. A hidden category renders `aria-checked="false"`, inverted the same way `aria-pressed` already was.' } } },
  render: () => html`<lr-map
    label="Checkbox-role category legend"
    legend-interactive
    legend-control-role="checkbox"
    .mapStyle=${OFFLINE_RASTER_STYLE}
    .zoom=${13}
    .dataLayers=${[interactiveLayer()]}
    .legend=${interactiveLegend()}
  ></lr-map>`,
};

export const InteractiveLegendControlledHost: Story = {
  parameters: { docs: { description: { story: 'A controlled host: the listener calls `preventDefault()` on `lr-map-legend-toggle`, so the component writes nothing at all — no `hiddenCategories`, no `aria-pressed` change, no paint change and no announcement — and the host assigns its own set from the proposal in `event.detail.hiddenCategories`. Here it refuses to hide the last visible category, which is a policy the component deliberately does not encode. A programmatic `hiddenCategories` assignment reconciles without emitting the event, so this loop cannot recur.' } } },
  render: () => {
    const onToggle = (event: Event): void => {
      const toggle = event as CustomEvent<{ readonly hiddenCategories: readonly string[] }>;
      toggle.preventDefault();
      const proposed = toggle.detail.hiddenCategories;
      if (proposed.length >= INTERACTIVE_CATEGORIES.length) return;
      (event.currentTarget as HTMLElement & { hiddenCategories: readonly string[] }).hiddenCategories = proposed;
    };
    return html`<lr-map
      label="Host-controlled category legend"
      legend-interactive
      @lr-map-legend-toggle=${onToggle}
      .mapStyle=${OFFLINE_RASTER_STYLE}
      .zoom=${13}
      .dataLayers=${[interactiveLayer()]}
      .legend=${interactiveLegend()}
    ></lr-map>`;
  },
};

export const LegendHeaderSlot: Story = {
  parameters: { docs: { description: { story: 'The `legend-start` slot renders at the TOP of the legend panel — ahead of the gradient bar and every projected row — where the original `legend` slot renders after them. Before it existed, a host-authored panel header could only ever be a footer. Both slots are shown here at once: the header names the key, the footer carries the attribution note. Either one alone opens the panel, exactly as `legend` content alone already did, and neither is made interactive by `legend-interactive`.' } } },
  render: () => html`<lr-map
    label="Legend with a slotted header and footer"
    .mapStyle=${OFFLINE_RASTER_STYLE}
    .zoom=${13}
    .legend=${legend()}
  >
    <strong slot="legend-start">Risk band</strong>
    <small slot="legend">Source: internal survey</small>
  </lr-map>`,
};

export const CollapsibleLegend: Story = {
  parameters: { docs: { description: { story: 'Opt-in with `legend-collapsible`. The panel grows a native disclosure button whose visible localized text is its accessible name and whose `aria-expanded` renders the literal "true"/"false"; it points at the row list through `aria-controls` inside the same shadow root. `legendOpen` defaults **open**, so adding only `legend-collapsible` never hides an existing key — write `legend-open="false"` to start collapsed (it is a true-defaulting boolean, so the string form is required; the bare attribute cannot express `false`). Collapsing hides the gradient, the rows, the `legend-limit` summary and the trailing `legend` slot, while the `legend-start` slot and the disclosure itself stay visible, so a slotted header survives the collapse and the control that restores the key is never what the collapse hides.' } } },
  render: () => html`<lr-map
    label="Collapsible legend"
    legend-collapsible
    .mapStyle=${OFFLINE_RASTER_STYLE}
    .zoom=${13}
    .dataLayers=${[interactiveLayer()]}
    .legend=${interactiveLegend()}
  >
    <strong slot="legend-start">Places</strong>
  </lr-map>`,
};

export const CollapsibleLegendControlledHost: Story = {
  parameters: { docs: { description: { story: 'A controlled host: the listener calls `preventDefault()` on `lr-map-legend-panel-toggle`, so the component writes nothing at all — no `legendOpen`, no `aria-expanded` change and no re-render — and the host assigns its own value from the proposal in `event.detail.open`. Here it refuses to collapse the panel while a category is hidden, because the key is the only thing explaining the muted points; that is a policy the component deliberately does not encode. A programmatic `legendOpen` assignment reconciles without emitting the event, so this loop cannot recur.' } } },
  render: () => {
    const onPanelToggle = (event: Event): void => {
      const proposal = event as CustomEvent<{ readonly open: boolean }>;
      proposal.preventDefault();
      const map = event.currentTarget as HTMLElement & {
        legendOpen: boolean;
        hiddenCategories: readonly string[];
      };
      if (!proposal.detail.open && map.hiddenCategories.length > 0) return;
      map.legendOpen = proposal.detail.open;
    };
    return html`<lr-map
      label="Host-controlled legend disclosure"
      legend-collapsible
      legend-interactive
      @lr-map-legend-panel-toggle=${onPanelToggle}
      .mapStyle=${OFFLINE_RASTER_STYLE}
      .zoom=${13}
      .dataLayers=${[interactiveLayer()]}
      .legend=${interactiveLegend()}
    ></lr-map>`;
  },
};

export const SectionedLegend: Story = {
  parameters: { docs: { description: { story: 'A `group` on a legend entry splits one flat key into labelled sections, which is what a map painting two layers at once needs. Consecutive entries sharing an identical `group` render as one section — a visible heading plus a `role="group"` the heading names — and an entry with no `group` keeps its declared position rather than being hoisted or sunk. Declaration order is never rewritten, so a repeated group after an interruption opens a second section instead of merging. `group` is caller-supplied data: it renders verbatim and is never resolved through the locale catalogue. Sections are not rows: the 100-row cap and the `legend-limit` summary still count rows.' } } },
  render: () => html`<lr-map
    label="Sectioned legend"
    legend-collapsible
    .mapStyle=${OFFLINE_RASTER_STYLE}
    .zoom=${13}
    .legend=${[
      { color: storyColor('brand'), label: 'Bus', pattern: 'solid', group: 'Transit' },
      { color: storyColor('success'), label: 'Tram', pattern: 'diagonal', group: 'Transit' },
      { color: storyColor('warning'), label: 'Unclassified', pattern: 'dots' },
      { color: storyColor('danger'), label: 'Flood plain', pattern: 'crosshatch', group: 'Hazards' },
    ] satisfies LyraMapLegendEntry[]}
  ></lr-map>`,
};
