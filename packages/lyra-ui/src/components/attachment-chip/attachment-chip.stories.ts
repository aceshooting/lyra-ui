import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './attachment-chip.js';

const meta: Meta = {
  title: 'AttachmentChip',
  component: 'lr-attachment-chip',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact chip representing one file queued for (or already part of) a chat message — a composer’s pre-send attachment tray, or a sent message’s `attachments` slot. Populate it either with a real `file` (auto-derives name/size/mime-type/thumbnail) or with the independent `name`/`size`/`mime-type`/`thumbnail-src` props when reconstructing from server-persisted metadata.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

// A tiny (1x1) red PNG, just enough to demonstrate the image-thumbnail path
// without shipping a real binary asset alongside the story.
const PNG_1X1_RED_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function samplePngFile(name: string): File {
  const binary = atob(PNG_1X1_RED_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: 'image/png' });
}

function sampleTextFile(name: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: 'text/plain' });
}

export const Statuses: Story = {
  render: () => {
    return html`
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; max-width:40rem;">
        <lr-attachment-chip
          name="quarterly-report.pdf"
          size="248300"
          mime-type="application/pdf"
          status="pending"
        ></lr-attachment-chip>
        <lr-attachment-chip
          name="roof-photo.jpg"
          size="2415919"
          mime-type="image/jpeg"
          status="uploading"
          progress="42"
        ></lr-attachment-chip>
        <lr-attachment-chip
          name="dataset.csv"
          size="9830400"
          mime-type="text/csv"
          status="uploading"
        ></lr-attachment-chip>
        <lr-attachment-chip
          name="invoice.pdf"
          size="102400"
          mime-type="application/pdf"
          status="error"
        ></lr-attachment-chip>
        <lr-attachment-chip
          name="notes.txt"
          size="512"
          mime-type="text/plain"
          status="done"
        ></lr-attachment-chip>
      </div>
    `;
  },
};

export const FromRealFile: Story = {
  name: 'Populated from a real File object',
  parameters: {
    docs: {
      description: {
        story:
          'Setting `.file` (an actual `File`, e.g. from `<lr-file-input>`’s `lr-files` event) auto-derives the filename, size, MIME type and — for images — a lazily-created object-URL thumbnail. No `name`/`size`/`mime-type`/`thumbnail-src` attributes are set on either chip below; everything shown comes from the `File` itself.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; max-width:40rem;">
      <lr-attachment-chip .file=${samplePngFile('site-photo.png')} status="done"></lr-attachment-chip>
      <lr-attachment-chip .file=${sampleTextFile('export.csv', 15360)} status="pending"></lr-attachment-chip>
    </div>
  `,
};

export const ClickToPreview: Story = {
  name: 'Click an uploaded file to preview and download',
  parameters: {
    docs: {
      description: {
        story:
          'A real `File` supplies its existing MIME type to `lr-document-viewer`; activating the preview action opens the dialog and the dialog footer provides the native download action. No second format field or MIME-detection function is needed.',
      },
    },
  },
  render: () => html`
    <lr-attachment-chip
      .file=${sampleTextFile('uploaded-notes.txt', 128)}
      status="done"
    ></lr-attachment-chip>
  `,
};

export const FromServerMetadata: Story = {
  name: 'Reconstructed from server-persisted metadata (no File object)',
  parameters: {
    docs: {
      description: {
        story:
          'After a page reload there is no real `File` object any more — only whatever metadata the server persisted. The independent `name`/`size`/`mime-type`/`thumbnail-src` props cover exactly that case.',
      },
    },
  },
  render: () => html`
    <lr-attachment-chip
      name="site-photo.png"
      size="184320"
      mime-type="image/png"
      thumbnail-src="data:image/png;base64,${PNG_1X1_RED_BASE64}"
      status="done"
    ></lr-attachment-chip>
  `,
};

export const UploadingNumericProgress: Story = {
  name: 'Uploading — numeric progress bar',
  render: () => html`
    <lr-attachment-chip
      name="large-export.zip"
      size="52428800"
      mime-type="application/zip"
      status="uploading"
      progress="67"
    ></lr-attachment-chip>
  `,
};

export const UploadingIndeterminate: Story = {
  name: 'Uploading — indeterminate spinner (no progress yet)',
  render: () => html`
    <lr-attachment-chip
      name="large-export.zip"
      size="52428800"
      mime-type="application/zip"
      status="uploading"
    ></lr-attachment-chip>
  `,
};

export const ErrorWithRetry: Story = {
  name: 'Error state with retry affordance',
  render: () => html`
    <lr-attachment-chip
      name="invoice.pdf"
      size="102400"
      mime-type="application/pdf"
      status="error"
    ></lr-attachment-chip>
  `,
};

export const NotRemovable: Story = {
  name: 'removable=false (already-sent message attachment)',
  render: () => html`
    <lr-attachment-chip
      name="roof-photo.jpg"
      size="2415919"
      mime-type="image/jpeg"
      status="done"
      .removable=${false}
    ></lr-attachment-chip>
  `,
};

export const Compact: Story = {
  name: 'Compact attachment tray',
  parameters: {
    docs: {
      description: {
        story:
          'The `compact` presentation reduces the thumbnail, text, spacing, and outer chrome while retaining the filename and status information.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; max-width:32rem;">
      <lr-attachment-chip compact .file=${samplePngFile('site-photo.png')} status="done"></lr-attachment-chip>
      <lr-attachment-chip compact .file=${sampleTextFile('notes.txt', 2048)} status="pending"></lr-attachment-chip>
    </div>
  `,
};

export const ThumbnailOnly: Story = {
  name: 'Compact image thumbnail only',
  parameters: {
    docs: {
      description: {
        story:
          'Combining `compact` and `thumbnail-only` hides metadata only for image attachments, including images supplied as real `File` objects. Non-image files retain their identifying text.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
      <lr-attachment-chip
        compact
        thumbnail-only
        .file=${samplePngFile('site-photo.png')}
        status="done"
      ></lr-attachment-chip>
      <lr-attachment-chip
        compact
        thumbnail-only
        .file=${sampleTextFile('notes.txt', 2048)}
        status="pending"
      ></lr-attachment-chip>
    </div>
  `,
};

export const LongFilenameTruncates: Story = {
  name: 'Long filename truncates inside a constrained width',
  render: () => html`
    <div style="max-width:14rem;">
      <lr-attachment-chip
        name="quarterly-financial-summary-2026-region-emea.pdf"
        size="1048576"
        mime-type="application/pdf"
        status="pending"
      ></lr-attachment-chip>
    </div>
  `,
};

export const ComposerTray: Story = {
  name: 'Composer pre-send attachment tray',
  parameters: {
    docs: {
      description: {
        story:
          'A typical composer tray: several chips at different stages, wrapping onto multiple lines as needed. Each fires `lr-remove`/`lr-retry` independently.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; max-width:32rem; padding:0.5rem; border:1px dashed var(--lr-color-border); border-radius:0.5rem;">
      <lr-attachment-chip name="roof-photo.jpg" size="2415919" mime-type="image/jpeg" status="done"></lr-attachment-chip>
      <lr-attachment-chip name="dataset.csv" size="9830400" mime-type="text/csv" status="uploading" progress="58"></lr-attachment-chip>
      <lr-attachment-chip name="invoice.pdf" size="102400" mime-type="application/pdf" status="error"></lr-attachment-chip>
      <lr-attachment-chip name="notes.txt" size="512" mime-type="text/plain" status="pending"></lr-attachment-chip>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lr-attachment-chip
        id="att-9"
        name="invoice.pdf"
        size="102400"
        mime-type="application/pdf"
        status="error"
        @lr-remove=${(e: CustomEvent<{ id: string }>) => {
          const out = document.getElementById('attachment-chip-log');
          if (out) out.textContent = `lr-remove: ${JSON.stringify(e.detail)}`;
        }}
        @lr-retry=${(e: CustomEvent<{ id: string }>) => {
          const out = document.getElementById('attachment-chip-log');
          if (out) out.textContent = `lr-retry: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-attachment-chip>
      <p id="attachment-chip-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};
