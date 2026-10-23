import { createMapModule, createMapModuleDemo, createMapModulePublisher } from '../../../../test/map-module-composition.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import type {
  LyraMap,
  LyraMapBounds,
  LyraMapCanvasDataLayer,
  LyraMapChoroplethLayer,
  LyraMapGeoJsonDataLayer,
  LyraMapLegendEntry,
  LyraMapMarker,
  LyraMapMarkerActivationDetail,
  LyraMapOverlays,
  LyraMapPointIcon,
  LyraMapViewChangeDetail,
} from './map.js';
import { LYRA_MAP_EMPTY_STYLE } from './map.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

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
          'The default modular engine loads `@aceshooting/lyra-map` and prepares only the source/layer families requested by its style and generated overlays. Configure the companion bundler plugin once; no canonical engine is substituted. Select `engine="maplibre"` before connection to use the full native peer explicitly. Markers and popups keep the physical geographic projection origin in both text directions. Live ancestor theme changes refresh choropleth stop/base colors and opacity without rebuilding sources or layers. Requires an explicit `mapStyle`; the deterministic default story uses a network-silent inlined raster tile, while the opt-in live story demonstrates OpenStreetMap tiles. Explicit marker IDs and `dataLayers[].sourceId` values are trimmed, nonempty, and first-wins; idless colocated markers remain distinct by occurrence. Peer/custom markers retain a 24px minimum target in both axes even without intrinsic content size.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** Explicit compatibility choice; its worker setup is loaded only when this story renders. */
export const NativeEngine: Story = {
  render: () => html`<div ${ref(async host => {
    if (!(host instanceof HTMLElement)) return;
    await import('../../../../../../.storybook/maplibre-worker.js');
    if (!host.isConnected) return;
    const map = document.createElement('lr-map');
    map.engine = 'maplibre';
    map.mapStyle = OFFLINE_RASTER_STYLE as LyraMap['mapStyle'];
    map.label = 'Native MapLibre engine';
    map.style.blockSize = '20rem';
    host.replaceChildren(map);
  })}></div>`,
};

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
    let map: LyraMap | undefined, reversed = false;
    return html`
      <lr-button @click=${() => {
        if (!map) return;
        reversed = !reversed;
        const stops = choropleth.stops.map(([value], index) =>
          [value, choropleth.stops[reversed ? choropleth.stops.length - 1 - index : index]![1]] as const);
        map.choropleth = { ...choropleth, stops }; map.legendGradient = stops;
      }}>Reverse the color scale</lr-button>
      <lr-map
        ${ref(node => { map = node as LyraMap | undefined; })}
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
 * Camera commands and the camera API around them. `flyTo()`, `easeTo()` and `jumpTo()` move the
 * camera and report it through `lr-map-view-change` with `source: command`; `fitToData()` frames
 * the markers without a hand-computed box; `cameraPadding` keeps the left 12rem (the pretend
 * side panel) out of every fit; and `project()` plus `lr-map-move` keep the pin label glued to
 * Paris while the map travels. Pan the map away and press "Re-centre": `jumpTo()` is the explicit
 * way back, because re-assigning an equal `center` is a no-op. Under
 * `prefers-reduced-motion: reduce` fly and ease jump.
 */
export const CameraCommands: Story = {
  render: () => {
    const cities: LyraMapMarker[] = [
      { id: 'lisbon', lngLat: [-9.1393, 38.7223], label: 'Lisbon' },
      { id: 'paris', lngLat: [2.3522, 48.8566], label: 'Paris' },
      { id: 'berlin', lngLat: [13.405, 52.52], label: 'Berlin' },
    ];
    let map: LyraMap | undefined;
    let status: HTMLElement | undefined;
    let pin: HTMLElement | undefined;
    const placePin = (): void => {
      const point = map?.project([2.3522, 48.8566]);
      if (!pin) return;
      pin.hidden = point === undefined;
      if (point) pin.style.translate = `${point[0]}px ${point[1]}px`;
    };
    const onViewChange = (event: CustomEvent<LyraMapViewChangeDetail>): void => {
      const { center, zoom, source, bounds } = event.detail;
      if (status) {
        status.textContent =
          `source: ${source} · center: ${center.map((value) => value.toFixed(2)).join(', ')}` +
          ` · zoom: ${zoom.toFixed(2)}` +
          (bounds ? ` · west: ${bounds[0][0].toFixed(2)}, east: ${bounds[1][0].toFixed(2)}` : '');
      }
    };
    return html`
      <div style="display: grid; gap: var(--lr-space-s)">
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-s)">
          <lr-button @click=${() => map?.fitToData({ maxZoom: 6 })}>Fit to data</lr-button>
          <lr-button @click=${() => map?.flyTo({ center: [2.3522, 48.8566], zoom: 7 })}>
            Fly to Paris
          </lr-button>
          <lr-button @click=${() => map?.easeTo({ center: [13.405, 52.52], zoom: 5 })}>
            Ease to Berlin
          </lr-button>
          <lr-button @click=${() => map?.jumpTo({ center: [2.3522, 48.8566], zoom: 4 })}>
            Re-centre
          </lr-button>
        </div>
        <div style="position: relative; overflow: hidden">
          <lr-map
            label="Map driven by camera commands"
            style="height: 20rem"
            .center=${[2.3522, 48.8566]}
            .zoom=${4}
            .markers=${cities}
            .cameraPadding=${{ left: 192 }}
            .renderWorldCopies=${false}
            .mapStyle=${OFFLINE_RASTER_STYLE}
            @lr-map-view-change=${onViewChange}
            @lr-map-move=${placePin}
            @lr-map-load=${placePin}
            ${ref((element) => {
              if (element) map = element as LyraMap;
            })}
          ></lr-map>
          <div
            aria-hidden="true"
            style="position: absolute; inset-block-start: 0; inset-inline-start: 0; inline-size: 12rem; block-size: 100%; background: var(--lr-color-surface-overlay); border-inline-end: 1px solid var(--lr-color-border); padding: var(--lr-space-s); pointer-events: none"
          >
            Side panel
          </div>
          <div
            ${ref((element) => {
              pin = element as HTMLElement | undefined;
            })}
            style="position: absolute; inset: 0 auto auto 0; pointer-events: none; padding: var(--lr-space-2xs); background: var(--lr-color-surface-raised); border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius)"
            hidden
          >
            Paris
          </div>
        </div>
        <output ${ref((element) => {
          status = element as HTMLElement | undefined;
        })}>Waiting for the first settled camera…</output>
      </div>
    `;
  },
};

/**
 * `fitBounds()` frames a box -- here the bounding box of the markers currently shown -- and writes
 * the settled camera back into `center`/`zoom`, reporting it through `lr-map-view-change`. The
 * story calls it before the map exists, so the fit is queued and applied as the map is built; the
 * buttons swap the data set and fit again. The status line mirrors the event: pan or zoom and it
 * reports `source: user`, press a button and it reports `source: fit`. Under
 * `prefers-reduced-motion: reduce` the camera jumps instead of animating.
 */
export const FitBounds: Story = {
  render: () => {
    const capitals: LyraMapMarker[] = [
      { id: 'lisbon', lngLat: [-9.1393, 38.7223], label: 'Lisbon' },
      { id: 'paris', lngLat: [2.3522, 48.8566], label: 'Paris' },
      { id: 'berlin', lngLat: [13.405, 52.52], label: 'Berlin' },
      { id: 'warsaw', lngLat: [21.0122, 52.2297], label: 'Warsaw' },
      { id: 'athens', lngLat: [23.7275, 37.9838], label: 'Athens' },
    ];
    const nordics: LyraMapMarker[] = [
      { id: 'oslo', lngLat: [10.7522, 59.9139], label: 'Oslo' },
      { id: 'stockholm', lngLat: [18.0686, 59.3293], label: 'Stockholm' },
      { id: 'helsinki', lngLat: [24.9384, 60.1699], label: 'Helsinki' },
      { id: 'copenhagen', lngLat: [12.5683, 55.6761], label: 'Copenhagen' },
    ];
    const boxOf = (markers: readonly LyraMapMarker[]): LyraMapBounds => {
      const lngs = markers.map((marker) => marker.lngLat[0]);
      const lats = markers.map((marker) => marker.lngLat[1]);
      return [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
    };
    let map: LyraMap | undefined;
    let status: HTMLElement | undefined;
    const show = (markers: LyraMapMarker[]): void => {
      if (!map) return;
      map.markers = markers;
      map.fitBounds(boxOf(markers), { padding: 48, maxZoom: 8 });
    };
    const onViewChange = (event: CustomEvent<LyraMapViewChangeDetail>): void => {
      const { center, zoom, source } = event.detail;
      if (status) {
        status.textContent =
          `source: ${source} · center: ${center.map((value) => value.toFixed(2)).join(', ')}` +
          ` · zoom: ${zoom.toFixed(2)}`;
      }
    };
    return html`
      <div style="display: grid; gap: var(--lr-space-s)">
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-s)">
          <lr-button @click=${() => show(capitals)}>Fit capitals</lr-button>
          <lr-button @click=${() => show(nordics)}>Fit Nordic capitals</lr-button>
        </div>
        <lr-map
          label="Map fitted to its markers"
          style="height: 20rem"
          .renderWorldCopies=${false}
          .mapStyle=${OFFLINE_RASTER_STYLE}
          @lr-map-view-change=${onViewChange}
          ${ref((element) => {
            if (!element || map === element) return;
            map = element as LyraMap;
            show(capitals);
          })}
        ></lr-map>
        <output ${ref((element) => {
          status = element as HTMLElement | undefined;
        })}>Waiting for the first settled camera…</output>
      </div>
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
 * On a glyph-enabled style, countColor and countHaloColor keep the label legible across the
 * differently colored circle steps; countHaloWidth controls the outline.
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
          strokeColor: 'var(--lr-color-neutral)',
          countColor: 'var(--lr-color-on-warning)',
          countHaloColor: 'var(--lr-color-neutral)',
          countHaloWidth: 1,
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
      const map = el.map as import('@aceshooting/lyra-map').Map | undefined;
      if (!map) return;
      const [{ NavigationControl }, { ScaleControl }] = await Promise.all([
        import('@aceshooting/lyra-map/controls/navigation'),
        import('@aceshooting/lyra-map/controls/scale'),
      ]);
      if (!el.isConnected || el.map !== map) return;
      map.addControl(new NavigationControl(), 'bottom-right');
      map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    }}></lr-map>`,
};

export const GlassNavigationAndScale: Story = {
  ...NavigationAndScale,
  decorators: [(story) => html`<div data-lr-surface="glass">${story()}</div>`],
  parameters: { docs: { description: { story: 'Navigation, scale, attribution and legend share the surrounding Glass material. The map keeps its data colors and native controls. Choose Solid or increased contrast for opaque chrome.' } } },
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
  parameters: { docs: { description: { story: 'Opt-in with `legend-interactive`. Every legend row that carries its own `value` becomes a native toggle button: Tab reaches each one, Enter and Space activate it, and its `aria-pressed` renders the literal "true"/"false" rather than being dropped when unpressed. Hiding a category mutes its points, point strokes and point icons through `--lr-map-hidden-category-opacity` (default 0.15) instead of removing them, so the geography stays legible; the row itself dims only its decorative swatch and re-colours its label through the quiet text token, keeping AA contrast. Interactive rows carry the shared `--lr-icon-button-size` hit-area floor, so they are ~40px tall instead of ~18px; the panel scrolls within the map allocation. Each activation emits the cancelable `lr-map-legend-toggle-request` and announces through the shared polite live region.' } } },
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
  parameters: { docs: { description: { story: 'A controlled host: the listener calls `preventDefault()` on `lr-map-legend-toggle-request`, so the component writes nothing at all — no `hiddenCategories`, no `aria-pressed` change, no paint change and no announcement — and the host assigns its own set from the proposal in `event.detail.hiddenCategories`. Here it refuses to hide the last visible category, which is a policy the component deliberately does not encode. A programmatic `hiddenCategories` assignment reconciles without emitting the event, so this loop cannot recur.' } } },
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
      @lr-map-legend-toggle-request=${onToggle}
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
  parameters: { docs: { description: { story: 'A controlled host: the listener calls `preventDefault()` on `lr-map-legend-panel-toggle-request`, so the component writes nothing at all — no `legendOpen`, no `aria-expanded` change and no re-render — and the host assigns its own value from the proposal in `event.detail.open`. Here it refuses to collapse the panel while a category is hidden, because the key is the only thing explaining the muted points; that is a policy the component deliberately does not encode. A programmatic `legendOpen` assignment reconciles without emitting the event, so this loop cannot recur.' } } },
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
      @lr-map-legend-panel-toggle-request=${onPanelToggle}
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

/** An explicit source diff changes one stable feature without replacing the collection. */
export const IncrementalSourceUpdate: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let value = 0;
    const dataLayers: LyraMapGeoJsonDataLayer[] = [{ sourceId: 'points', geojson: {
      type: 'FeatureCollection', features: [{ type: 'Feature', id: 'point',
        geometry: { type: 'Point', coordinates: [0, 0] }, properties: { value: 0 } }],
    } }];
    return html`<button @click=${() => map?.updateSourceData('points', {
      update: [{ id: 'point', addOrUpdateProperties: [{ key: 'value', value: ++value }] }],
    })}>Update feature value</button>
    <lr-map ${ref(element => { map = element as LyraMap | undefined; })}
      label="Incremental point data" .mapStyle=${OFFLINE_RASTER_STYLE} .dataLayers=${dataLayers}
      .center=${[0, 0]} zoom="2"></lr-map>`;
  },
};

/** Larger point collections use clustered GeoJSON instead of individual DOM markers. */
export const MarkerInspectionLimit: Story = {
  render: () => html`<lr-map label="Bounded markers" .mapStyle=${OFFLINE_RASTER_STYLE}
    .markers=${Array.from({ length: 2001 }, (_, index) => ({ id: String(index), lngLat: [index % 180, 0] }))}
    @lr-map-load=${(event: Event) => {
      const map = event.currentTarget as LyraMap;
      map.title = map.markersTruncated ? 'The first 2,000 marker entries are shown.' : '';
    }}></lr-map>`,
};

/** A row of unit squares south-east of Paris; `null` leaves a square without a `value` property. */
function valueSquares(values: readonly (number | null)[]): LyraMapChoroplethLayer['geojson'] {
  return {
    type: 'FeatureCollection',
    features: values.map((value, index) => {
      const west = 2.2 + index * 0.08;
      return {
        type: 'Feature' as const,
        id: index,
        properties: { name: `Area ${index + 1}`, ...(value === null ? {} : { value }) },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [west, 48.9], [west + 0.07, 48.9], [west + 0.07, 48.83], [west, 48.83], [west, 48.9],
          ]],
        },
      };
    }),
  };
}

const AREA_VALUES = [12, null, 34, 58, null, 76, 91, 23];

/**
 * `choropleth.noData` paints features without a value (here Area 2 and Area 5) with its own color
 * and outline instead of leaving them unpainted, and reports `noData: true` when one is clicked.
 * `choroplethLegend` derives the key from the layer: one swatch per band of the step ramp plus a
 * hatched swatch captioned with the `noData` label. `LYRA_MAP_EMPTY_STYLE` keeps the map free of a
 * basemap and of tile requests.
 */
export const ChoroplethNoData: Story = {
  render: () => {
    const choropleth: LyraMapChoroplethLayer = {
      sourceId: 'areas',
      field: 'value',
      interpolation: 'step',
      stops: [
        [0, storyColor('brand')],
        [40, storyColor('warning')],
        [80, storyColor('danger')],
      ],
      noData: { color: storyColor('noData'), strokeColor: storyColor('danger'), label: 'Not surveyed' },
      geojson: valueSquares(AREA_VALUES),
    };
    let readout: HTMLElement | undefined;
    return html`
      <div style="display: grid; gap: var(--lr-space-s)">
        <lr-map
          style="height: 20rem"
          label="Areas by value, with unsurveyed areas"
          center="[2.48, 48.865]"
          zoom="10.5"
          choropleth-legend
          .choropleth=${choropleth}
          .mapStyle=${LYRA_MAP_EMPTY_STYLE}
          @lr-map-click=${(event: CustomEvent<{ feature?: { properties?: { name?: string } }; noData?: true }>) => {
            if (!readout) return;
            const name = event.detail.feature?.properties?.name;
            readout.textContent = name
              ? `${name}: ${event.detail.noData ? 'no data' : 'has a value'}`
              : 'Click an area';
          }}
        ></lr-map>
        <span ${ref((node) => (readout = node as HTMLElement | undefined))} role="status">Click an area</span>
      </div>
    `;
  },
};

/**
 * A continuous ramp derives a gradient bar from `choropleth.stops`, with the interior stops as ticks.
 * `legendGradientTicks` places its own labelled marks at true positions on the ramp instead.
 */
export const ChoroplethGradientTicks: Story = {
  render: () => {
    const choropleth: LyraMapChoroplethLayer = {
      sourceId: 'areas',
      field: 'value',
      interpolation: 'logarithmic',
      stops: [
        [0, storyColor('brand')],
        [25, storyColor('warning')],
        [100, storyColor('danger')],
      ],
      noData: {},
      geojson: valueSquares(AREA_VALUES),
    };
    return html`
      <lr-map
        style="height: 20rem"
        label="Areas by value on a logarithmic ramp"
        center="[2.48, 48.865]"
        zoom="10.5"
        choropleth-legend
        legend-gradient-lo-label="0"
        legend-gradient-hi-label="100+"
        .legendGradientTicks=${[{ value: 25, label: 'Median' }, 60]}
        .choropleth=${choropleth}
        .mapStyle=${LYRA_MAP_EMPTY_STYLE}
      ></lr-map>
    `;
  },
};

/**
 * `cluster.zoomOnClick` eases the camera into a clicked cluster at the zoom where it breaks apart;
 * reduced motion makes it a jump.
 */
export const ClusterZoomOnClick: Story = {
  render: () => {
    let seed = 20261020;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const dataLayers: LyraMapGeoJsonDataLayer[] = [
      {
        sourceId: 'stops',
        tone: 'accent',
        cluster: { radius: 60, maxZoom: 14, zoomOnClick: true },
        geojson: {
          type: 'FeatureCollection',
          features: Array.from({ length: 300 }, (_unused, index) => ({
            type: 'Feature' as const,
            id: index,
            properties: { stop: index },
            geometry: {
              type: 'Point' as const,
              coordinates: [2.2 + random() * 0.3, 48.8 + random() * 0.15],
            },
          })),
        },
      },
    ];
    return html`
      <lr-map
        style="height: 20rem"
        label="Clustered stops; click a cluster to zoom into it"
        center="[2.35, 48.875]"
        zoom="9.5"
        .dataLayers=${dataLayers}
        .mapStyle=${OFFLINE_RASTER_STYLE}
      ></lr-map>
    `;
  },
};

/**
 * `controls` adds the standard navigation and scale controls declaratively, with a corner for each
 * and a scale `unit`; changing it replaces only the control whose options changed. Button names
 * follow the element's language.
 */
export const DeclarativeControls: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let imperial = false;
    return html`
      <div style="display: grid; gap: var(--lr-space-s)">
        <lr-button
          @click=${() => {
            imperial = !imperial;
            if (map) map.controls = { navigation: { position: 'top-right' }, scale: { position: 'bottom-left', unit: imperial ? 'imperial' : 'metric' } };
          }}
          >Toggle metric / imperial</lr-button
        >
        <lr-map
          ${ref((node) => (map = node as LyraMap | undefined))}
          style="height: 20rem"
          label="Map with declarative controls"
          center="[2.3522, 48.8566]"
          zoom="9"
          .controls=${{ navigation: { position: 'top-right' }, scale: { position: 'bottom-left', unit: 'metric' } }}
          .mapStyle=${OFFLINE_RASTER_STYLE}
        ></lr-map>
      </div>
    `;
  },
};

/**
 * The `anchor` slot shows content at `anchorLngLat`: above the point, flipped below near the top
 * edge, following the camera, and hidden while the point is off screen. Click an area to anchor its
 * details there; this replaces a hand-positioned popup.
 */
export const AnchoredFeatureDetails: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let title: HTMLElement | undefined;
    const choropleth: LyraMapChoroplethLayer = {
      sourceId: 'areas',
      field: 'value',
      stops: [[0, storyColor('brand')], [100, storyColor('danger')]],
      noData: {},
      geojson: valueSquares(AREA_VALUES),
    };
    return html`
      <lr-map
        ${ref((node) => (map = node as LyraMap | undefined))}
        style="height: 20rem"
        label="Areas; click one to show its details"
        center="[2.48, 48.865]"
        zoom="10.5"
        .choropleth=${choropleth}
        .mapStyle=${LYRA_MAP_EMPTY_STYLE}
        @lr-map-click=${(event: CustomEvent<{ lngLat: [number, number]; feature?: { properties?: { name?: string } } }>) => {
          const name = event.detail.feature?.properties?.name;
          if (title) title.textContent = name ?? '';
          if (map) map.anchorLngLat = name ? event.detail.lngLat : null;
        }}
      >
        <div slot="anchor" role="group" aria-labelledby="anchored-details-title">
          <strong id="anchored-details-title" ${ref((node) => (title = node as HTMLElement | undefined))}></strong>
          <lr-button size="small" @click=${() => { if (map) map.anchorLngLat = null; }}>Close</lr-button>
        </div>
      </lr-map>
    `;
  },
};

/**
 * `maxBounds` applies even while the map shows the whole world at a fractional zoom below 1, where
 * the engine rejects the same box, and restores the camera afterwards.
 */
/** Builds a regular grid of square polygons with `count` cells per side, centred on 0,0. */
function cellGrid(count: number, size: number) {
  const features = [];
  for (let row = 0; row < count; row++) for (let column = 0; column < count; column++) {
    const x = (column - count / 2) * size, y = (row - count / 2) * size;
    features.push({ type: 'Feature' as const, id: row * count + column,
      properties: { tier: (row + column) % 3 === 0 ? 'district' : 'commune', share: ((row * 7 + column * 13) % 100) / 100 },
      geometry: { type: 'Polygon' as const, coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]] } });
  }
  return { type: 'FeatureCollection' as const, features };
}

/** Large GeoJSON overlay: data kept by identity, native expressions, a filter, a zoom range,
 *  `before` ordering under the outline, picking and feature state. */
export const LargeStyledGeoJson: Story = {
  render: () => {
    const grid = cellGrid(120, 0.25);
    let map: LyraMap | undefined;
    let status: HTMLElement | undefined;
    let selected: string | number | undefined;
    return html`
      <p>14,400 polygons in one GeoJSON overlay, painted by native expressions between zoom 2 and 9.</p>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Large styled GeoJSON overlay" center="[0, 0]" zoom="4" style="block-size: 24rem"
        .mapStyle=${LYRA_MAP_EMPTY_STYLE}
        .overlays=${{
          sources: [
            { id: 'cells', source: { type: 'geojson', data: grid } },
            { id: 'outline', source: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: {
              type: 'LineString', coordinates: [[-15, -15], [15, -15], [15, 15], [-15, 15], [-15, -15]] } } } },
          ],
          layers: [
            { layer: { id: 'outline-line', type: 'line', source: 'outline', paint: { 'line-color': storyColor('danger'), 'line-width': 3 } } },
            { interactive: true, before: 'outline-line', layer: {
              id: 'cells-fill', type: 'fill', source: 'cells', minzoom: 2, maxzoom: 9,
              filter: ['==', ['get', 'tier'], 'commune'],
              paint: {
                'fill-color': ['coalesce', ['feature-state', 'color'],
                  ['interpolate', ['linear'], ['get', 'share'], 0, storyColor('success'), 1, storyColor('warning')]],
                'fill-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.3, 6, 0.8],
              },
            } },
          ],
        }}
        @lr-map-click=${(event: CustomEvent<{ sourceId?: string; hit?: { id?: string | number } }>) => {
          if (!map) return;
          if (selected !== undefined) map.removeFeatureState({ origin: 'overlay', source: 'cells', id: selected });
          selected = event.detail.hit?.id;
          if (selected !== undefined) map.setFeatureState({ origin: 'overlay', source: 'cells', id: selected }, { color: storyColor('brand') });
          if (status) status.textContent = selected === undefined ? 'Map background' : `${event.detail.sourceId} cell ${selected}`;
        }}
      ></lr-map>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Click a cell to select it.</p>
    `;
  },
};

/** Reassign fresh overlay descriptors to change paint, layout, filter and zoom bounds
 * while the same native source and layer remain installed. */
export const MutableOverlayLayer: Story = {
  render: () => {
    const data = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { side: 'west' }, geometry: { type: 'Polygon', coordinates: [[[-12, -8], [-2, -8], [-2, 8], [-12, 8], [-12, -8]]] } },
      { type: 'Feature', properties: { side: 'east' }, geometry: { type: 'Polygon', coordinates: [[[2, -8], [12, -8], [12, 8], [2, 8], [2, -8]]] } },
    ] };
    let map: LyraMap | undefined, east = false, hidden = false;
    let status: HTMLElement | undefined;
    const snapshot = (): LyraMapOverlays => ({
      sources: [{ id: 'regions', source: { type: 'geojson', data } }],
      layers: [{ interactive: true, layer: {
        id: 'region-fill', type: 'fill', source: 'regions', minzoom: east ? 3 : 2, maxzoom: east ? 8 : 9,
        filter: ['==', ['get', 'side'], east ? 'east' : 'west'],
        layout: { visibility: hidden ? 'none' : 'visible' },
        paint: { 'fill-color': east ? storyColor('success') : storyColor('brand'), 'fill-opacity': east ? 0.8 : 1 },
      } }],
    });
    const update = () => {
      if (map) map.overlays = snapshot();
      if (status) status.textContent = hidden ? 'Overlay hidden' : `${east ? 'Eastern' : 'Western'} region visible`;
    };
    return html`
      <lr-button @click=${() => { east = !east; update(); }}>Switch region and paint</lr-button>
      <lr-button @click=${() => { hidden = !hidden; update(); }}>Toggle visibility</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Mutable overlay layer" center="[0, 0]" zoom="4" style="block-size: 20rem"
        .mapStyle=${LYRA_MAP_EMPTY_STYLE} .overlays=${snapshot()}></lr-map>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Western region visible</p>
    `;
  },
};

/** `minZoom`/`maxZoom` clamp gestures, commands and fits. */
export const ZoomLimits: Story = {
  render: () => {
    let map: LyraMap | undefined;
    return html`
      <lr-button @click=${() => map?.flyTo({ zoom: 22 })}>Zoom in fully</lr-button>
      <lr-button @click=${() => map?.flyTo({ zoom: 0 })}>Zoom out fully</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Zoom limited to levels 3 to 8" center="[10, 50]" zoom="4" min-zoom="3" max-zoom="8"
        style="block-size: 20rem" .mapStyle=${OFFLINE_RASTER_STYLE} .controls=${{ navigation: true }}></lr-map>
    `;
  },
};

/** The engine's unnamed `#zoom/lat/lng` fragment, so existing deep links keep working. Disabled in
 *  this embedded demo unless switched on, because Storybook owns its frame's URL. */
export const UnnamedHash: Story = {
  render: () => {
    let map: LyraMap | undefined;
    return html`
      <lr-button @click=${() => { if (map) map.hash = map.hash === true ? false : true; }}>Toggle URL camera</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Camera in the unnamed URL fragment" hash-format="unnamed" center="[6.13, 49.61]" zoom="8"
        style="block-size: 20rem" .mapStyle=${OFFLINE_RASTER_STYLE}></lr-map>
      <p>With the URL camera on, the frame URL reads <code>#zoom/lat/lng</code>; a valid one there beats the initial fit.</p>
    `;
  },
};

/** More than 64 atlas images, a signed-distance-field icon recolored by `icon-color`, and icons
 *  supplied on demand by `imageProvider`. */
export const SpriteCatalogAndLazyImages: Story = {
  render: () => {
    const shape = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${fill}"/></svg>`;
    const catalog = Array.from({ length: 96 }, (_, index) => ({ id: `poi-${index}`, width: 24, height: 24, pixelRatio: 1,
      source: { kind: 'svg' as const, markup: shape(index % 2 ? storyColor('success') : storyColor('warning')) } }));
    const points = Array.from({ length: 12 }, (_, index) => ({ type: 'Feature' as const, id: index,
      properties: { icon: index < 6 ? `poi-${index * 16}` : `station-${index}` },
      geometry: { type: 'Point' as const, coordinates: [(index % 6) * 4 - 10, index < 6 ? 3 : -3] } }));
    return html`
      <p>The top row uses the 96-image catalog; the bottom row is supplied on demand as SDF icons.</p>
      <lr-map label="Sprite catalog and lazy icons" center="[0, 0]" zoom="4" style="block-size: 20rem"
        .mapStyle=${LYRA_MAP_EMPTY_STYLE} .images=${catalog}
        .imageProvider=${(id: string) => id.startsWith('station-')
          ? { id, width: 32, height: 32, pixelRatio: 1, sdf: true, source: { kind: 'svg', markup: shape(storyColor('text')) } }
          : undefined}
        .overlays=${{
          sources: [{ id: 'places', source: { type: 'geojson', data: { type: 'FeatureCollection', features: points } } }],
          layers: [{ interactive: true, layer: { id: 'places-icon', type: 'symbol', source: 'places',
            layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true },
            paint: { 'icon-color': storyColor('brand') } } }],
        }}
      ></lr-map>
    `;
  },
};

export const BoundsAtWholeWorldZoom: Story = {
  render: () => html`
    <lr-map
      style="height: 20rem"
      label="World map limited to Europe"
      center="[10, 50]"
      zoom="0.4"
      .maxBounds=${[[-30, 30], [50, 72]]}
      .mapStyle=${OFFLINE_RASTER_STYLE}
    ></lr-map>
  `,
};

/** Canvas clicks use the declared corners, including transparent pixels. */
export const CanvasFootprint: Story = {
  render: () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = storyColor('brand');
    context.fillRect(0, 0, 32, 64);
    const layer: LyraMapCanvasDataLayer = {
      kind: 'canvas', sourceId: 'local-heat', canvas, animate: false,
      coordinates: [[-5, 5], [5, 5], [5, -5], [-5, -5]],
      interactive: true, category: 'heat', priority: 1,
    };
    let map: LyraMap | undefined;
    let status: HTMLElement | undefined;
    return html`
      <p>The full four-corner footprint is clickable, including its transparent half.</p>
      <lr-button @click=${() => { if (map) map.hiddenCategories = map.hiddenCategories.length ? [] : ['heat']; }}>Toggle category</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Canvas footprint interaction" center="[0, 0]" zoom="3" style="block-size: 22rem"
        .mapStyle=${LYRA_MAP_EMPTY_STYLE} .dataLayers=${[layer]}
        .legend=${[{ value: 'heat', label: 'Heat footprint', color: storyColor('brand'), pattern: 'solid' }]}
        @lr-map-click=${(event: CustomEvent<{ sourceId?: string }>) => {
          if (status) status.textContent = event.detail.sourceId ?? 'Map background';
        }}
      ></lr-map>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Click the footprint or the surrounding map.</p>
    `;
  },
};

export const OwnedResourcesAndReadiness: Story = {
  render: () => {
    let status: HTMLElement | undefined;
    return html`
      <p>Owned native resources survive style replacement; overrides style the base layer.</p>
      <lr-map label="Owned native resources" initialization="eager" style="block-size: 22rem"
        .mapStyle=${{ version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] }}
        .overlays=${{
          sources: [{ id: 'local-shape', source: { type: 'geojson', data: {
            type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-5, 0], [5, 0]] },
          } } }],
          layers: [{ layer: { id: 'local-line', type: 'line', source: 'local-shape',
            paint: { 'line-color': storyColor('brand'), 'line-width': 4 } }, interactive: true }],
        }}
        .images=${[{ id: 'local-icon', source: { kind: 'svg', markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="currentColor"/></svg>' }, width: 32, height: 32, pixelRatio: 1 }]}
        .styleOverrides=${[{ layerId: 'background', paint: { 'background-color': storyColor('brand') } }]}
        @lr-map-style-load=${async (event: Event) => {
          try { await (event.currentTarget as LyraMap).whenIdle(); if (status) status.textContent = 'Current resources are idle'; }
          catch { if (status) status.textContent = 'Readiness was interrupted'; }
        }}
      ></lr-map>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Waiting for style readiness</p>
    `;
  },
};

export const PickingAndFeatureState: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let status: HTMLElement | undefined;
    return html`
      <lr-button @click=${() => { if (map) map.pickMode = !map.pickMode; }}>Toggle coordinate picking</lr-button>
      <lr-button @click=${() => {
        const accepted = map?.setFeatureState({ origin: 'data-layer', source: 'site', id: 1 }, { selected: true });
        if (status) status.textContent = accepted ? JSON.stringify(map?.getFeatureState({ source: 'site', id: 1 })) : 'State was not admitted';
      }}>Set and read feature state</lr-button>
      <lr-button @click=${() => map?.removeFeatureState({ source: 'site', id: 1 })}>Clear feature state</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Picking and feature state" style="block-size: 22rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}
        .controls=${{ navigation: true, scale: true, geolocate: false, attribution: true }}
        .hash=${false} .interactiveBasemapLayers=${[]}
        .dataLayers=${[{ sourceId: 'site', interactive: true, priority: 2, geojson: {
          type: 'FeatureCollection', features: [{ type: 'Feature', id: 1, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
        } }]}
        @lr-map-pick=${(event: CustomEvent) => { if (status) status.textContent = JSON.stringify(event.detail); }}
        @lr-map-contextmenu=${(event: CustomEvent) => { if (status) status.textContent = JSON.stringify(event.detail); }}
      ></lr-map>
      <p>Hash synchronization is disabled in this embedded demo. Set a distinct string key to enroll a map.</p>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Pick a coordinate or open the map context menu.</p>
    `;
  },
};

export const DrawingAndExplicitEditing: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let completed: import('./map.js').LyraMapDrawingSnapshot | undefined;
    let status: HTMLElement | undefined;
    return html`
      <lr-button @click=${() => { if (map) map.drawMode = 'line'; }}>Draw line</lr-button>
      <lr-button @click=${() => { if (map) map.drawMode = 'polygon'; }}>Draw polygon</lr-button>
      <lr-button @click=${() => map?.undoDrawing()}>Undo</lr-button>
      <lr-button @click=${() => map?.completeDrawing()}>Finish</lr-button>
      <lr-button @click=${() => map?.cancelDrawing()}>Cancel</lr-button>
      <lr-button @click=${() => { if (completed) map?.editDrawing(completed); }}>Edit completed shape</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Line and polygon drawing" style="block-size: 22rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}
        @lr-map-draw-complete=${(event: CustomEvent<import('./map.js').LyraMapDrawingSnapshot>) => {
          completed = event.detail; if (status) status.textContent = JSON.stringify(event.detail);
        }}
        @lr-map-draw-cancel=${(event: CustomEvent) => { if (status) status.textContent = JSON.stringify(event.detail); }}
      ></lr-map>
      <p>Use pointer vertices or the map's keyboard center controls. Editing begins only with the explicit edit action.</p>
      <pre role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Complete a shape to inspect geometry and metrics.</pre>
    `;
  },
};

export const AnchorBoundaryAndFocus: Story = {
  render: () => {
    let map: LyraMap | undefined;
    return html`
      <lr-button @click=${() => { if (map) { map.anchorLngLat = [0, 0]; map.anchorBoundary = map; } }}>Open within map boundary</lr-button>
      <lr-button @click=${() => { if (map) map.anchorClosable = !map.anchorClosable; }}>Toggle close affordance</lr-button>
      <lr-button @click=${() => map?.focusAnchor()}>Focus anchor</lr-button>
      <lr-button @click=${() => map?.closeAnchor()}>Close anchor</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Bounded anchor" style="block-size: 22rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}
        .anchorSafeArea=${{ inlineStart: 24, blockEnd: 24 }}>
        <div slot="anchor"><p>Anchored details</p><button type="button">Inspect location</button></div>
      </lr-map>
    `;
  },
};

export const InitializationAndImageExport: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let status: HTMLElement | undefined;
    return html`
      <p>The first map constructs when visible; the others request idle and eager construction.</p>
      <lr-button @click=${async () => {
        if (!map) return;
        try {
          const blob = await map.exportImage({ type: 'image/png', attribution: true });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a'); link.href = url; link.download = 'map.png'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          if (status) status.textContent = 'PNG exported with attribution';
        } catch { if (status) status.textContent = 'Image export unavailable'; }
      }}>Download PNG with attribution</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        label="Visible initialization and image export" initialization="visible"
        style="block-size: 18rem" .mapStyle=${OFFLINE_RASTER_STYLE}></lr-map>
      <lr-map label="Idle initialization" initialization="idle" style="block-size: 12rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}></lr-map>
      <lr-map label="Eager initialization" initialization="eager" style="block-size: 12rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}></lr-map>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>The export includes the native frame; DOM overlays are excluded.</p>
    `;
  },
};

export const CanvasSourceZoomAndOpacity: Story = {
  render: () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = storyColor('brand');
    context.fillRect(0, 0, 64, 64);
    const layer: LyraMapCanvasDataLayer = {
      kind: 'canvas', sourceId: 'local-canvas', canvas, animate: false,
      coordinates: [[-5, 5], [5, 5], [5, -5], [-5, -5]],
      minZoom: 0, maxZoom: 12, opacity: 0.5, category: 'canvas', interactive: true, priority: 1,
    };
    return html`
      <p>The local canvas source has explicit zoom limits, opacity and category identity.</p>
      <lr-map label="Local canvas source options" style="block-size: 22rem" zoom="3"
        .mapStyle=${LYRA_MAP_EMPTY_STYLE} .dataLayers=${[layer]}></lr-map>
    `;
  },
};

/** A local "basemap" whose layers the selectors below address by source and type. */
const selectorBasemap = () => ({
  version: 8,
  sources: { places: { type: 'geojson', data: { type: 'FeatureCollection', features: [
    { type: 'Feature', id: 1, properties: { name: 'North square' }, geometry: { type: 'Polygon', coordinates: [[[-8, 2], [-2, 2], [-2, 8], [-8, 8], [-8, 2]]] } },
    { type: 'Feature', id: 2, properties: { name: 'South square' }, geometry: { type: 'Polygon', coordinates: [[[2, -8], [8, -8], [8, -2], [2, -2], [2, -8]]] } },
  ] } } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': storyColor('surface') } },
    { id: 'places-fill', type: 'fill', source: 'places', paint: { 'fill-color': storyColor('quiet') } },
    { id: 'places-outline', type: 'line', source: 'places', paint: { 'line-color': storyColor('text') } },
  ],
});

export const InteractionInitialization: Story = {
  render: () => html`
    <p>Each map shows its placeholder until the first press, touch, wheel or key on it. The second also starts by itself after three seconds.</p>
    <lr-map label="Starts on first input" initialization="interaction" style="block-size: 16rem" .mapStyle=${OFFLINE_RASTER_STYLE}
      .controls=${{ navigation: true }}></lr-map>
    <lr-map label="Starts on input or after a delay" initialization="interaction" initialization-delay="3000"
      style="block-size: 16rem" .mapStyle=${OFFLINE_RASTER_STYLE}></lr-map>
  `,
};

export const ThemedOverlayPaint: Story = {
  render: () => {
    let wrapper: HTMLElement | undefined;
    return html`
      <lr-button @click=${() => { wrapper?.style.setProperty('--story-overlay', wrapper.style.getPropertyValue('--story-overlay') ? '' : 'oklch(0.6 0.2 30)'); }}>
        Toggle the overlay token</lr-button>
      <div ${ref(node => { wrapper = node as HTMLElement | undefined; })}>
        <lr-map label="Theme tokens in overlay paint" style="block-size: 20rem" zoom="3" .mapStyle=${selectorBasemap()}
          .overlays=${{ layers: [{ layer: { id: 'places-highlight', type: 'line', source: 'places',
            paint: { 'line-color': 'var(--story-overlay, var(--lr-color-brand))', 'line-width': 5 } } }] }}></lr-map>
      </div>
      <p>The highlight layer reads the basemap's own <code>places</code> source; its color is a token that follows the theme.</p>
    `;
  },
};

export const BasemapSelectorsAndPointer: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let catalog: HTMLElement | undefined;
    let pointer: HTMLElement | undefined;
    let hover: HTMLElement | undefined;
    return html`
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })} label="Basemap selectors" style="block-size: 20rem" zoom="3"
        .mapStyle=${selectorBasemap()}
        .styleOverrides=${[{ source: 'places', layerType: 'fill', paint: { 'fill-color': 'var(--lr-color-brand)' } }]}
        .interactiveBasemapLayers=${[{ source: 'places', layerType: 'fill' }]}
        @lr-map-style-load=${() => { if (catalog && map) catalog.textContent = map.styleLayers.map(layer => `${layer.id} (${layer.type})`).join(', '); }}
        @lr-map-pointer-move=${(event: CustomEvent<import('./map.js').LyraMapPointerDetail>) => {
          if (pointer) pointer.textContent = event.detail.lngLat.map(value => value.toFixed(3)).join(', ');
        }}
        @lr-map-pointer-leave=${() => { if (pointer) pointer.textContent = 'Outside the map'; }}
        @lr-map-feature-enter=${(event: CustomEvent<import('./map.js').LyraMapInteractionDetail>) => {
          if (hover) hover.textContent = `${String(event.detail.feature?.properties?.['name'])}: ${event.detail.feature?.geometry?.type ?? 'no geometry'}`;
        }}
        @lr-map-feature-leave=${() => { if (hover) hover.textContent = 'No feature'; }}
      ></lr-map>
      <p>Style layers: <span ${ref(node => { catalog = node as HTMLElement | undefined; })}>loading</span></p>
      <p>Pointer: <span ${ref(node => { pointer = node as HTMLElement | undefined; })}>Outside the map</span></p>
      <p>Hovered feature: <span ${ref(node => { hover = node as HTMLElement | undefined; })}>No feature</span></p>
    `;
  },
};

export const DrawingMeasurementsAndShortcuts: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let status: HTMLElement | undefined;
    let raster = true;
    return html`
      <lr-button @click=${() => { if (map) map.drawMode = 'polygon'; }}>Draw polygon</lr-button>
      <lr-button @click=${() => { if (map) map.drawMode = 'line'; }}>Draw line</lr-button>
      <lr-button @click=${() => { raster = !raster; if (map) map.mapStyle = raster ? OFFLINE_RASTER_STYLE : LYRA_MAP_EMPTY_STYLE; }}>
        Swap the style while drawing</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })} label="Measured drawing" style="block-size: 22rem; --lr-map-drawing-color: var(--lr-color-danger)"
        zoom="3" drawing-measurements .mapStyle=${OFFLINE_RASTER_STYLE}
        @lr-map-draw-vertex-end=${(event: CustomEvent<import('./map.js').LyraMapDrawingVertexEndDetail>) => {
          if (status) status.textContent = `Vertex ${event.detail.index + 1} moved`;
        }}
        @lr-map-draw-complete=${(event: CustomEvent<import('./map.js').LyraMapDrawingSnapshot>) => {
          if (status) status.textContent = `Completed: ${JSON.stringify(event.detail.metrics)}`;
        }}
      ></lr-map>
      <p>Click near the first vertex to close a polygon. With the map focused, Enter finishes and Backspace removes the last vertex.</p>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Start a drawing.</p>
    `;
  },
};

export const GeolocationSuccess: Story = {
  render: () => {
    let status: HTMLElement | undefined;
    return html`
      <lr-map label="Geolocation" style="block-size: 18rem" .mapStyle=${OFFLINE_RASTER_STYLE} .controls=${{ geolocate: true }}
        @lr-map-geolocate=${(event: CustomEvent<import('./map.js').LyraMapGeolocateDetail>) => {
          if (status) status.textContent = `Located ${event.detail.lngLat.map(value => value.toFixed(4)).join(', ')} within ${Math.round(event.detail.accuracy)} m`;
        }}
        @lr-map-geolocate-error=${(event: CustomEvent) => { if (status) status.textContent = `Location failed: ${String(event.detail.code)}`; }}
      ></lr-map>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Use the location button on the map.</p>
    `;
  },
};


export const CanvasRedrawAndLocalImage: Story = {
  render: () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    let map: LyraMap | undefined, revision = 0;
    const draw = () => { context.fillStyle = storyColor(revision % 2 ? 'danger' : 'brand'); context.fillRect(0, 0, 64, 64); };
    draw();
    const rows = () => [{ kind: 'canvas' as const, sourceId: 'drawing', canvas, animate: false, redrawRevision: revision,
      coordinates: [[-12, 6], [-2, 6], [-2, -6], [-12, -6]] as const },
      { kind: 'image' as const, sourceId: 'snapshot', url: canvas.toDataURL('image/png'),
        coordinates: [[2, 6], [12, 6], [12, -6], [2, -6]] as const }];
    return html`
      <p>Redraw the canvas and update its image snapshot.</p>
      <button type="button" @click=${() => { revision++; draw(); if (map) map.dataLayers = rows(); }}>Change colors</button>
      <lr-map label="Canvas drawing and image snapshot" style="block-size:22rem" zoom="3"
        ${ref(node => { map = node as LyraMap | undefined; })}
        .mapStyle=${LYRA_MAP_EMPTY_STYLE} .dataLayers=${rows()}></lr-map>
    `;
  },
};


/** Eight independent controllers publish through one application-owned aggregator. */
export const IndependentModules: Story = {
  render: () => {
    let map: LyraMap | undefined, status: HTMLElement | undefined;
    let modules = createMapModuleDemo(storyColor('brand'));
    const publish = createMapModulePublisher(value => { if (map) map.overlays = value; });
    return html`
      <p>Eight city layers. Click an area to highlight it; change the roads or remove alerts independently.</p>
      <lr-button @click=${() => {
        modules = Object.freeze({ ...modules, roads: createMapModule('roads', modules.roads!.sources[0]!.source['data'] as object, storyColor('warning')) });
        publish(modules);
      }}>Change roads</lr-button>
      <lr-button @click=${() => {
        const { alerts: _removed, ...remaining } = modules; modules = Object.freeze(remaining); publish(modules);
      }}>Remove alerts</lr-button>
      <lr-button @click=${() => {
        if (map) map.mapStyle = { ...LYRA_MAP_EMPTY_STYLE };
      }}>Reload base style</lr-button>
      <lr-button @click=${() => {
        try { publish({ ...modules, selection: modules.districts }); }
        catch { if (status) status.textContent = 'Duplicate layer rejected. The city layers are unchanged.'; }
      }}>Try conflicting module</lr-button>
      <lr-map ${ref(node => {
        map = node as LyraMap | undefined;
        if (map) publish(modules);
      })} label="Independent city layers" center="[0, 0]" zoom="4" style="block-size: 24rem"
        .mapStyle=${LYRA_MAP_EMPTY_STYLE}
        @lr-map-click=${(event: CustomEvent<{ sourceId?: string; hit?: { origin: string; id?: string | number } }>) => {
          const { sourceId, hit } = event.detail;
          if (map && hit?.origin === 'overlay' && sourceId && hit.id !== undefined) {
            map.setFeatureState({ origin: 'overlay', source: sourceId, id: hit.id }, { color: storyColor('danger') });
            if (status) status.textContent = `Selected ${sourceId}`;
          }
        }}></lr-map>
      <p role="status" ${ref(node => { status = node as HTMLElement | undefined; })}>Click a city area.</p>
    `;
  },
};


/** All four controls share one corner, retaining keyboard focus when their corner changes. */
export const OrderedLinkedControls: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let top = false;
    const controls = () => {
      const position = top ? 'top-right' as const : 'bottom-left' as const;
      return { navigation: { position }, scale: { position }, geolocate: { position },
        attribution: { position, compact: false, customAttribution: [
          'Local survey', { label: 'Data contributors', url: 'https://www.openstreetmap.org/copyright' },
        ] } };
    };
    return html`<div style="display: grid; gap: var(--lr-space-s)">
      <lr-button @click=${() => { top = !top; if (map) map.controls = controls(); }}>Move controls</lr-button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })}
        style="height: 24rem" label="Map credits and navigation" center="[2.3522, 48.8566]" zoom="9"
        .controls=${controls()} .mapStyle=${OFFLINE_RASTER_STYLE}></lr-map>
    </div>`;
  },
};


export const GeoJsonRowBoundsAndOrder: Story = {
  render: () => {
    let map: LyraMap | undefined;
    let visible = true;
    const geojson = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [[[-8, -6], [8, -6], [8, 6], [-8, 6], [-8, -6]]] } }] };
    const rows = (): readonly LyraMapGeoJsonDataLayer[] => [{ sourceId: 'area', geojson,
      minZoom: 2, maxZoom: visible ? 8 : 2, before: 'reference-line', color: storyColor('brand') }];
    return html`
      <p>The area is visible from zoom 2 to zoom 8, below the reference outline.</p>
      <button type="button" @click=${() => { visible = !visible; if (map) map.dataLayers = rows(); }}>Toggle area</button>
      <lr-map label="Area visibility and layer order" style="block-size:22rem" zoom="3"
        ${ref(node => { map = node as LyraMap | undefined; })}
        .mapStyle=${LYRA_MAP_EMPTY_STYLE} .dataLayers=${rows()}
        .overlays=${{ sources: [{ id: 'reference', source: { type: 'geojson', data: geojson } }],
          layers: [{ layer: { id: 'reference-line', type: 'line', source: 'reference',
            paint: { 'line-color': storyColor('danger'), 'line-width': 4 } } }] }}></lr-map>
    `;
  },
};

/** Finite primary vector styling with row-owned opacity and a property filter. */
export const TypedVectorStyle: Story = {
  render: () => html`
    <p>Vector country polygons use a typed fill style. This example loads public demonstration tiles.</p>
    <lr-map label="Typed vector polygons" center="[0, 20]" zoom="1" style="block-size: 24rem"
      .mapStyle=${LYRA_MAP_EMPTY_STYLE}
      .dataLayers=${[{
        kind: 'vector', sourceId: 'countries', source: { url: 'https://demotiles.maplibre.org/tiles/tiles.json' },
        sourceLayer: 'countries', render: 'fill', opacity: 0.7,
        paint: { 'fill-color': storyColor('brand'), 'fill-outline-color': storyColor('border') },
        filter: ['has', 'name'],
      }]}>
    </lr-map>
  `,
};
