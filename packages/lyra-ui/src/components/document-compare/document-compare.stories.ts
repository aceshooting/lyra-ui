import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './document-compare.js';

const meta: Meta = {
  title: 'DocumentCompare',
  component: 'lr-document-compare',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Side-by-side or inline comparison of two document versions, composed from `<lr-diff-view>` (the real two-string line diff, `view="diff"`) and `<lr-document-preview>` (each version\'s own actual rendered content, `view="side-by-side"`), with proportional scroll sync and shared-highlight-anchor sync between the two side-by-side panes.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const oldPolicy = `# Refund Policy
Refunds are available within 14 days of purchase.
Contact support to start a refund.`;

const newPolicy = `# Refund Policy
Refunds are available within 30 days of purchase.
Contact support to start a refund.
Digital goods are non-refundable once downloaded.`;

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

export const Default: Story = {
  name: 'Inline diff (default)',
  render: () => html`
    <lr-document-compare
      style="max-width: 40rem;"
      .oldVersion=${{ id: 'v1', name: 'v1.0', text: oldPolicy }}
      .newVersion=${{ id: 'v2', name: 'v1.1', text: newPolicy }}
    ></lr-document-compare>
  `,
};

export const SplitDiff: Story = {
  render: () => html`
    <lr-document-compare
      style="max-width: 48rem;"
      diff-layout="split"
      copyable
      .oldVersion=${{ id: 'v1', name: 'v1.0', text: oldPolicy }}
      .newVersion=${{ id: 'v2', name: 'v1.1', text: newPolicy }}
    ></lr-document-compare>
  `,
};

export const SideBySide: Story = {
  name: 'Side-by-side rendered versions',
  render: () => html`
    <lr-document-compare
      style="max-width: 48rem;"
      view="side-by-side"
      .oldVersion=${{ id: 'v1', name: 'v1.0', mimeType: 'image/png', uri: PIXEL }}
      .newVersion=${{ id: 'v2', name: 'v1.1', mimeType: 'image/png', uri: PIXEL }}
    ></lr-document-compare>
  `,
};

export const SideBySideSyncedHighlights: Story = {
  name: 'Side-by-side with synchronized highlight anchors',
  parameters: {
    docs: {
      description: {
        story:
          'Both versions carry a region highlight sharing id "callout" at different positions. Activating either one scrolls the other pane to its own matching highlight.',
      },
    },
  },
  render: () => html`
    <lr-document-compare
      style="max-width: 48rem;"
      view="side-by-side"
      .oldVersion=${{
        id: 'v1',
        name: 'Before',
        mimeType: 'image/png',
        uri: PIXEL,
        highlights: [{ id: 'callout', label: 'Changed region', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 30, height: 20 } } }],
      }}
      .newVersion=${{
        id: 'v2',
        name: 'After',
        mimeType: 'image/png',
        uri: PIXEL,
        highlights: [{ id: 'callout', label: 'Changed region', anchor: { kind: 'region', rect: { x: 50, y: 40, width: 30, height: 20 } } }],
      }}
    ></lr-document-compare>
  `,
};

export const NoSyncScroll: Story = {
  name: 'Side-by-side with scroll sync disabled',
  render: () => html`
    <lr-document-compare
      style="max-width: 48rem;"
      view="side-by-side"
      .syncScroll=${false}
      .oldVersion=${{ id: 'v1', name: 'v1.0', mimeType: 'image/png', uri: PIXEL }}
      .newVersion=${{ id: 'v2', name: 'v1.1', mimeType: 'image/png', uri: PIXEL }}
    ></lr-document-compare>
  `,
};

/** 320px container — side-by-side panes stack vertically below 640px. */
export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-document-compare
        view="side-by-side"
        .oldVersion=${{ id: 'v1', name: 'v1.0', mimeType: 'image/png', uri: PIXEL }}
        .newVersion=${{ id: 'v2', name: 'v1.1', mimeType: 'image/png', uri: PIXEL }}
      ></lr-document-compare>
    </div>
  `,
};
