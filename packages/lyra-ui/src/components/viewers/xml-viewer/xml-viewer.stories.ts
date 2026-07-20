import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './xml-viewer.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

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

export const ThemedActiveMatch: Story = {
  name: 'Themed active search match (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-xml-viewer-active-match-color` recolors the outline on the *current* search match only — the dashed outline on the remaining matches keeps `--lr-color-warning`, which is exactly the distinction hijacking that token could not express. Set it on the element or any ancestor; it is not declared on `:host`, so an ancestor value is never shadowed. Call `search()` on the element to light it up.',
      },
    },
  },
  render: () => html`
    <lr-xml-viewer
      style="--lr-xml-viewer-active-match-color: ${storyColor('brand')};"
      name="feed.rss"
      .xml=${FEED}
    ></lr-xml-viewer>
  `,
};
