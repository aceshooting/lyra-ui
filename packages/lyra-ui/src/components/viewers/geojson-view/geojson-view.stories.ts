import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './geojson-view.js';
import '../../../../../../.storybook/maplibre-worker.js';

const meta: Meta = { title: 'DocumentViewer/GeoJsonViewer', component: 'lr-geojson-viewer', tags: ['autodocs'] };
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
const narrowSample = {
  ...sample,
  features: sample.features.map((feature, index) => ({
    ...feature,
    properties: index === 0
      ? { publicMetadata: 'international-analytical-engine-research-observation-zone-'.repeat(24) }
      : feature.properties,
  })),
};
const narrowSrc = `data:application/geo+json,${encodeURIComponent(JSON.stringify(narrowSample))}`;

export const Default: Story = {
  render: () => html`<lr-geojson-viewer src=${src} name="zones.geojson"></lr-geojson-viewer>`,
};

export const Empty: Story = { render: () => html`<lr-geojson-viewer></lr-geojson-viewer>` };

/** Narrow-allocation coverage with a long map name and long unbroken serialized metadata. */
export const Narrow320: Story = {
  render: () => html`<div style="inline-size:320px;max-inline-size:100%"><lr-geojson-viewer src=${narrowSrc} name="International analytical-engine research observation zones.geojson"></lr-geojson-viewer></div>`,
};

/** Compatibility alias for applications migrating from the pre-v9 tag. */
export const LegacyTagAlias: Story = {
  render: () => html`<lr-geojson-view src=${src} name="legacy-zones.geojson"></lr-geojson-view>`,
};
