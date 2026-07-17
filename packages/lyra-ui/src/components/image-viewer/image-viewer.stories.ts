import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './image-viewer.js';

const meta: Meta = {
  title: 'DocumentViewer/ImageViewer',
  component: 'lyra-image-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Full pan/zoom raster-image viewer with labeled region highlights and opt-in region annotation, self-registering into the document-viewer registry for common image MIME types.' } } },
};
export default meta;
type Story = StoryObj;

const SRC = 'https://picsum.photos/id/1015/1200/800';

export const Default: Story = {
  render: () => html`<lyra-image-viewer src=${SRC} name="Mountain river"></lyra-image-viewer>`,
};

export const NoSrc: Story = {
  render: () => html`<lyra-image-viewer></lyra-image-viewer>`,
};

export const WithHighlights: Story = {
  render: () => html`<lyra-image-viewer
    src=${SRC}
    name="Mountain river"
    .highlights=${[
      { id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 25, height: 20 } }, label: 'Ridge line' },
      { id: 'h2', anchor: { kind: 'region', rect: { x: 55, y: 45, width: 20, height: 15 } }, tone: 'warning' },
    ]}
    active-highlight-id="h1"
  ></lyra-image-viewer>`,
};

export const AnnotatableMode: Story = {
  render: () => html`<lyra-image-viewer src=${SRC} name="Mountain river" annotatable></lyra-image-viewer>`,
};

export const FitWidth: Story = {
  render: () => html`<lyra-image-viewer src=${SRC} name="Mountain river" fit="width"></lyra-image-viewer>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-inline-size:320px"><lyra-image-viewer src=${SRC} name="Mountain river"></lyra-image-viewer></div>`,
};
