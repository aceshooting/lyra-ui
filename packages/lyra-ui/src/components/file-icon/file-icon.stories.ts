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
