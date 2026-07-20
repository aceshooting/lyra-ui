import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './image-viewer.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'DocumentViewer/ImageViewer',
  component: 'lr-image-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Full pan/zoom raster-image viewer with labeled region highlights and opt-in region annotation, self-registering into the document-viewer registry for common image MIME types.' } } },
};
export default meta;
type Story = StoryObj;

const SRC = 'https://picsum.photos/id/1015/1200/800';

export const Default: Story = {
  render: () => html`<lr-image-viewer src=${SRC} name="Mountain river"></lr-image-viewer>`,
};

export const NoSrc: Story = {
  render: () => html`<lr-image-viewer></lr-image-viewer>`,
};

export const WithHighlights: Story = {
  render: () => html`<lr-image-viewer
    src=${SRC}
    name="Mountain river"
    .highlights=${[
      { id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 25, height: 20 } }, label: 'Ridge line' },
      { id: 'h2', anchor: { kind: 'region', rect: { x: 55, y: 45, width: 20, height: 15 } }, tone: 'warning' },
    ]}
    active-highlight-id="h1"
  ></lr-image-viewer>`,
};

export const AnnotatableMode: Story = {
  render: () => html`<lr-image-viewer src=${SRC} name="Mountain river" annotatable></lr-image-viewer>`,
};

export const FitWidth: Story = {
  render: () => html`<lr-image-viewer src=${SRC} name="Mountain river" fit="width"></lr-image-viewer>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-inline-size:320px"><lr-image-viewer src=${SRC} name="Mountain river"></lr-image-viewer></div>`,
};

export const ThemedActiveStates: Story = {
  name: 'Themed active states (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-image-viewer-annotate-active-bg`/`--lr-image-viewer-annotate-active-border` retint the pressed annotation toggle and `--lr-image-viewer-highlight-active-color` retints the outline on the highlight matching `active-highlight-id` — independently of the per-tone highlight borders. None is declared on `:host`, so a value set on any ancestor is never shadowed. The toggle carries its own glyph in `--lr-color-text`, so keep 4.5:1 against the background you choose.',
      },
    },
  },
  render: () => html`
    <lr-image-viewer
      style="--lr-image-viewer-annotate-active-bg: ${storyColor('warningQuiet')}; --lr-image-viewer-annotate-active-border: ${storyColor('warning')}; --lr-image-viewer-highlight-active-color: ${storyColor('success')};"
      src=${SRC}
      name="Mountain river"
      annotatable
      .highlights=${[
        { id: 'h1', anchor: { kind: 'region', rect: { x: 12, y: 18, width: 28, height: 26 } }, label: 'Active' },
        { id: 'h2', anchor: { kind: 'region', rect: { x: 55, y: 50, width: 22, height: 20 } }, label: 'Resting' },
      ]}
      active-highlight-id="h1"
    ></lr-image-viewer>
  `,
};
