import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './media-card.js';
import type { LyraMediaCardKind, LyraMediaCardOpenDetail } from './media-card.js';
// Side-effect import of an already-landed component, purely for the
// "inside a rendered message" demo story below (this component isn't in
// the barrel yet, so both are imported directly by relative path).
import '../../conversation/chat-message/chat-message.js';

const meta: Meta = {
  title: 'MediaCard',
  component: 'lr-media-card',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Removing mime-type restores the generic file fallback. A property-only accessibleLabel reactively names the action while host labels retain separate ownership. A lightweight inline preview for one already-sent, already-available attachment inside a rendered chat message — plugs into `<lr-chat-message>`\'s `attachments` slot or a markdown/message renderer. `kind` dispatches to an `<img>`, a `<video controls>`, or a generic file chip; leave it unset to auto-detect from `mime-type`. `src` is always re-validated against a safe-scheme allowlist before it reaches an `<img>`/`<video>` `src` or an `<a href>` — see the component\'s own class doc for the full `data:` judgement call. Host `focus()`, `blur()`, and `click()` forward to the image button, video open button, or safe-file anchor; focus and blur are relayed once from that action as bubbling, composed native events. An unsafe inert file preview makes the methods no-ops.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const SAMPLE_IMAGE = 'https://picsum.photos/seed/lr-media-card/640/400';
const IMAGE_KIND: LyraMediaCardKind = 'image';
// A local fixture (not an external URL like SAMPLE_IMAGE above) -- see .storybook/main.js's
// staticDirs entry for why.
const SAMPLE_VIDEO = '/fixtures/sample-video.mp4';
const LONG_LTR_FILENAME = 'quarterly-rooftop-installation-verification-and-compliance-summary-final-revision.pdf';
const LONG_RTL_FILENAME = 'ملخص-التحقق-والامتثال-لتركيب-الألواح-الشمسية-النهائي-للمراجعة.pdf';

export const Image: Story = {
  render: () => html`
    <lr-media-card
      src=${SAMPLE_IMAGE}
      .kind=${IMAGE_KIND}
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
          'The host `aria-label` names the card as a whole; its nested button keeps a purpose-specific generated open action so one label is not duplicated across semantic owners.',
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

export const DecorativeImage: Story = {
  name: 'Decorative image (explicit empty alt)',
  parameters: {
    docs: {
      description: {
        story:
          'An explicit `alt=""` reaches the rendered `<img>` verbatim, marking a purely decorative attachment as such. Omitting `alt` instead falls back to `filename`, then to a localized generic description — the two are distinguishable because `alt` is optional rather than empty-by-default.',
      },
    },
  },
  render: () => html`
    <lr-media-card src=${SAMPLE_IMAGE} kind="image" filename="divider.png" alt=""></lr-media-card>
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

export const ThemedPressedState: Story = {
  name: 'Themed pressed state (CSS properties)',
  parameters: {
    docs: {
      description: {
        story:
          'Hold either action to see an ancestor retint only its pressed border and fill with `--lr-media-card-active-border-color` and `--lr-media-card-active-bg`. The properties are intentionally inherited, so a chat transcript or attachment list can theme all of its cards without changing unrelated shared tokens.',
      },
    },
  },
  render: () => html`
    <div
      style="
        display: flex;
        flex-wrap: wrap;
        gap: var(--lr-space-s);
        --lr-media-card-active-border-color: var(--lr-color-success);
        --lr-media-card-active-bg: var(--lr-color-success-quiet);
      "
    >
      <lr-media-card
        src=${SAMPLE_IMAGE}
        kind="image"
        filename="roof-photo.jpg"
        alt="Aerial photo of a rooftop solar installation"
      ></lr-media-card>
      <lr-media-card
        src="https://example.com/reports/quarterly-summary.pdf"
        kind="file"
        filename="quarterly-summary.pdf"
      ></lr-media-card>
    </div>
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
    <lr-chat-message message-role="assistant" style="max-width: 32rem;">
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

export const Narrow320ChatAttachments: Story = {
  name: 'Narrow 320px chat attachments (LTR and RTL)',
  parameters: {
    docs: {
      description: {
        story:
          'Both exact 320px chat allocations keep a long file name ellipsized within its chip and the local video preview’s full-size open action within the video frame. The Arabic composition verifies the same bounds under RTL.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l);">
      <div dir="ltr" lang="en" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-chat-message message-role="assistant">
          Here is the complete installation report and the walkthrough recording for the rooftop team.
          <lr-media-card
            slot="attachments"
            src="https://example.com/reports/${LONG_LTR_FILENAME}"
            kind="file"
            filename=${LONG_LTR_FILENAME}
          ></lr-media-card>
          <lr-media-card
            slot="attachments"
            src=${SAMPLE_VIDEO}
            kind="video"
            filename="rooftop-walkthrough.mp4"
          ></lr-media-card>
        </lr-chat-message>
      </div>
      <div dir="rtl" lang="ar" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-chat-message message-role="assistant">
          إليك تقرير التركيب الكامل وتسجيل الجولة لفريق السطح.
          <lr-media-card
            slot="attachments"
            src="https://example.com/reports/${LONG_RTL_FILENAME}"
            kind="file"
            filename=${LONG_RTL_FILENAME}
          ></lr-media-card>
          <lr-media-card
            slot="attachments"
            src=${SAMPLE_VIDEO}
            kind="video"
            filename="جولة-السطح.mp4"
          ></lr-media-card>
        </lr-chat-message>
      </div>
    </div>
  `,
};

export const OpenEvent: Story = {
  name: 'lr-media-open event',
  render: () => html`
    <div>
      <lr-media-card
        src=${SAMPLE_IMAGE}
        kind="image"
        filename="roof-photo.jpg"
        @lr-media-open=${(e: CustomEvent<LyraMediaCardOpenDetail>) => {
          const out = document.getElementById('media-card-log');
          if (out) out.textContent = `lr-media-open: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-media-card>
      <p id="media-card-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};

export const BeforeDownloadEvent: Story = {
  name: 'lr-before-media-download veto',
  render: () => html`
    <div>
      <lr-media-card
        src="https://example.com/reports/summary.pdf"
        kind="file"
        filename="summary.pdf"
        @lr-before-media-download=${(event: CustomEvent<LyraMediaCardOpenDetail>) => {
          event.preventDefault();
          const output = document.getElementById('media-card-download-log');
          if (output) output.textContent = `Download intercepted: ${event.detail.filename}`;
        }}
      ></lr-media-card>
      <p id="media-card-download-log">Activate the file to intercept its native download.</p>
    </div>
  `,
};
