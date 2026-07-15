import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './pdf-viewer.js';

const meta: Meta = {
  title: 'DocumentViewer/PdfViewer',
  component: 'lyra-pdf-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Renders PDF pages with optional pdfjs-dist, pagination, zoom, a selectable text layer, and virtualized canvases.' } } },
};
export default meta;
type Story = StoryObj;

const SAMPLE_PDF_URL = '/fixtures/sample.pdf';

export const Default: Story = { render: () => html`<lyra-pdf-viewer src=${SAMPLE_PDF_URL} name="sample.pdf"></lyra-pdf-viewer>` };
export const NoSrc: Story = { render: () => html`<lyra-pdf-viewer></lyra-pdf-viewer>` };
export const ZoomedIn: Story = { render: () => html`<lyra-pdf-viewer src=${SAMPLE_PDF_URL} name="sample.pdf" zoom="2"></lyra-pdf-viewer>` };
