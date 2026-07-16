import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './attachment-chip.js';
import type { LyraAttachmentChip } from './attachment-chip.js';
import { formatFileSize } from './attachment-chip.js';
import { styles } from './attachment-chip.styles.js';

function makeFile(name: string, type: string, sizeBytes = 1): File {
  return new File([new Uint8Array(sizeBytes)], name, { type, lastModified: 1700000000000 });
}

describe('formatFileSize', () => {
  it('renders whole bytes with no decimal', () => {
    expect(formatFileSize(0)).to.equal('0 B');
    expect(formatFileSize(512)).to.equal('512 B');
    expect(formatFileSize(1023)).to.equal('1023 B');
  });

  it('renders KB/MB/GB with exactly one decimal place', () => {
    expect(formatFileSize(1024)).to.equal('1.0 KB');
    expect(formatFileSize(2415919)).to.equal('2.3 MB');
    expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).to.equal('1.5 GB');
  });

  it('returns an empty string for a negative or non-finite input', () => {
    expect(formatFileSize(-1)).to.equal('');
    expect(formatFileSize(NaN)).to.equal('');
    expect(formatFileSize(Infinity)).to.equal('');
  });

  describe('formatFileSize unit-label resolver', () => {
    it('accepts an optional unit-label resolver, defaulting to the plain English abbreviation', () => {
      expect(formatFileSize(2415919)).to.equal('2.3 MB');
      expect(formatFileSize(2415919, (unit) => `[${unit}]`)).to.equal('2.3 [MB]');
    });
  });
});

it('defaults to status="pending", removable=true, and empty independent props', async () => {
  const el = (await fixture(html`<lyra-attachment-chip></lyra-attachment-chip>`)) as LyraAttachmentChip;
  expect(el.status).to.equal('pending');
  expect(el.getAttribute('status')).to.equal('pending');
  expect(el.removable).to.be.true;
  expect(el.name).to.equal('');
  expect(el.size).to.equal(0);
  expect(el.mimeType).to.equal('');
  expect(el.thumbnailSrc).to.equal('');
  expect(el.previewSrc).to.equal('');
  expect(el.previewable).to.be.true;
  expect(el.progress).to.equal(0);
  expect(el.file).to.be.undefined;
});

it('registers lyra-document-preview transitively via lyra-document-viewer, with no direct import of its own', async () => {
  // attachment-chip.ts only side-effect-imports document-viewer.js; document-viewer.js in turn
  // imports document-preview.js as its own built-in fallback renderer, so the tag must still be
  // defined even though attachment-chip.ts no longer imports document-preview.js directly.
  await fixture(html`<lyra-attachment-chip></lyra-attachment-chip>`);
  expect(customElements.get('lyra-document-preview')).to.exist;
});

describe('document preview integration', () => {
  it('opens the document viewer with the File MIME type and blob source', async () => {
    const file = makeFile('notes.txt', 'text/plain', 12);
    const el = (await fixture(html`<lyra-attachment-chip .file=${file}></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const preview = el.shadowRoot!.querySelector('[part="preview-button"]') as HTMLButtonElement;
    expect(preview).to.exist;

    const eventPromise = oneEvent(el, 'lyra-preview');
    preview.click();
    const event = await eventPromise;
    expect(event.detail.name).to.equal('notes.txt');
    expect(event.detail.mimeType).to.equal('text/plain');
    expect(event.detail.src).to.match(/^blob:/);

    const viewer = el.shadowRoot!.querySelector('lyra-document-viewer') as HTMLElement & { open: boolean };
    await el.updateComplete;
    expect(viewer.open).to.be.true;
    expect((viewer as HTMLElement & { mimeType: string }).mimeType).to.equal('text/plain');
    expect((viewer as HTMLElement & { name: string }).name).to.equal('notes.txt');
  });

  it('uses preview-src with the existing mime-type for persisted attachments', async () => {
    const el = (await fixture(html`
      <lyra-attachment-chip
        name="report.pdf"
        mime-type="application/pdf"
        preview-src="https://example.test/report.pdf"
      ></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    const eventPromise = oneEvent(el, 'lyra-preview');
    (el.shadowRoot!.querySelector('[part="preview-button"]') as HTMLButtonElement).click();
    const event = await eventPromise;
    expect(event.detail.mimeType).to.equal('application/pdf');
    expect(event.detail.src).to.equal('https://example.test/report.pdf');
  });

  it('localizes the preview action name', async () => {
    const el = (await fixture(html`
      <lyra-attachment-chip
        .file=${makeFile('notes.txt', 'text/plain')}
        .strings=${{ attachmentPreviewName: 'Aperçu de {name}' }}
      ></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="preview-button"]')!.getAttribute('aria-label')).to.equal(
      'Aperçu de notes.txt',
    );
  });
});

it('reflects status changes onto the host attribute', async () => {
  const el = (await fixture(html`<lyra-attachment-chip></lyra-attachment-chip>`)) as LyraAttachmentChip;
  el.status = 'error';
  await el.updateComplete;
  expect(el.getAttribute('status')).to.equal('error');
});

describe('independent name/size/mime-type props', () => {
  it('renders the given name, falling back to "Untitled file" when unset', async () => {
    const withName = (await fixture(
      html`<lyra-attachment-chip name="report.pdf"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(withName.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('report.pdf');

    const withoutName = (await fixture(html`<lyra-attachment-chip></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(withoutName.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('Untitled file');
  });

  it('sets the full filename as a title tooltip, independent of visual truncation', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="a-very-long-quarterly-financial-summary-2026.pdf"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const name = el.shadowRoot!.querySelector('[part="name"]') as HTMLElement;
    expect(name.getAttribute('title')).to.equal('a-very-long-quarterly-financial-summary-2026.pdf');
  });

  it('formats size via formatFileSize and hides the part entirely for a 0/unset size', async () => {
    const noSize = (await fixture(html`<lyra-attachment-chip name="a.txt"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const sizePart = noSize.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(sizePart.hidden).to.be.true;

    const withSize = (await fixture(
      html`<lyra-attachment-chip name="a.txt" size="2415919"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const sizePart2 = withSize.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(sizePart2.hidden).to.be.false;
    expect(sizePart2.textContent).to.equal('2.3 MB');
  });

  it('renders thumbnail-src as the thumbnail image when file is unset', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="pic.png" thumbnail-src="https://example.test/thumb.png"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const img = el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement;
    expect(img).to.exist;
    expect(img.getAttribute('src')).to.equal('https://example.test/thumb.png');
  });

  it('renders a generic file glyph (no img) when neither file nor thumbnail-src is set', async () => {
    const el = (await fixture(html`<lyra-attachment-chip name="a.txt"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const thumb = el.shadowRoot!.querySelector('[part="thumbnail"]') as HTMLElement;
    expect(thumb.querySelector('img')).to.not.exist;
    expect(thumb.querySelector('svg')).to.exist;
  });
});

describe('the file property', () => {
  it('derives name, size and mime type from file, taking precedence over the independent props', async () => {
    const file = makeFile('photo.png', 'image/png', 2048);
    const el = (await fixture(
      html`<lyra-attachment-chip name="ignored.txt" size="1" mime-type="text/plain" .file=${file}></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('photo.png');
    expect(el.shadowRoot!.querySelector('[part="size"]')!.textContent).to.equal('2.0 KB');
  });

  it('renders an <img> object-URL thumbnail for an image file, created lazily', async () => {
    const file = makeFile('photo.png', 'image/png');
    const el = (await fixture(html`<lyra-attachment-chip .file=${file}></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const img = el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement;
    expect(img).to.exist;
    expect(img.getAttribute('src')).to.match(/^blob:/);
  });

  it('renders the generic file glyph (no object URL) for a non-image file', async () => {
    const file = makeFile('report.pdf', 'application/pdf');
    const el = (await fixture(html`<lyra-attachment-chip .file=${file}></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const thumb = el.shadowRoot!.querySelector('[part="thumbnail"]') as HTMLElement;
    expect(thumb.querySelector('img')).to.not.exist;
    expect(thumb.querySelector('svg')).to.exist;
  });

  it('ignores thumbnail-src once file is set (file always wins)', async () => {
    const file = makeFile('photo.png', 'image/png');
    const el = (await fixture(
      html`<lyra-attachment-chip thumbnail-src="https://example.test/should-not-be-used.png" .file=${file}></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const img = el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement;
    expect(img.getAttribute('src')).to.match(/^blob:/);
  });

  it('revokes the object URL when file is reassigned to a different file', async () => {
    const file1 = makeFile('a.png', 'image/png');
    const el = (await fixture(html`<lyra-attachment-chip .file=${file1}></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const firstSrc = (el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement).getAttribute('src')!;

    let revoked = '';
    const original = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      revoked = url;
      original(url);
    };
    try {
      const file2 = makeFile('b.png', 'image/png');
      el.file = file2;
      await el.updateComplete;
      expect(revoked).to.equal(firstSrc);
      const secondSrc = (el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement).getAttribute('src')!;
      expect(secondSrc).to.not.equal(firstSrc);
    } finally {
      URL.revokeObjectURL = original;
    }
  });

  it('revokes the object URL when file is cleared to undefined, falling back to the generic glyph', async () => {
    const file = makeFile('a.png', 'image/png');
    const el = (await fixture(html`<lyra-attachment-chip .file=${file}></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const firstSrc = (el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement).getAttribute('src')!;

    let revoked = '';
    const original = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      revoked = url;
      original(url);
    };
    try {
      el.file = undefined;
      await el.updateComplete;
      expect(revoked).to.equal(firstSrc);
      const thumb = el.shadowRoot!.querySelector('[part="thumbnail"]') as HTMLElement;
      expect(thumb.querySelector('img')).to.not.exist;
      expect(thumb.querySelector('svg')).to.exist;
    } finally {
      URL.revokeObjectURL = original;
    }
  });

  it('revokes the object URL on disconnect', async () => {
    const file = makeFile('a.png', 'image/png');
    const el = (await fixture(html`<lyra-attachment-chip .file=${file}></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const src = (el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement).getAttribute('src')!;

    let revoked = '';
    const original = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      revoked = url;
      original(url);
    };
    try {
      el.remove();
      expect(revoked).to.equal(src);
    } finally {
      URL.revokeObjectURL = original;
    }
  });
});

describe('status accents and progress', () => {
  it('shows nothing in the progress/spinner slot while not uploading', async () => {
    const el = (await fixture(html`<lyra-attachment-chip status="pending"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="progress"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.not.exist;
  });

  it('renders an indeterminate spinner while uploading with no meaningful progress', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="a.zip" status="uploading"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
    expect(spinner).to.exist;
    expect(spinner.getAttribute('role')).to.equal('status');
    expect(spinner.getAttribute('aria-label')).to.equal('Uploading a.zip');
    expect(el.shadowRoot!.querySelector('[part="progress"]')).to.not.exist;
  });

  it('exposes a themeable spinner duration and stops the ambient loop for reduced motion', async () => {
    const el = (await fixture(html`
      <lyra-attachment-chip
        status="uploading"
        style="--lyra-attachment-chip-spinner-duration: 240ms"
      ></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
    expect(getComputedStyle(spinner).animationDuration).to.equal('0.24s');
    expect(styles.cssText).to.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[^]*\[part='spinner'\][^{]*\{[^}]*animation:\s*none\s*!important/,
    );
  });

  it('renders a real progressbar with aria-valuenow/min/max once progress is a meaningful number', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="a.zip" status="uploading" progress="42"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const bar = el.shadowRoot!.querySelector('[part="progress"]') as HTMLElement;
    expect(bar).to.exist;
    expect(bar.getAttribute('role')).to.equal('progressbar');
    expect(bar.getAttribute('aria-valuenow')).to.equal('42');
    expect(bar.getAttribute('aria-valuemin')).to.equal('0');
    expect(bar.getAttribute('aria-valuemax')).to.equal('100');
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.not.exist;
  });

  it('clamps an out-of-range progress value into [0, 100]', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="a.zip" status="uploading" progress="150"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const bar = el.shadowRoot!.querySelector('[part="progress"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).to.equal('100');
  });

  it('shows the same clamped number in status-text as the progressbar aria-valuenow, for an out-of-range progress', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="a.zip" status="uploading" progress="150"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const bar = el.shadowRoot!.querySelector('[part="progress"]') as HTMLElement;
    const text = el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
    expect(text.textContent).to.equal(`Uploading ${bar.getAttribute('aria-valuenow')}%`);
  });

  it('shows visible status-text (not just color) for uploading and error, none for pending/done', async () => {
    const uploading = (await fixture(
      html`<lyra-attachment-chip status="uploading" progress="30"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(uploading.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Uploading 30%');

    const error = (await fixture(html`<lyra-attachment-chip status="error"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const errorText = error.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
    expect(errorText.hidden).to.be.false;
    expect(errorText.textContent).to.equal('Upload failed');

    const pending = (await fixture(html`<lyra-attachment-chip status="pending"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect((pending.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).hidden).to.be.true;

    const done = (await fixture(html`<lyra-attachment-chip status="done"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect((done.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).hidden).to.be.true;
  });

  it('gives status-text role="alert" only for the one-shot error transition, not the ticking uploading readout', async () => {
    const error = (await fixture(html`<lyra-attachment-chip status="error"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const errorText = error.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
    expect(errorText.getAttribute('role')).to.equal('alert');

    const uploading = (await fixture(
      html`<lyra-attachment-chip status="uploading" progress="30"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const uploadingText = uploading.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
    expect(uploadingText.hasAttribute('role')).to.be.false;
  });
});

describe('retry affordance', () => {
  it('only renders while status="error"', async () => {
    const pending = (await fixture(html`<lyra-attachment-chip status="pending"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(pending.shadowRoot!.querySelector('[part="retry-button"]')).to.not.exist;

    const error = (await fixture(html`<lyra-attachment-chip status="error"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(error.shadowRoot!.querySelector('[part="retry-button"]')).to.exist;
  });

  it('has an aria-label of "Retry {filename}"', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="invoice.pdf" status="error"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Retry invoice.pdf');
  });

  it('emits lyra-retry with { id } on click, using the id attribute when set', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip id="att-1" name="invoice.pdf" status="error"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lyra-retry');
    expect(ev.detail).to.deep.equal({ id: 'att-1' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('remove affordance', () => {
  it('renders only when removable is true (the default)', async () => {
    const el = (await fixture(html`<lyra-attachment-chip name="a.txt"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.exist;
  });

  it('does not render when removable is false', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="a.txt" .removable=${false}></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.not.exist;
  });

  it('has an aria-label of "Remove {filename}"', async () => {
    const el = (await fixture(html`<lyra-attachment-chip name="invoice.pdf"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove invoice.pdf');
  });

  it('emits lyra-remove with { id } on click', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip id="att-2" name="invoice.pdf"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lyra-remove');
    expect(ev.detail).to.deep.equal({ id: 'att-2' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('id resolution', () => {
  it('derives a stable id from file name+size+lastModified when no id attribute is set', async () => {
    const file = makeFile('a.png', 'image/png', 10);
    const el = (await fixture(html`<lyra-attachment-chip .file=${file}></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lyra-remove');
    expect(ev.detail.id).to.equal(`a.png:10:${file.lastModified}`);
  });

  it('falls back to a generated internal id when neither id nor file is set', async () => {
    const el = (await fixture(html`<lyra-attachment-chip name="a.txt"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lyra-remove');
    expect(ev.detail.id).to.be.a('string');
    expect(ev.detail.id.length).to.be.greaterThan(0);
  });

  it('prefers the explicit id attribute even when file is also set', async () => {
    const file = makeFile('a.png', 'image/png', 10);
    const el = (await fixture(
      html`<lyra-attachment-chip id="explicit-id" .file=${file}></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lyra-remove');
    expect(ev.detail.id).to.equal('explicit-id');
  });
});

describe('label overrides (i18n)', () => {
  it('uses contextual message templates so translations control word order and punctuation', async () => {
    const uploading = (await fixture(html`
      <lyra-attachment-chip
        name="report.pdf"
        status="uploading"
        progress="30"
        .strings=${{
          attachmentUploadingProgress: '{percent}% envoyé',
          attachmentUploadingWithContext: 'Envoi de {label}',
          removeWithContext: 'Supprimer « {label} »',
        }}
      ></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(uploading.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('30% envoyé');
    expect(uploading.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('aria-label')).to.equal(
      'Envoi de report.pdf',
    );
    expect(uploading.shadowRoot!.querySelector('[part="remove-button"]')!.getAttribute('aria-label')).to.equal(
      'Supprimer « report.pdf »',
    );

    const indeterminate = (await fixture(html`
      <lyra-attachment-chip
        name="report.pdf"
        status="uploading"
        .strings=${{ attachmentUploadingIndeterminate: 'Envoi en cours' }}
      ></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(indeterminate.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Envoi en cours');

    const failed = (await fixture(html`
      <lyra-attachment-chip
        name="report.pdf"
        status="error"
        .strings=${{ attachmentRetryWithContext: 'Réessayer « {label} »' }}
      ></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(failed.shadowRoot!.querySelector('[part="retry-button"]')!.getAttribute('aria-label')).to.equal(
      'Réessayer « report.pdf »',
    );
  });

  it('overrides the remove button aria-label while keeping displayName interpolation', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="invoice.pdf" remove-label="Supprimer"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Supprimer invoice.pdf');
  });

  it('defaults removeLabel to "Remove", matching today\'s hardcoded text exactly', async () => {
    const el = (await fixture(html`<lyra-attachment-chip name="invoice.pdf"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.removeLabel).to.equal('Remove');
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove invoice.pdf');
  });

  it('overrides the retry button aria-label while keeping displayName interpolation', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="invoice.pdf" status="error" retry-label="Réessayer"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Réessayer invoice.pdf');
  });

  it('defaults retryLabel to "Retry", matching today\'s hardcoded text exactly', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="invoice.pdf" status="error"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.retryLabel).to.equal('Retry');
    const btn = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Retry invoice.pdf');
  });

  it('overrides the uploading status text verb while keeping the live percentage', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip status="uploading" progress="30" uploading-label="Téléversement"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Téléversement 30%');
  });

  it('overrides the indeterminate uploading status text verb (no numeric progress)', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip name="a.zip" status="uploading" uploading-label="Téléversement"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Téléversement…');
  });

  it('defaults uploadingLabel to "Uploading", matching today\'s hardcoded text exactly', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip status="uploading" progress="30"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.uploadingLabel).to.equal('Uploading');
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Uploading 30%');
  });

  it('overrides the upload-failed status text', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip status="error" upload-failed-label="Échec de l'envoi"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal("Échec de l'envoi");
  });

  it('defaults uploadFailedLabel to "Upload failed", matching today\'s hardcoded text exactly', async () => {
    const el = (await fixture(html`<lyra-attachment-chip status="error"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.uploadFailedLabel).to.equal('Upload failed');
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Upload failed');
  });
});

describe('uploadingLabel wiring', () => {
  it('wires uploadingLabel into the progressbar aria-label, not just the visible status text', async () => {
    const el = (await fixture(html`
      <lyra-attachment-chip
        name="report.pdf"
        status="uploading"
        progress="42"
        uploading-label="Envoi de"
      ></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    const progress = el.shadowRoot!.querySelector('[part="progress"]')!;
    expect(progress.getAttribute('aria-label')).to.equal('Envoi de report.pdf');
  });

  it('wires uploadingLabel into the spinner aria-label when progress is indeterminate', async () => {
    const el = (await fixture(html`
      <lyra-attachment-chip name="report.pdf" status="uploading" uploading-label="Envoi de"></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]')!;
    expect(spinner.getAttribute('aria-label')).to.equal('Envoi de report.pdf');
  });
});

describe('untitledLabel', () => {
  it('overrides the empty-name fallback shown as the name and used as the title tooltip', async () => {
    const el = (await fixture(html`<lyra-attachment-chip untitled-label="Fichier sans titre"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const name = el.shadowRoot!.querySelector('[part="name"]')!;
    expect(name.textContent).to.equal('Fichier sans titre');
    expect(name.getAttribute('title')).to.equal('Fichier sans titre');
  });

  it('defaults to "Untitled file" (unchanged from before this property existed)', async () => {
    const el = (await fixture(html`<lyra-attachment-chip></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.untitledLabel).to.equal('Untitled file');
    const name = el.shadowRoot!.querySelector('[part="name"]')!;
    expect(name.textContent).to.equal('Untitled file');
  });
});

describe('compact', () => {
  it('defaults to false, unchanged visual chrome', async () => {
    const el = (await fixture(html`<lyra-attachment-chip name="a.png"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.compact).to.be.false;
    expect(el.hasAttribute('compact')).to.be.false;
  });

  it('reflects the compact attribute when set', async () => {
    const el = (await fixture(html`<lyra-attachment-chip compact name="a.png"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.hasAttribute('compact')).to.be.true;
  });

  it('also shrinks font-size and gap in compact mode via themeable custom properties', async () => {
    const el = (await fixture(html`<lyra-attachment-chip compact name="a.png"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const nonCompact = (await fixture(html`<lyra-attachment-chip name="a.png"></lyra-attachment-chip>`)) as LyraAttachmentChip;
    const nonCompactBase = nonCompact.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const compactSize = parseFloat(getComputedStyle(base).fontSize);
    const nonCompactSize = parseFloat(getComputedStyle(nonCompactBase).fontSize);
    expect(compactSize).to.be.lessThan(nonCompactSize);
    const compactGap = getComputedStyle(base).gap;
    const nonCompactGap = getComputedStyle(nonCompactBase).gap;
    expect(compactGap).to.not.equal(nonCompactGap);
  });
});

describe('thumbnailOnly', () => {
  it('hides [part=meta] for an image chip when both compact and thumbnailOnly are set', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip compact thumbnail-only name="a.png" mime-type="image/png"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.equal('none');
  });

  it('hides [part=meta] when image MIME type comes from a real File object', async () => {
    const el = (await fixture(html`
      <lyra-attachment-chip compact thumbnail-only .file=${makeFile('a.png', 'image/png')}></lyra-attachment-chip>
    `)) as LyraAttachmentChip;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.equal('none');
  });

  it('leaves [part=meta] visible for a non-image chip even when thumbnailOnly is set', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip compact thumbnail-only name="a.pdf" mime-type="application/pdf"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.not.equal('none');
  });

  it('defaults to false, unchanged visual chrome even in compact mode', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip compact name="a.png" mime-type="image/png"></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.thumbnailOnly).to.be.false;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.not.equal('none');
  });
});

describe('file-size unit localization', () => {
  it('localizes file-size units via this.localize(), not hardcoded English abbreviations', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip
        .file=${makeFile('report.pdf', 'application/pdf', 2415919)}
        .strings=${{ fileSizeUnitMb: 'Mo' }}
      ></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const size = el.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(size.textContent).to.equal('2.3 Mo');
  });

  it('defaults to English unit abbreviations when no strings override is set', async () => {
    const el = (await fixture(
      html`<lyra-attachment-chip .file=${makeFile('report.pdf', 'application/pdf', 2415919)}></lyra-attachment-chip>`,
    )) as LyraAttachmentChip;
    const size = el.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(size.textContent).to.equal('2.3 MB');
  });
});

it('is accessible in the default (empty) state', async () => {
  const el = (await fixture(html`<lyra-attachment-chip></lyra-attachment-chip>`)) as LyraAttachmentChip;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated uploading state with numeric progress', async () => {
  const el = (await fixture(html`
    <lyra-attachment-chip
      id="att-3"
      name="dataset.csv"
      size="9830400"
      mime-type="text/csv"
      status="uploading"
      progress="58"
    ></lyra-attachment-chip>
  `)) as LyraAttachmentChip;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated error state with a retry button', async () => {
  const el = (await fixture(html`
    <lyra-attachment-chip id="att-4" name="invoice.pdf" size="102400" mime-type="application/pdf" status="error"></lyra-attachment-chip>
  `)) as LyraAttachmentChip;
  await expect(el).to.be.accessible();
});
