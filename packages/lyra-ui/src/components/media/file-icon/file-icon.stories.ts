import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './file-icon.js';

const meta: Meta = { title: 'FileIcon', component: 'lr-file-icon', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const Formats: Story = {
  render: () => html`<div style="display:flex; flex-wrap:wrap; gap:var(--lr-space-m);"><lr-file-icon mime-type="application/pdf" variant="label"></lr-file-icon><lr-file-icon mime-type="text/csv" variant="label"></lr-file-icon><lr-file-icon mime-type="image/png" variant="label"></lr-file-icon><lr-file-icon mime-type="video/mp4" variant="label"></lr-file-icon><lr-file-icon mime-type="application/zip" variant="label"></lr-file-icon></div>`,
};

export const FilenameFallback: Story = { render: () => html`<lr-file-icon name="presentation.pptx" mime-type="application/octet-stream" variant="label"></lr-file-icon>` };

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
  render: () => html`<div style="display:flex; flex-wrap:wrap; gap:var(--lr-space-m);"><lr-file-icon mime-type="application/pdf" variant="label" bytes="2415919"></lr-file-icon><lr-file-icon mime-type="image/png" variant="label" bytes="8452"></lr-file-icon><lr-file-icon mime-type="video/mp4" variant="label" bytes="734003200"></lr-file-icon></div>`,
};
