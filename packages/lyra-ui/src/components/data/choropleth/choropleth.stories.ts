import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-choropleth.js';

const meta: Meta = {
  title: 'Data Display/Choropleth',
  component: 'lr-choropleth',
  tags: ['autodocs'],
};

export default meta;

const CENTRAL = [[0, 24], [14, 24], [14, 49], [0, 49], [0, 24]];
const LAKE = [[4, 33], [10, 33], [10, 41], [4, 41], [4, 33]];
const ISLAND_ONE = [[18, 28], [25, 28], [25, 37], [18, 37], [18, 28]];
const ISLAND_TWO = [[27, 39], [32, 39], [32, 45], [27, 45], [27, 39]];
const WEST = [[-12, 27], [-4, 27], [-4, 46], [-12, 46], [-12, 27]];

const REGIONS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'central',
      properties: { name: 'Central district', value: 320, change: 14 },
      geometry: { type: 'Polygon', coordinates: [CENTRAL, LAKE] },
    },
    {
      type: 'Feature',
      id: 'islands',
      properties: { name: 'Eastern islands', value: 180, change: -21 },
      geometry: { type: 'MultiPolygon', coordinates: [[ISLAND_ONE], [ISLAND_TWO]] },
    },
    {
      type: 'Feature',
      id: 'west',
      properties: { name: 'Western district' },
      geometry: { type: 'Polygon', coordinates: [WEST] },
    },
  ],
};

const TOPOLOGY = {
  type: 'Topology',
  arcs: [CENTRAL, LAKE, ISLAND_ONE, ISLAND_TWO, WEST],
  objects: {
    regions: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: 'central', properties: REGIONS.features[0]!.properties, arcs: [[0], [1]] },
        { type: 'MultiPolygon', id: 'islands', properties: REGIONS.features[1]!.properties, arcs: [[[2]], [[3]]] },
        { type: 'Polygon', id: 'west', properties: REGIONS.features[2]!.properties, arcs: [[4]] },
      ],
    },
  },
};

export const Default: StoryObj = {
  render: () => html`
    <lr-choropleth
      label="Infrastructure spending by district"
      description="The central district surrounds a lake. The eastern district spans two islands."
      data-table-toggle
      .geography=${REGIONS}
    ></lr-choropleth>
  `,
};

export const DivergingMercator: StoryObj = {
  render: () => html`
    <lr-choropleth
      label="Year-over-year spending change"
      field="change"
      palette="diverging"
      projection="mercator"
      data-table-toggle
      .geography=${REGIONS}
      .valueFormatter=${(value: number) => `${value}%`}
    ></lr-choropleth>
  `,
};

export const TopoJson: StoryObj = {
  render: () => html`
    <lr-choropleth
      label="Infrastructure spending by district"
      .geography=${TOPOLOGY}
      .noData=${{ label: 'Not reported' }}
      with-data-table
      data-table-toggle
    ></lr-choropleth>
  `,
};

export const SelectedTopoJsonObject: StoryObj = {
  render: () => html`
    <lr-choropleth
      label="Infrastructure spending by district"
      object="regions"
      .geography=${{
        ...TOPOLOGY,
        objects: {
          ...TOPOLOGY.objects,
          outline: { type: 'Polygon', id: 'outline', properties: { name: 'Coastline' }, arcs: [[0]] },
        },
      }}
    ></lr-choropleth>
  `,
};

export const Narrow320: StoryObj = {
  render: () => html`
    <lr-choropleth
      label="District spending in a narrow panel"
      style="inline-size: 320px; max-inline-size: 100%"
      data-table-toggle
      .geography=${{
        ...REGIONS,
        features: [
          { ...REGIONS.features[0], properties: { name: 'Central metropolitan investment and development district', value: 320 } },
          ...REGIONS.features.slice(1),
        ],
      }}
    ></lr-choropleth>
  `,
};

export const RightToLeft: StoryObj = {
  render: () => html`
    <lr-choropleth
      dir="rtl"
      locale="ar"
      label="الإنفاق حسب المنطقة"
      data-table-toggle
      .geography=${{
        ...REGIONS,
        features: REGIONS.features.map((feature, index) => ({
          ...feature,
          properties: {
            ...feature.properties,
            name: ['المنطقة الوسطى', 'الجزر الشرقية', 'المنطقة الغربية'][index],
          },
        })),
      }}
    ></lr-choropleth>
  `,
};

export const Loading: StoryObj = {
  render: () => html`<lr-choropleth label="Infrastructure spending by district" loading></lr-choropleth>`,
};

export const Empty: StoryObj = {
  render: () => html`<lr-choropleth label="Infrastructure spending by district"></lr-choropleth>`,
};
