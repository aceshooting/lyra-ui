import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { ChoroplethLayer, GeoJsonDataLayer, LegendEntry, MapMarker } from './map.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';
import '../../../../../../.storybook/maplibre-worker.js';

const legend = (): LegendEntry[] => [
  { color: storyColor('brand'), label: 'Low' },
  { color: storyColor('danger'), label: 'High' },
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

const meta: Meta = {
  title: 'Map',
  component: 'lr-map',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Demoed with a raster OpenStreetMap tile style since a vector style needs an API key.',
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
 * `choropleth` adds a GeoJSON fill layer, colored by interpolating `field`'s
 * value across `stops` -- pair it with `legend` to label the color ramp.
 */
export const Choropleth: Story = {
  render: () => {
    const choropleth: ChoroplethLayer = {
      sourceId: 'regions',
      field: 'value',
      stops: [
        [0, storyColor('brand')],
        [50, storyColor('warning')],
        [100, storyColor('danger')],
      ],
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
        .legend=${[
          { color: storyColor('brand'), label: 'Low' },
          { color: storyColor('warning'), label: 'Medium' },
          { color: storyColor('danger'), label: 'High' },
        ]}
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
    const dataLayers: GeoJsonDataLayer[] = [
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

/**
 * `markers` renders a pin per entry, each with an optional colored tint and
 * an openable popup built from `label` (plain text) or `unsafeHtml` (raw
 * markup -- only ever pass trusted content).
 */
export const Markers: Story = {
  render: () => {
    const markers: MapMarker[] = [
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
        .markers=${markers}
        .mapStyle=${RASTER_STYLE}
      ></lr-map>
    `;
  },
};
