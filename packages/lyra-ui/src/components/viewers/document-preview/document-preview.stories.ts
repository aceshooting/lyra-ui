import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './document-preview.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'DocumentPreview',
  component: 'lr-document-preview',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A format-dispatching document/attachment viewer with a minimal built-in dispatch (`text/*`/`application/json` → plain `<pre>`, `image/*` → contained `<img>`, everything else → a generic "can\'t preview this" download fallback) plus an `unsupported` slot escape hatch for PDF/office-doc/etc. renderers this component intentionally doesn\'t bundle. `status="converting"` visualizes a host-owned, host-polled async server-side conversion — this component never fetches or polls a conversion API itself.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

// A same-origin data: URL stands in for a real backend endpoint so these
// stories work with zero server setup; <lr-document-preview> only cares
// that `src` is fetchable, not where it's hosted.
const SAMPLE_TEXT = `{
  "id": "req_8f21",
  "status": "ok",
  "rows": 128
}`;
const textDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(SAMPLE_TEXT)}`;

const PNG_1X1_RED_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const imageDataUrl = `data:image/png;base64,${PNG_1X1_RED_BASE64}`;

export const TextPreview: Story = {
  name: 'text/plain — inline <pre>',
  render: () => html`
    <lr-document-preview
      style="max-width: 28rem;"
      src=${textDataUrl}
      mime-type="application/json"
      filename="response.json"
    ></lr-document-preview>
  `,
};

export const ImagePreview: Story = {
  name: 'image/* — contained <img>',
  render: () => html`
    <lr-document-preview
      style="max-width: 20rem;"
      src=${imageDataUrl}
      mime-type="image/png"
      filename="swatch.png"
      alt="A solid red status swatch"
    ></lr-document-preview>
  `,
};

export const DecorativeImagePreview: Story = {
  name: 'image/* — decorative image',
  render: () => html`
    <lr-document-preview
      style="max-width: 20rem;"
      src=${imageDataUrl}
      mime-type="image/png"
      filename="decorative-divider.png"
      alt=""
    ></lr-document-preview>
  `,
};

export const GenericDownloadFallback: Story = {
  name: 'Unsupported format — generic download fallback',
  render: () => html`
    <lr-document-preview
      style="max-width: 24rem;"
      src="https://example.com/files/quarterly-report.pdf"
      mime-type="application/pdf"
      filename="quarterly-report.pdf"
    ></lr-document-preview>
  `,
};

export const UnsupportedSlotEscapeHatch: Story = {
  name: 'unsupported slot — custom PDF viewer stand-in',
  parameters: {
    docs: {
      description: {
        story:
          'When the `unsupported` slot is populated, it renders instead of the generic download fallback — this is how a host plugs in a real PDF.js viewer, an office-doc renderer, or a `<lr-code-block>` for a format this component doesn\'t natively preview.',
      },
    },
  },
  render: () => html`
    <lr-document-preview
      style="max-width: 24rem;"
      src="https://example.com/files/quarterly-report.pdf"
      mime-type="application/pdf"
      filename="quarterly-report.pdf"
    >
      <div
        slot="unsupported"
        style="padding: 2rem; text-align: center; color: var(--lr-color-text-quiet); border: 1px dashed var(--lr-color-border); border-radius: 0.375rem; margin: 0.75rem;"
      >
        (stand-in for a real PDF.js/office-doc renderer)
      </div>
    </lr-document-preview>
  `,
};

export const ConvertingIndeterminate: Story = {
  name: 'status="converting" — indeterminate (no progress yet)',
  render: () => html`
    <lr-document-preview
      style="max-width: 24rem;"
      status="converting"
      filename="slides.pptx"
    ></lr-document-preview>
  `,
};

export const ConvertingWithProgress: Story = {
  name: 'status="converting" — determinate progress',
  render: () => html`
    <lr-document-preview
      style="max-width: 24rem;"
      status="converting"
      progress="63"
      filename="slides.pptx"
    ></lr-document-preview>
  `,
};

export const ErrorState: Story = {
  name: 'status="error"',
  render: () => html`
    <lr-document-preview
      style="max-width: 24rem;"
      status="error"
      error-message="Conversion failed: the source file appears to be corrupted."
      filename="slides.pptx"
    ></lr-document-preview>
  `,
};

export const ConversionLifecycle: Story = {
  name: 'Simulated conversion lifecycle (host-driven polling)',
  parameters: {
    docs: {
      description: {
        story:
          'This component never polls a backend itself — a host does that and updates `status`/`progress`/`src` as the conversion proceeds. This story fakes that host-side loop with a plain `setInterval` purely to demonstrate the visual transitions: converting (indeterminate) → converting (progress) → ready (generic fallback, since the "converted" artifact here is still a PDF).',
      },
    },
  },
  render: () => {
    const el = document.createElement('lr-document-preview');
    el.setAttribute('style', 'max-width: 24rem;');
    el.filename = 'slides.pptx';
    el.status = 'converting';

    let progress = 0;
    const timer = setInterval(() => {
      progress += 20;
      if (progress >= 100) {
        clearInterval(timer);
        el.status = 'ready';
        el.mimeType = 'application/pdf';
        el.src = 'https://example.com/files/slides-converted.pdf';
        el.filename = 'slides.pdf';
        el.progress = undefined;
      } else {
        el.progress = progress;
      }
    }, 900);

    return el;
  },
};

export const NoFilename: Story = {
  name: 'No filename set — header hidden',
  render: () => html`
    <lr-document-preview
      style="max-width: 24rem;"
      src=${textDataUrl}
      mime-type="text/plain"
    ></lr-document-preview>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lr-document-preview
        style="max-width: 24rem;"
        src="https://example.com/files/quarterly-report.pdf"
        mime-type="application/pdf"
        filename="quarterly-report.pdf"
        @lr-download=${(e: CustomEvent<{ src: string; filename: string }>) => {
          const out = document.getElementById('document-preview-log');
          if (out) out.textContent = `lr-download: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-document-preview>
      <p id="document-preview-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};

export const ThemedActiveRegion: Story = {
  name: 'Themed active region (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-document-preview-active-border` recolors only the region highlight matching `active-highlight-id` over an image-format preview; the resting highlights keep `--lr-color-brand`. Set it on the element or any ancestor — it is not declared on `:host`, so an ancestor value is never shadowed.',
      },
    },
  },
  render: () => html`
    <lr-document-preview
      style="--lr-document-preview-active-border: ${storyColor('success')};"
      mime-type="image/png"
      src="https://picsum.photos/id/1015/900/600"
      filename="river.png"
      .highlights=${[
        { id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 15, width: 30, height: 30 } }, label: 'Active region' },
        { id: 'h2', anchor: { kind: 'region', rect: { x: 55, y: 50, width: 25, height: 25 } }, label: 'Resting region' },
      ]}
      active-highlight-id="h1"
    ></lr-document-preview>
  `,
};
