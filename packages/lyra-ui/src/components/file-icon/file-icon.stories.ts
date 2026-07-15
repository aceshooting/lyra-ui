import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './file-icon.js';

const meta: Meta = { title: 'FileIcon', component: 'lyra-file-icon', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const Formats: Story = {
  render: () => html`<div style="display:flex; flex-wrap:wrap; gap:var(--lyra-space-m);"><lyra-file-icon mime-type="application/pdf" variant="label"></lyra-file-icon><lyra-file-icon mime-type="text/csv" variant="label"></lyra-file-icon><lyra-file-icon mime-type="image/png" variant="label"></lyra-file-icon><lyra-file-icon mime-type="video/mp4" variant="label"></lyra-file-icon><lyra-file-icon mime-type="application/zip" variant="label"></lyra-file-icon></div>`,
};

export const FilenameFallback: Story = { render: () => html`<lyra-file-icon name="presentation.pptx" mime-type="application/octet-stream" variant="label"></lyra-file-icon>` };
