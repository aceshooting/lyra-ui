import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "./document-viewer.js";
import { createDocumentRendererRegistry } from "./registry.js";
import type { LyraDocumentRendererPayload } from "./registry.js";
import "../pdf-viewer/pdf-viewer.js";
import "../../media/av-player/av-player.js";
import "../../retrieval/citation-badge/citation-badge.js";
import type { CitationActivateDetail } from "../../retrieval/citation-badge/citation-badge.class.js";
import type { AnchorResultDetail } from "./anchors.js";

const meta: Meta = {
  title: "DocumentViewer",
  component: "lr-document-viewer",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A dialog-hosted, format-dispatching document viewer. Each instance owns an immutable built-in registry snapshot and may receive an explicit registry; an opt-in readonly discriminated payload carries renderer-specific metadata while the legacy scalar file properties remain the default. Highlight IDs are normalized trimmed, nonempty, and first-wins before renderer adaptation. Other formats fall back to lr-document-preview. A host `aria-label` names the nested dialog by attribute presence, including an explicitly empty value, without suppressing the visible `name` heading.",
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
const textDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(
  SAMPLE_TEXT
)}`;

export const FallbackToDocumentPreview: Story = {
  name: "No renderer registered — falls back to lr-document-preview",
  render: (_args, context) => html`
    <lr-document-viewer
      .open=${context.viewMode !== "docs"}
      name="response.json"
      mime-type="application/json"
      src=${textDataUrl}
    ></lr-document-viewer>
  `,
};

export const FallbackRenderError: Story = {
  name: 'Fallback render error event',
  parameters: {
    docs: {
      description: {
        story:
          'The fallback preview\'s composed `lr-render-error` is part of the document-viewer contract and reaches the shell unchanged.',
      },
    },
  },
  render: (_args, context) => {
    const onError = (event: Event) => {
      const viewer = event.currentTarget as HTMLElement;
      const output = viewer.nextElementSibling;
      if (output) output.textContent = 'lr-render-error received';
    };
    return html`
      <div>
        <lr-document-viewer
          .open=${context.viewMode !== 'docs'}
          name="unsafe.txt"
          mime-type="text/plain"
          src="javascript:alert(1)"
          @lr-render-error=${onError}
        ></lr-document-viewer>
        <output aria-live="polite"></output>
      </div>
    `;
  },
};

const demoRegistry = createDocumentRendererRegistry([
  [
    "application/x-lr-demo",
    {
      render: (file) =>
        html`<p>
          Custom registered renderer for <strong>${file.name}</strong>
        </p>`,
    },
  ],
]);

export const RegisteredRenderer: Story = {
  name: "An instance registry entry",
  render: (_args, context) => html`
    <lr-document-viewer
      .open=${context.viewMode !== "docs"}
      name="demo.lyra"
      mime-type="application/x-lr-demo"
      src="https://example.com/demo.lyra"
      .registry=${demoRegistry}
    ></lr-document-viewer>
  `,
};

const AV_PAYLOAD: LyraDocumentRendererPayload = {
  kind: "av",
  file: {
    name: "Searchable episode.mp4",
    mimeType: "video/mp4",
    src: "/fixtures/sample-video.mp4",
  },
  cues: [
    {
      id: "intro",
      start: 0,
      end: 1,
      speaker: "Host",
      text: "Welcome to the searchable transcript.",
    },
    {
      id: "topic",
      start: 1,
      end: 2,
      speaker: "Guest",
      text: "Renderer capabilities follow retained cue data.",
    },
  ],
  tracks: [
    {
      src: "data:text/vtt;charset=utf-8,WEBVTT%0A%0A00%3A00.000%20--%3E%2000%3A01.000%0AWelcome",
      kind: "captions",
      srclang: "en",
      label: "English",
      default: true,
    },
  ],
};

export const AudioVideoPayload: Story = {
  name: "Renderer-specific AV payload",
  parameters: {
    docs: {
      description: {
        story:
          "The discriminated payload is authoritative over the legacy scalar file properties. Its bounded cue snapshot enables the AV renderer's search capability; the native caption-track metadata is forwarded with the same immutable assignment semantics.",
      },
    },
  },
  render: (_args, context) => html`
    <lr-document-viewer
      .open=${context.viewMode !== "docs"}
      name="ignored.txt"
      mime-type="text/plain"
      src="/ignored.txt"
      .payload=${AV_PAYLOAD}
    ></lr-document-viewer>
  `,
};

export const ClosedByDefault: Story = {
  name: "open unset — renders nothing visible",
  render: () =>
    html`<lr-document-viewer
      name="report.pdf"
      mime-type="application/pdf"
    ></lr-document-viewer>`,
};

export const InheritedBodyHeight: Story = {
  name: "Inherited body-height hook",
  parameters: {
    docs: {
      description: {
        story:
          "`--lr-document-viewer-max-height` is set on the wrapper and inherits into the viewer; a direct value on the viewer would take precedence.",
      },
    },
  },
  render: (_args, context) => html`
    <div style="--lr-document-viewer-max-height: var(--lr-size-12rem);">
      <lr-document-viewer
        .open=${context.viewMode !== "docs"}
        name="response.json"
        mime-type="application/json"
        src=${textDataUrl}
      ></lr-document-viewer>
    </div>
  `,
};

/** Baseline narrow-allocation coverage for the open shell with long document metadata. */
export const Narrow320: Story = {
  render: (_args, context) => html`
    <div style="max-inline-size:320px">
      <lr-document-viewer
        style="--lr-dialog-width:320px;--lr-dialog-max-width:320px"
        .open=${context.viewMode !== "docs"}
        name="international-quarterly-analytical-engine-research-report-with-a-very-long-name.json"
        mime-type="application/json"
        src=${textDataUrl}
      ></lr-document-viewer>
    </div>
  `,
};

const SAMPLE_PDF_URL = "/fixtures/sample.pdf";

interface CitationSource {
  name: string;
  mimeType: string;
  src: string;
  highlight: {
    id: string;
    tone: "accent";
    anchor: { kind: "text-quote"; quote: string; page: number };
  };
}

// The demo quote ("Hello, world!") matches the shipped sample.pdf fixture's real (one-page) text --
// the README recipe shows the same wiring with an illustrative multi-page quote instead, since a
// realistic "revenue grew 12%" narrative needs more than one line of fixture content to demonstrate.
const CITATION_SOURCES: Record<string, CitationSource> = {
  "doc-1": {
    name: "sample.pdf",
    mimeType: "application/pdf",
    src: SAMPLE_PDF_URL,
    highlight: {
      id: "cite-1",
      tone: "accent",
      anchor: { kind: "text-quote", quote: "Hello, world!", page: 1 },
    },
  },
};

export const CitationToDocument: Story = {
  name: "citation-to-document — end-to-end recipe",
  parameters: {
    docs: {
      description: {
        story:
          "Click the citation badge: document-viewer opens the pdf at the cited passage and flashes it.",
      },
    },
  },
  render: () => {
    const onActivate = (e: Event) => {
      const detail = (e as CustomEvent<CitationActivateDetail>).detail;
      const source = CITATION_SOURCES[detail.sourceId];
      if (!source) return;
      const dv = document.getElementById("citation-recipe-dv") as
        | (HTMLElement & {
            name: string;
            mimeType: string;
            src: string;
            highlights: unknown[];
            anchor: unknown;
            open: boolean;
          })
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
      if (!detail.found) console.warn("citation passage not found");
    };
    return html`
      <p>
        This is a demo document<lr-citation-badge
          index="1"
          source-id="doc-1"
          @lr-citation-activate=${onActivate}
        ></lr-citation-badge
        >.
      </p>
      <lr-document-viewer
        id="citation-recipe-dv"
        @lr-anchor-result=${onAnchorResult}
      ></lr-document-viewer>
    `;
  },
};
