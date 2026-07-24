import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './geojson-view.js';
import '../../../../../../.storybook/maplibre-worker.js';

const meta: Meta = { title: 'DocumentViewer/GeojsonView', component: 'lr-geojson-view', tags: ['autodocs'] };
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
  render: () => html`<lr-geojson-view src=${src} name="zones.geojson"></lr-geojson-view>`,
};

export const Empty: Story = { render: () => html`<lr-geojson-view></lr-geojson-view>` };

/** Baseline narrow-allocation coverage with a long map name. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-geojson-view src=${src} name="International analytical-engine research observation zones.geojson"></lr-geojson-view></div>`,
};
