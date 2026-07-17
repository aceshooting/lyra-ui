import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './geojson-view.js';

const meta: Meta = { title: 'DocumentViewer/GeojsonView', component: 'lyra-geojson-view', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const sample = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.42, 37.77] }, properties: {} },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.5, 37.8] }, properties: {} },
  ],
};
const src = `data:application/geo+json,${encodeURIComponent(JSON.stringify(sample))}`;

export const Default: Story = {
  render: () => html`<lyra-geojson-view src=${src} name="zones.geojson"></lyra-geojson-view>`,
};

export const Empty: Story = { render: () => html`<lyra-geojson-view></lyra-geojson-view>` };
