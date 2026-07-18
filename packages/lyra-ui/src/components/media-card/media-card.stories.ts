import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './media-card.js';
// Side-effect import of an already-landed component, purely for the
// "inside a rendered message" demo story below (this component isn't in
// the barrel yet, so both are imported directly by relative path).
import '../chat-message/chat-message.js';

const meta: Meta = {
  title: 'MediaCard',
  component: 'lr-media-card',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A lightweight inline preview for one already-sent, already-available attachment inside a rendered chat message — plugs into `<lr-chat-message>`\'s `attachments` slot or a markdown/message renderer. `kind` dispatches to an `<img>`, a `<video controls>`, or a generic file chip; leave it unset to auto-detect from `mime-type`. `src` is always re-validated against a safe-scheme allowlist before it reaches an `<img>`/`<video>` `src` or an `<a href>` — see the component\'s own class doc for the full `data:` judgement call.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const SAMPLE_IMAGE = 'https://picsum.photos/seed/lr-media-card/640/400';
const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export const Image: Story = {
  render: () => html`
    <lr-media-card
      src=${SAMPLE_IMAGE}
      kind="image"
      filename="roof-photo.jpg"
      alt="Aerial photo of a rooftop solar installation"
    ></lr-media-card>
  `,
};

export const AccessibleActionLabel: Story = {
  name: 'Accessible action-name override',
  parameters: {
    docs: {
      description: {
        story:
          'The host `aria-label` names the internal actionable element directly. It overrides the generated open action without replacing the image alt text.',
      },
    },
  },
  render: () => html`
    <lr-media-card
      aria-label="Open rooftop photo in the project lightbox"
      src=${SAMPLE_IMAGE}
      kind="image"
      filename="roof-photo.jpg"
      alt="Aerial photo of a rooftop solar installation"
    ></lr-media-card>
  `,
};

export const Video: Story = {
  render: () => html`
    <lr-media-card src=${SAMPLE_VIDEO} kind="video" filename="walkthrough.mp4"></lr-media-card>
  `,
};

export const FileChip: Story = {
  name: 'File (with a safe download link)',
  render: () => html`
    <lr-media-card
      src="https://example.com/reports/quarterly-summary.pdf"
      kind="file"
      filename="quarterly-summary.pdf"
      mime-type="application/pdf"
    ></lr-media-card>
  `,
};

export const AutoDetectFromMimeType: Story = {
  name: 'kind unset — auto-detected from mime-type',
  parameters: {
    docs: {
      description: {
        story:
          'Neither card below sets `kind` — the first auto-detects `image` from `mime-type="image/jpeg"`, the second falls through to the generic file chip because `mime-type="application/zip"` matches neither `image/*` nor `video/*`.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-start;">
      <lr-media-card src=${SAMPLE_IMAGE} mime-type="image/jpeg" filename="roof-photo.jpg"></lr-media-card>
      <lr-media-card
        src="https://example.com/exports/dataset.zip"
        mime-type="application/zip"
        filename="dataset.zip"
      ></lr-media-card>
    </div>
  `,
};

export const UnsafeUrlFallback: Story = {
  name: 'Unsafe scheme — falls back to a plain, inert preview',
  parameters: {
    docs: {
      description: {
        story:
          'A `javascript:` (or any other non-allowlisted) scheme is never assigned to `src`/`href` — the card instead falls back to a plain, unclickable file chip. Compare to `FileChip` above, which has an identical filename but a real `https:` URL and so renders a clickable download link.',
      },
    },
  },
  render: () => html`
    <lr-media-card
      src="javascript:alert(1)"
      kind="image"
      filename="suspicious-payload.jpg"
    ></lr-media-card>
  `,
};

export const DataUriImage: Story = {
  name: 'data: URI — allowed as an image src, not as a download link',
  parameters: {
    docs: {
      description: {
        story:
          'A `data:` URI is allowed as an `<img>`/`<video>` `src` (a browser never executes script from a media element\'s source) but intentionally excluded from the file chip\'s `<a href>` allowlist. The first card below renders normally as an image; the second (`kind="file"` with the same `data:` src) shows the icon/filename with no clickable link, since a `data:` URI is never a safe *link* target.',
      },
    },
  },
  render: () => {
    const dataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    return html`
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-start;">
        <lr-media-card src=${dataUri} kind="image" filename="pixel.png"></lr-media-card>
        <lr-media-card src=${dataUri} kind="file" filename="pixel.png"></lr-media-card>
      </div>
    `;
  },
};

export const InsideAChatMessage: Story = {
  name: 'Inside a rendered chat message',
  render: () => html`
    <lr-chat-message data-role="assistant" style="max-width: 32rem;">
      Here's the site photo and the summary report you asked for.
      <lr-media-card
        slot="attachments"
        src=${SAMPLE_IMAGE}
        kind="image"
        filename="site-photo.jpg"
        alt="Photo of the installation site"
      ></lr-media-card>
      <lr-media-card
        slot="attachments"
        src="https://example.com/reports/summary.pdf"
        kind="file"
        filename="summary.pdf"
        mime-type="application/pdf"
      ></lr-media-card>
    </lr-chat-message>
  `,
};

export const OpenEvent: Story = {
  name: 'lr-open event',
  render: () => html`
    <div>
      <lr-media-card
        src=${SAMPLE_IMAGE}
        kind="image"
        filename="roof-photo.jpg"
        @lr-open=${(e: CustomEvent<{ src: string; filename: string }>) => {
          const out = document.getElementById('media-card-log');
          if (out) out.textContent = `lr-open: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-media-card>
      <p id="media-card-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};
