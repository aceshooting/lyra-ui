import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './document-viewer.js';
import { registerDocumentRenderer } from './registry.js';

const meta: Meta = {
  title: 'DocumentViewer',
  component: 'lyra-document-viewer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A dialog-hosted, format-dispatching document viewer. Registered MIME types render through the pluggable registry; other formats fall back to lyra-document-preview.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const SAMPLE_TEXT = `{
  "id": "req_8f21",
  "status": "ok"
}`;
const textDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(SAMPLE_TEXT)}`;

export const FallbackToDocumentPreview: Story = {
  name: 'No renderer registered — falls back to lyra-document-preview',
  render: () => html`
    <lyra-document-viewer
      open
      name="response.json"
      mime-type="application/json"
      src=${textDataUrl}
    ></lyra-document-viewer>
  `,
};

registerDocumentRenderer('application/x-lyra-demo', {
  render: (file) => html`<p>Custom registered renderer for <strong>${file.name}</strong></p>`,
});

export const RegisteredRenderer: Story = {
  name: 'A registerDocumentRenderer() entry',
  render: () => html`
    <lyra-document-viewer
      open
      name="demo.lyra"
      mime-type="application/x-lyra-demo"
      src="https://example.com/demo.lyra"
    ></lyra-document-viewer>
  `,
};

export const ClosedByDefault: Story = {
  name: 'open unset — renders nothing visible',
  render: () => html`<lyra-document-viewer name="report.pdf" mime-type="application/pdf"></lyra-document-viewer>`,
};
