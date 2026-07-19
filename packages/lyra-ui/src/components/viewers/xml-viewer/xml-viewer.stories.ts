import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './xml-viewer.js';

const meta: Meta = { title: 'DocumentViewer/XmlViewer', component: 'lr-xml-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Agent updates</title>
<item><title>Release 3.7</title><link href="https://example.test/3.7">Details</link></item>
</channel></rss>`;

export const Default: Story = {
  render: () => html`<lr-xml-viewer name="feed.rss" .xml=${FEED} copyable></lr-xml-viewer>`,
};

export const CollapsedDepth: Story = {
  render: () => html`<lr-xml-viewer name="feed.rss" .xml=${FEED} collapsed-depth="2"></lr-xml-viewer>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-inline-size:320px"><lr-xml-viewer name="feed.rss" .xml=${FEED}></lr-xml-viewer></div>`,
};
