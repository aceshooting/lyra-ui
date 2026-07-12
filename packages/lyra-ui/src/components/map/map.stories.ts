import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { ChoroplethLayer, LegendEntry, MapMarker } from '../../lyra.js';

const legend: LegendEntry[] = [
  { color: '#5b8def', label: 'Low' },
  { color: '#e5484d', label: 'High' },
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

const meta: Meta = {
  title: 'Map',
  component: 'lyra-map',
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
    <lyra-map
      style="height: 20rem"
      center="[2.3522, 48.8566]"
      zoom="4"
      .legend=${legend}
      .mapStyle=${RASTER_STYLE}
    ></lyra-map>
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
        [0, '#5b8def'],
        [50, '#f2c94c'],
        [100, '#e5484d'],
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
      <lyra-map
        style="height: 20rem"
        center="[2.3522, 48.8566]"
        zoom="10"
        .legend=${[
          { color: '#5b8def', label: 'Low' },
          { color: '#f2c94c', label: 'Medium' },
          { color: '#e5484d', label: 'High' },
        ]}
        .choropleth=${choropleth}
        .mapStyle=${RASTER_STYLE}
      ></lyra-map>
    `;
  },
};

/**
 * `markers` renders a pin per entry, each with an optional colored tint and
 * an openable popup built from `label` (plain text) or `html` (raw markup).
 */
export const Markers: Story = {
  render: () => {
    const markers: MapMarker[] = [
      { id: 'eiffel', lngLat: [2.2945, 48.8584], label: 'Eiffel Tower' },
      {
        id: 'louvre',
        lngLat: [2.3364, 48.8606],
        color: '#e5484d',
        html: '<strong>Louvre</strong><br>Museum',
      },
    ];
    return html`
      <lyra-map
        style="height: 20rem"
        center="[2.3522, 48.8566]"
        zoom="12"
        .markers=${markers}
        .mapStyle=${RASTER_STYLE}
      ></lyra-map>
    `;
  },
};
