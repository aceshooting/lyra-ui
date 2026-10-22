import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './model-viewer.js';
import '../document-viewer/document-viewer.js';

const meta: Meta = {
  title: 'DocumentViewer/ModelViewer',
  component: 'lr-model-viewer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A bounded static model preview using the optional `@aceshooting/lyra-3d` model engine. A persistent text alternative and a guarded source download remain available if WebGL or the companion is unavailable.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const triangle = `data:text/plain,${encodeURIComponent('v -1 -1 0\nv 1 -1 0\nv 0 1 0\nf 1 2 3\n')}`;
const cloud = `data:text/plain,${encodeURIComponent('0 0 0 255 0 0\n1 0 0 0 255 0\n0 1 0 0 0 255\n')}`;

export const Default: Story = {
  render: () => html`<lr-model-viewer src=${triangle} format="obj" name="Triangle" alt="One flat triangular face"></lr-model-viewer>`,
};
export const PointCloud: Story = {
  render: () => html`<lr-model-viewer src=${cloud} format="xyz" name="Three points" alt="Red, green and blue points forming a right triangle"></lr-model-viewer>`,
};
export const AuthoredCamera: Story = {
  name: 'Authored camera',
  render: () => html`<lr-model-viewer
    src=${triangle}
    format="obj"
    name="Triangle"
    alt="One flat triangular face"
    .camera=${{ yaw: 0.6, pitch: 0.3, distance: 6, target: { x: 0, y: 0, z: 0 } }}
  ></lr-model-viewer>`,
};
export const Empty: Story = { render: () => html`<lr-model-viewer></lr-model-viewer>` };
export const Unsupported: Story = {
  render: () => html`<lr-model-viewer src="example.unsupported" name="Unsupported model" alt="The original file is available for download"></lr-model-viewer>`,
};
export const Narrow320: Story = {
  name: 'Narrow 320px',
  render: () => html`<div style="inline-size:320px"><lr-model-viewer src=${triangle} format="obj" name="A long descriptive title for a simple three-dimensional model" alt="One flat triangular face"></lr-model-viewer></div>`,
};
export const Rtl: Story = {
  render: () => html`<div dir="rtl"><lr-model-viewer src=${triangle} format="obj" name="Triangle" alt="One flat triangular face"></lr-model-viewer></div>`,
};
export const OpenedFromADocumentAttachment: Story = {
  name: 'Opened from a document attachment',
  render: (_args, context) => html`<lr-document-viewer
    .open=${context.viewMode !== 'docs'}
    .payload=${{ kind: 'model', file: { name: 'triangle.obj', mimeType: 'model/obj', src: triangle, alt: 'One flat triangular face' } }}
  ></lr-document-viewer>`,
};
