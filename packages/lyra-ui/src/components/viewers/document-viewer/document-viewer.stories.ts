import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './document-viewer.js';
import { registerDocumentRenderer } from './registry.js';
import '../pdf-viewer/pdf-viewer.js';
import '../../retrieval/citation-badge/citation-badge.js';
import type { CitationActivateDetail } from '../../retrieval/citation-badge/citation-badge.class.js';
import type { AnchorResultDetail } from './anchors.js';

const meta: Meta = {
  title: 'DocumentViewer',
  component: 'lr-document-viewer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A dialog-hosted, format-dispatching document viewer. Registered MIME types render through the pluggable registry; other formats fall back to lr-document-preview.',
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
  name: 'No renderer registered — falls back to lr-document-preview',
  render: (_args, context) => html`
    <lr-document-viewer
      .open=${context.viewMode !== 'docs'}
      name="response.json"
      mime-type="application/json"
      src=${textDataUrl}
    ></lr-document-viewer>
  `,
};

registerDocumentRenderer('application/x-lr-demo', {
  render: (file) => html`<p>Custom registered renderer for <strong>${file.name}</strong></p>`,
});

export const RegisteredRenderer: Story = {
  name: 'A registerDocumentRenderer() entry',
  render: (_args, context) => html`
    <lr-document-viewer
      .open=${context.viewMode !== 'docs'}
      name="demo.lyra"
      mime-type="application/x-lr-demo"
      src="https://example.com/demo.lyra"
    ></lr-document-viewer>
  `,
};

export const ClosedByDefault: Story = {
  name: 'open unset — renders nothing visible',
  render: () => html`<lr-document-viewer name="report.pdf" mime-type="application/pdf"></lr-document-viewer>`,
};

/** Baseline narrow-allocation coverage for the open shell with long document metadata. */
export const Narrow320: Story = {
  render: (_args, context) => html`
    <div style="max-inline-size:320px">
      <lr-document-viewer
        style="--lr-dialog-width:320px;--lr-dialog-max-width:320px"
        .open=${context.viewMode !== 'docs'}
        name="international-quarterly-analytical-engine-research-report-with-a-very-long-name.json"
        mime-type="application/json"
        src=${textDataUrl}
      ></lr-document-viewer>
    </div>
  `,
};

const SAMPLE_PDF_URL = '/fixtures/sample.pdf';

interface CitationSource {
  name: string;
  mimeType: string;
  src: string;
  highlight: { id: string; tone: 'accent'; anchor: { kind: 'text-quote'; quote: string; page: number } };
}

// The demo quote ("Hello, world!") matches the shipped sample.pdf fixture's real (one-page) text --
// the README recipe shows the same wiring with an illustrative multi-page quote instead, since a
// realistic "revenue grew 12%" narrative needs more than one line of fixture content to demonstrate.
const CITATION_SOURCES: Record<string, CitationSource> = {
  'doc-1': {
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    src: SAMPLE_PDF_URL,
    highlight: { id: 'cite-1', tone: 'accent', anchor: { kind: 'text-quote', quote: 'Hello, world!', page: 1 } },
  },
};

export const CitationToDocument: Story = {
  name: 'citation-to-document — end-to-end recipe',
  parameters: {
    docs: {
      description: {
        story:
          'Click the citation badge: document-viewer opens the pdf at the cited passage and flashes it.',
      },
    },
  },
  render: () => {
    const onActivate = (e: Event) => {
      const detail = (e as CustomEvent<CitationActivateDetail>).detail;
      const source = CITATION_SOURCES[detail.sourceId];
      if (!source) return;
      const dv = document.getElementById('citation-recipe-dv') as
        | (HTMLElement & { name: string; mimeType: string; src: string; highlights: unknown[]; anchor: unknown; open: boolean })
        | null;
      if (!dv) return;
      dv.name = source.name;
      dv.mimeType = source.mimeType;
      dv.src = source.src;
      dv.highlights = [source.highlight];
      dv.anchor = source.highlight.id;
      dv.open = true;
    };
    const onAnchorResult = (e: Event) => {
      const detail = (e as CustomEvent<AnchorResultDetail>).detail;
      if (!detail.found) console.warn('citation passage not found');
    };
    return html`
      <p>
        This is a demo document<lr-citation-badge
          index="1"
          source-id="doc-1"
          @lr-citation-activate=${onActivate}
        ></lr-citation-badge>.
      </p>
      <lr-document-viewer id="citation-recipe-dv" @lr-anchor-result=${onAnchorResult}></lr-document-viewer>
    `;
  },
};
