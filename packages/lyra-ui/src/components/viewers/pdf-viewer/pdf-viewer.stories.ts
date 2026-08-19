import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './pdf-viewer.js';
import '../../../../../../.storybook/pdfjs-worker.js';

const meta: Meta = {
  title: 'DocumentViewer/PdfViewer',
  component: 'lr-pdf-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Renders PDF pages with optional pdfjs-dist, pagination, zoom, a selectable text layer, and virtualized canvases.' } } },
};
export default meta;
type Story = StoryObj;

const SAMPLE_PDF_URL = '/fixtures/sample.pdf';

export const Default: Story = { render: () => html`<lr-pdf-viewer src=${SAMPLE_PDF_URL} name="sample.pdf"></lr-pdf-viewer>` };
export const NoSrc: Story = { render: () => html`<lr-pdf-viewer></lr-pdf-viewer>` };
export const ZoomedIn: Story = { render: () => html`<lr-pdf-viewer src=${SAMPLE_PDF_URL} name="sample.pdf" zoom="2"></lr-pdf-viewer>` };

// PDF.js opens nothing until GlobalWorkerOptions.workerSrc is set, and a bare `pdfjs-dist/build/...`
// specifier cannot be resolved from inside this library at runtime -- so a bundled app points
// `worker-src` at the worker chunk its own bundler emitted. The import above already configured that
// process-wide singleton the other way, by setting GlobalWorkerOptions directly at startup; because
// an already-configured worker is never overwritten, that one keeps winning here and this story
// renders exactly like Default. Both routes are supported, and this precedence is the documented
// behaviour rather than an artifact of the story.
export const CustomWorkerSrc: Story = {
  render: () => html`<lr-pdf-viewer src=${SAMPLE_PDF_URL} name="sample.pdf" worker-src="/pdf.worker.min.mjs"></lr-pdf-viewer>`,
};

// The toolbar (previous/next page, page-indicator text, zoom-out/zoom-in, zoom-indicator text --
// six items in a `flex-wrap: wrap` row) has no coverage at a narrow allocation otherwise.
export const Narrow320: Story = {
  render: () => html`<div style="max-inline-size:320px"><lr-pdf-viewer src=${SAMPLE_PDF_URL} name="sample.pdf"></lr-pdf-viewer></div>`,
};
