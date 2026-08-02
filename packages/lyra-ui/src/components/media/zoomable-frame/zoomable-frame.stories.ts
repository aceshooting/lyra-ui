import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './zoomable-frame.js';

const meta: Meta = {
  title: 'Media/Zoomable Frame',
  component: 'lr-zoomable-frame',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const previewDocument = `<!doctype html>
<html><body style="font-family:system-ui;margin:2rem">
  <h1>Responsive component preview</h1>
  <p>This document stays inside a sandboxed iframe while the outer controls scale it.</p>
</body></html>`;

export const InlineDocument: Story = {
  render: () => html`<lr-zoomable-frame
    aria-label="Inline component preview"
    .srcdoc=${previewDocument}
    zoom="0.75"
    with-theme-sync
  ></lr-zoomable-frame>`,
};

export const NonInteractive: Story = {
  render: () => html`<lr-zoomable-frame
    aria-label="Non-interactive preview"
    .srcdoc=${previewDocument}
    without-interaction
    without-controls
  ></lr-zoomable-frame>`,
};
