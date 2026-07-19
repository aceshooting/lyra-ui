import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './page-rail.js';
import '../pdf-viewer/pdf-viewer.js';
import '../../layout/split/split.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

const meta: Meta = {
  title: 'DocumentViewer/PageRail',
  component: 'lr-page-rail',
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'A virtualized vertical thumbnail rail for page-addressed documents.' } },
  },
};
export default meta;
type Story = StoryObj;

const SAMPLE_PDF_URL = '/fixtures/sample.pdf';
const HIGHLIGHTS: LyraHighlight[] = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 }, tone: 'accent' }];

export const Mediated: Story = {
  render: () => html`<lr-page-rail page-count="8" page="3" style="width:96px;"></lr-page-rail>`,
};

export const WiredToPdfViewer: Story = {
  render: () => html`
    <lr-split style="height:320px;">
      <lr-page-rail for="rail-doc" .highlights=${HIGHLIGHTS} style="width:96px;"></lr-page-rail>
      <lr-pdf-viewer id="rail-doc" src=${SAMPLE_PDF_URL} name="sample.pdf" .highlights=${HIGHLIGHTS}></lr-pdf-viewer>
    </lr-split>
  `,
};

export const Narrow320: Story = {
  render: () => html`<lr-page-rail style="max-width: 320px;" page-count="6" page="1"></lr-page-rail>`,
};
