import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './file-icon.js';
import { createFileTypeMetadataRegistry } from './file-type-metadata.js';

const meta: Meta = { title: 'FileIcon', component: 'lr-file-icon', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const Formats: Story = {
  render: () => html`<div style="display:flex; flex-wrap:wrap; gap:var(--lr-space-m);"><lr-file-icon mime-type="application/pdf" mode="label"></lr-file-icon><lr-file-icon mime-type="text/csv" mode="label"></lr-file-icon><lr-file-icon mime-type="image/png" mode="label"></lr-file-icon><lr-file-icon mime-type="video/mp4" mode="label"></lr-file-icon><lr-file-icon mime-type="application/zip" mode="label"></lr-file-icon></div>`,
};

export const FilenameFallback: Story = { render: () => html`<lr-file-icon name="presentation.pptx" mime-type="application/octet-stream" mode="label"></lr-file-icon>` };

export const BadgeTokensAcrossSizes: Story = {
  name: 'Badge tokens across sizes and locales',
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-m);">
      ${['1rem', '1.5rem', '2rem', '3rem'].map((size) => html`
        <div style="display:flex; align-items:center; gap:var(--lr-space-m);">
          <code>${size}</code>
          <lr-file-icon style="--lr-file-icon-size:${size}" mime-type="application/pdf"></lr-file-icon>
          <lr-file-icon style="--lr-file-icon-size:${size}" mime-type="application/octet-stream" name="index.ts"></lr-file-icon>
          <lr-file-icon style="--lr-file-icon-size:${size}" mime-type="application/octet-stream" name="photo.jpeg"></lr-file-icon>
          <lr-file-icon style="--lr-file-icon-size:${size}" mime-type="application/octet-stream" name="README"></lr-file-icon>
        </div>
      `)}
      <div style="display:flex; align-items:center; gap:var(--lr-space-m)" lang="fr">
        <lr-file-icon mime-type="application/json"></lr-file-icon>
        <lr-file-icon dir="rtl" mime-type="application/json"></lr-file-icon>
        <lr-file-icon mime-type="application/x-long-token" .registry=${createFileTypeMetadataRegistry([{
          mimeTypes: 'application/x-long-token',
          metadata: { label: 'Long token', abbreviation: 'WMV', icon: 'file', category: 'generic' },
        }])}></lr-file-icon>
      </div>
    </div>
  `,
};

export const ThemedBadge: Story = {
  name: 'Themed badge (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-file-icon-bg` and `--lr-file-icon-color` retint the format badge on their own. Neither is declared on `:host`, so a value set on any ancestor reaches every `<lr-file-icon>` beneath it.',
      },
    },
  },
  render: () => html`<div style="display:flex; flex-wrap:wrap; gap:var(--lr-space-m); --lr-file-icon-bg: var(--lr-color-success-quiet); --lr-file-icon-color: var(--lr-color-success);"><lr-file-icon mime-type="application/pdf" mode="label"></lr-file-icon><lr-file-icon mime-type="image/png" mode="label"></lr-file-icon></div>`,
};

const narrowContentRegistry = createFileTypeMetadataRegistry([{
  mimeTypes: 'application/x-narrow-content-demo',
  metadata: {
    label: 'QuarterlyFinancialSummaryForTheEmeaRegionWithoutBreakOpportunity',
    description: 'GeneratedFromTheSharedQuarterlyReportingTemplateWithNoBreakOpportunity',
    icon: 'pdf',
    category: 'document',
  },
}]);

export const NarrowLongContent: Story = {
  name: 'Narrow allocation (320px) with long label and description',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-file-icon
        style="max-inline-size: 100%"
        mime-type="application/x-narrow-content-demo"
        mode="label"
        bytes="1048576"
        .registry=${narrowContentRegistry}
      ></lr-file-icon>
    </div>
  `,
};

export const WithByteCount: Story = {
  name: 'bytes (formatted file size)',
  parameters: {
    docs: {
      description: {
        story:
          '`bytes` is a raw byte count — not a tier on the shared `size` ladder, which is why it is not called `size`. It is formatted and localized into `part="size"` alongside the label, and folded into the badge\'s accessible name.',
      },
    },
  },
  render: () => html`<div style="display:flex; flex-wrap:wrap; gap:var(--lr-space-m);"><lr-file-icon mime-type="application/pdf" mode="label" bytes="2415919"></lr-file-icon><lr-file-icon mime-type="image/png" mode="label" bytes="8452"></lr-file-icon><lr-file-icon mime-type="video/mp4" mode="label" bytes="734003200"></lr-file-icon></div>`,
};
