import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './xml-viewer.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = { title: 'DocumentViewer/XmlViewer', component: 'lr-xml-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Agent updates</title>
<item><title>Release 3.7</title><link href="https://example.test/3.7">Details</link></item>
</channel></rss>`;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Inline `xml` owns the document by presence. Read `source` for the current `{ kind: "inline", value }` snapshot; clearing `xml` returns authority to `src`.',
      },
    },
  },
  render: () => html`<lr-xml-viewer
    name="feed.rss"
    .xml=${FEED}
    copyable
    @lr-copy=${(event: CustomEvent) => console.info('XML copied', event.detail)}
    @lr-copy-error=${(event: CustomEvent) => console.warn('XML copy failed', event.detail)}
  ></lr-xml-viewer>`,
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

export const Highlights: Story = {
  name: 'Host-supplied highlights',
  parameters: {
    docs: {
      description: {
        story:
          'Every `highlights` entry whose anchor is a `node-path` this document resolves tints its element row with the entry tone and adds a focusable `highlight-action` button that emits `lr-highlight-activate`. `activeHighlightId` outlines the entry a host is currently showing. Retune each tone through `--lr-xml-viewer-highlight-<tone>-background`, and the active outline through `--lr-xml-viewer-highlight-active-outline`.',
      },
    },
  },
  render: () => html`
    <lr-xml-viewer
      name="feed.rss"
      .xml=${FEED}
      active-highlight-id="channel"
      .highlights=${[
        { id: 'channel', anchor: { kind: 'node-path', path: [0] }, tone: 'success', label: 'Channel' },
        { id: 'item', anchor: { kind: 'node-path', path: [0, 1] }, tone: 'warning' },
      ]}
    ></lr-xml-viewer>
  `,
};

export const AttributeAnchor: Story = {
  name: 'Attribute-addressing node-path anchor',
  parameters: {
    docs: {
      description: {
        story:
          "A `node-path` whose trailing segment is `'@attrName'` resolves to one specific attribute of the addressed element, and that one `attribute` pair is outlined with `--lr-xml-viewer-active-attribute-color` — so a citation pointing at a single attribute value of a multi-attribute element stays identifiable in the rendered tree.",
      },
    },
  },
  render: () => html`
    <lr-xml-viewer
      name="feed.rss"
      .xml=${FEED}
      .anchor=${{ kind: 'node-path', path: [0, 1, 1, '@href'] }}
    ></lr-xml-viewer>
  `,
};
