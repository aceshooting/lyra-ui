import { aTimeout, fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './attachment-chip.js';
import type { LyraAttachmentChip } from './attachment-chip.js';
import { formatFileSize } from './attachment-chip.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function sinkElement(politeness: 'polite' | 'assertive'): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
}

function sinkTexts(politeness: 'polite' | 'assertive'): string[] {
  const element = sinkElement(politeness);
  return element ? Array.from(element.children).map((child) => child.textContent ?? '') : [];
}

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
  const el = (await fixture(html`<lr-attachment-chip></lr-attachment-chip>`)) as LyraAttachmentChip;
  expect(el.status).to.equal('pending');
  expect(el.getAttribute('status')).to.equal('pending');
  expect(el.removable).to.be.true;
  expect(el.name).to.equal('');
  expect(el.bytes).to.be.undefined;
  expect(el.mimeType).to.equal('');
  expect(el.thumbnailSrc).to.equal('');
  expect(el.previewSrc).to.equal('');
  expect(el.previewable).to.be.true;
  expect(el.progress).to.equal(0);
  expect(el.file).to.be.undefined;
});

it('keeps the granular chip registration free of viewer registrations', async () => {
  await fixture(html`<lr-attachment-chip></lr-attachment-chip>`);
  expect(customElements.get('lr-document-viewer')).to.equal(undefined);
});

describe('event-owned preview requests', () => {
  it('emits a plain, non-cancelable notification with the File MIME type and blob source without rendering a viewer', async () => {
    const file = makeFile('notes.txt', 'text/plain', 12);
    const el = (await fixture(html`<lr-attachment-chip attachment-id="attachment-1" .file=${file}></lr-attachment-chip>`)) as LyraAttachmentChip;
    const preview = el.shadowRoot!.querySelector('[part="preview-button"]') as HTMLButtonElement;
    expect((preview) != null).to.equal(true);

    const eventPromise = oneEvent(el, 'lr-preview-request');
    preview.click();
    const event = await eventPromise;
    expect(event.cancelable).to.be.false;
    expect(event.detail.attachmentId).to.equal('attachment-1');
    expect(event.detail.name).to.equal('notes.txt');
    expect(event.detail.mimeType).to.equal('text/plain');
    expect(event.detail.src).to.match(/^blob:/);
    expect(el.shadowRoot!.querySelectorAll('lr-document-viewer').length).to.equal(0);
  });

  it('uses preview-src with the existing mime-type for persisted attachments', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        name="report.pdf"
        mime-type="application/pdf"
        preview-src="https://example.test/report.pdf"
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    const eventPromise = oneEvent(el, 'lr-preview-request');
    (el.shadowRoot!.querySelector('[part="preview-button"]') as HTMLButtonElement).click();
    const event = await eventPromise;
    expect(event.detail.mimeType).to.equal('application/pdf');
    expect(event.detail.src).to.equal('https://example.test/report.pdf');
  });

  it('localizes the preview action name', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        .file=${makeFile('notes.txt', 'text/plain')}
        .strings=${{ attachmentPreviewName: 'Aperçu de {name}' }}
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="preview-button"]')!.getAttribute('aria-label')).to.equal(
      'Aperçu de notes.txt',
    );
  });

  it('is not cancelable, so calling preventDefault() on it is byte-for-byte a no-op', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip preview-src="https://example.test/report.pdf"></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    el.addEventListener('lr-preview-request', (event) => event.preventDefault());
    const requested = oneEvent(el, 'lr-preview-request');
    (el.shadowRoot!.querySelector('[part="preview-button"]') as HTMLButtonElement).click();
    const event = await requested;
    // Per spec, `preventDefault()` on a non-cancelable event does nothing --
    // `defaultPrevented` stays `false` even though a listener called it. This is the
    // behavioral proof that the flag carries no meaning here: there is nothing local
    // for the chip to gate (see the class doc), so the event is a plain notification.
    expect(event.cancelable).to.be.false;
    expect(event.defaultPrevented).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('lr-document-viewer').length).to.equal(0);
  });
});

describe('previewable', () => {
  it('renders the preview button by default (previewable=true) when a preview src is available', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        name="report.pdf"
        mime-type="application/pdf"
        preview-src="https://example.test/report.pdf"
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(el.previewable).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="preview-button"]').length).to.equal(1);
  });

  it('previewable="false" (plain HTML attribute) hides the preview button even with a preview src available', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        name="report.pdf"
        mime-type="application/pdf"
        preview-src="https://example.test/report.pdf"
        previewable="false"
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(el.previewable).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="preview-button"]').length).to.equal(0);
  });
});

it('reflects status changes onto the host attribute', async () => {
  const el = (await fixture(html`<lr-attachment-chip></lr-attachment-chip>`)) as LyraAttachmentChip;
  el.status = 'error';
  await el.updateComplete;
  expect(el.getAttribute('status')).to.equal('error');
});

it('normalizes hostile status values to the canonical pending state', async () => {
  const el = (await fixture(html`<lr-attachment-chip></lr-attachment-chip>`)) as LyraAttachmentChip;
  el.status = 'finished' as typeof el.status;
  await el.updateComplete;
  expect(el.status).to.equal('pending');
  expect(el.getAttribute('status')).to.equal('pending');
});

describe('independent name/bytes/mime-type props', () => {
  it('renders the given name, falling back to "Untitled file" when unset', async () => {
    const withName = (await fixture(
      html`<lr-attachment-chip name="report.pdf"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(withName.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('report.pdf');

    const withoutName = (await fixture(html`<lr-attachment-chip></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect(withoutName.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('Untitled file');
  });

  it('sets the full filename as a title tooltip, independent of visual truncation', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a-very-long-quarterly-financial-summary-2026.pdf"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const name = el.shadowRoot!.querySelector('[part="name"]') as HTMLElement;
    expect(name.getAttribute('title')).to.equal('a-very-long-quarterly-financial-summary-2026.pdf');
  });

  it('formats bytes, renders a known zero-byte value, and hides only an absent byte count', async () => {
    const noSize = (await fixture(html`<lr-attachment-chip name="a.txt"></lr-attachment-chip>`)) as LyraAttachmentChip;
    const sizePart = noSize.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(sizePart.hidden).to.be.true;

    const withSize = (await fixture(
      html`<lr-attachment-chip name="a.txt" bytes="2415919"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const sizePart2 = withSize.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(sizePart2.hidden).to.be.false;
    expect(sizePart2.textContent).to.equal('2.3 MB');

    const empty = (await fixture(
      html`<lr-attachment-chip name="empty.txt" bytes="0"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const emptySize = empty.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(emptySize.hidden).to.be.false;
    expect(emptySize.textContent).to.equal('0 B');
  });

  it('treats a negative, NaN, or infinite bytes value as unknown', async () => {
    const negative = (await fixture(
      html`<lr-attachment-chip name="a.txt" .bytes=${-5}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect((negative.shadowRoot!.querySelector('[part="size"]') as HTMLElement).hidden).to.be.true;

    const nan = (await fixture(
      html`<lr-attachment-chip name="a.txt" .bytes=${NaN}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect((nan.shadowRoot!.querySelector('[part="size"]') as HTMLElement).hidden).to.be.true;

    const infinite = (await fixture(
      html`<lr-attachment-chip name="a.txt" .bytes=${Infinity}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(infinite.bytes).to.equal(undefined);
    expect((infinite.shadowRoot!.querySelector('[part="size"]') as HTMLElement).hidden).to.be.true;
  });

  it('renders thumbnail-src as the thumbnail image when file is unset', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="pic.png" thumbnail-src="https://example.test/thumb.png"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const img = el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement;
    expect((img) != null).to.equal(true);
    expect(img.getAttribute('src')).to.equal('https://example.test/thumb.png');
  });

  it('does not render a thumbnail for an unsafe thumbnail-src URL', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="pic.png" thumbnail-src="javascript:alert(1)"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const thumb = el.shadowRoot!.querySelector('[part="thumbnail"]') as HTMLElement;
    expect((thumb.querySelector('img')) == null).to.equal(true);
    expect((thumb.querySelector('svg')) != null).to.equal(true);
  });

  it('renders a generic file glyph (no img) when neither file nor thumbnail-src is set', async () => {
    const el = (await fixture(html`<lr-attachment-chip name="a.txt"></lr-attachment-chip>`)) as LyraAttachmentChip;
    const thumb = el.shadowRoot!.querySelector('[part="thumbnail"]') as HTMLElement;
    expect((thumb.querySelector('img')) == null).to.equal(true);
    expect((thumb.querySelector('svg')) != null).to.equal(true);
  });
});

describe('the file property', () => {
  it('derives name, byte count and mime type from file, taking precedence over the independent props', async () => {
    const file = makeFile('photo.png', 'image/png', 2048);
    const el = (await fixture(
      html`<lr-attachment-chip name="ignored.txt" bytes="1" mime-type="text/plain" .file=${file}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="name"]')!.textContent).to.equal('photo.png');
    expect(el.shadowRoot!.querySelector('[part="size"]')!.textContent).to.equal('2.0 KB');
  });

  it('renders an <img> object-URL thumbnail for an image file, created lazily', async () => {
    const file = makeFile('photo.png', 'image/png');
    const el = (await fixture(html`<lr-attachment-chip .file=${file}></lr-attachment-chip>`)) as LyraAttachmentChip;
    const img = el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement;
    expect((img) != null).to.equal(true);
    expect(img.getAttribute('src')).to.match(/^blob:/);
  });

  it('renders the generic file glyph (no object URL) for a non-image file', async () => {
    const file = makeFile('report.pdf', 'application/pdf');
    const el = (await fixture(html`<lr-attachment-chip .file=${file}></lr-attachment-chip>`)) as LyraAttachmentChip;
    const thumb = el.shadowRoot!.querySelector('[part="thumbnail"]') as HTMLElement;
    expect((thumb.querySelector('img')) == null).to.equal(true);
    expect((thumb.querySelector('svg')) != null).to.equal(true);
  });

  it('ignores thumbnail-src once file is set (file always wins)', async () => {
    const file = makeFile('photo.png', 'image/png');
    const el = (await fixture(
      html`<lr-attachment-chip thumbnail-src="https://example.test/should-not-be-used.png" .file=${file}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const img = el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement;
    expect(img.getAttribute('src')).to.match(/^blob:/);
  });

  it('revokes the object URL when file is reassigned to a different file', async () => {
    const file1 = makeFile('a.png', 'image/png');
    const el = (await fixture(html`<lr-attachment-chip .file=${file1}></lr-attachment-chip>`)) as LyraAttachmentChip;
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
    const el = (await fixture(html`<lr-attachment-chip .file=${file}></lr-attachment-chip>`)) as LyraAttachmentChip;
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
      expect((thumb.querySelector('img')) == null).to.equal(true);
      expect((thumb.querySelector('svg')) != null).to.equal(true);
    } finally {
      URL.revokeObjectURL = original;
    }
  });

  it('revokes the object URL on disconnect', async () => {
    const file = makeFile('a.png', 'image/png');
    const el = (await fixture(html`<lr-attachment-chip .file=${file}></lr-attachment-chip>`)) as LyraAttachmentChip;
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

  it('creates a fresh object URL after disconnect and reconnect', async () => {
    const file = makeFile('a.png', 'image/png');
    const el = (await fixture(html`<lr-attachment-chip .file=${file}></lr-attachment-chip>`)) as LyraAttachmentChip;
    const parent = el.parentElement!;
    const firstSrc = (el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement).src;

    el.remove();
    parent.append(el);
    await el.updateComplete;

    const secondSrc = (el.shadowRoot!.querySelector('[part="thumbnail"] img') as HTMLImageElement).src;
    expect(secondSrc).to.match(/^blob:/);
    expect(secondSrc).to.not.equal(firstSrc);
  });

});

describe('status accents and progress', () => {
  it('shows nothing in the progress/spinner slot while not uploading', async () => {
    const el = (await fixture(html`<lr-attachment-chip status="pending"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect((el.shadowRoot!.querySelector('[part="progress"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="spinner"]')) == null).to.be.true;
  });

  it('renders an indeterminate spinner while uploading with no meaningful progress', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a.zip" status="uploading"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
    expect((spinner) != null).to.equal(true);
    expect(spinner.getAttribute('role')).to.equal(null);
    expect(spinner.getAttribute('aria-hidden')).to.equal('true');
    expect((el.shadowRoot!.querySelector('[part="progress"]')) == null).to.be.true;
  });

  it('exposes a themeable spinner duration and stops the ambient loop for reduced motion', async () => {
    await setReducedMotion('no-preference');
    try {
      const el = (await fixture(html`
        <lr-attachment-chip
          status="uploading"
          style="--lr-attachment-chip-spinner-duration: 240ms"
        ></lr-attachment-chip>
      `)) as LyraAttachmentChip;
      const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
      expect(getComputedStyle(spinner).animationDuration).to.equal('0.24s');
      expect(getComputedStyle(spinner).animationName).to.equal('lr-attachment-chip-spin');

      await setReducedMotion('reduce');
      await aTimeout(0);
      expect(getComputedStyle(spinner).animationName).to.equal('none');
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  it('renders a real progressbar with aria-valuenow/min/max once progress is a meaningful number', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a.zip" status="uploading" progress="42"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const bar = el.shadowRoot!.querySelector('[part="progress"]') as HTMLElement;
    expect((bar) != null).to.equal(true);
    expect(bar.getAttribute('role')).to.equal('progressbar');
    expect(bar.getAttribute('aria-valuenow')).to.equal('42');
    expect(bar.getAttribute('aria-valuemin')).to.equal('0');
    expect(bar.getAttribute('aria-valuemax')).to.equal('100');
    expect((el.shadowRoot!.querySelector('[part="spinner"]')) == null).to.be.true;
  });

  it('clamps an out-of-range progress value into [0, 100]', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a.zip" status="uploading" progress="150"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const bar = el.shadowRoot!.querySelector('[part="progress"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).to.equal('100');
  });

  it('falls back to the indeterminate spinner for a negative or NaN progress, instead of a broken/negative progressbar', async () => {
    const negative = (await fixture(
      html`<lr-attachment-chip name="a.zip" status="uploading" .progress=${-10}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect((negative.shadowRoot!.querySelector('[part="progress"]')) == null).to.be.true;
    expect(negative.shadowRoot!.querySelector('[part="spinner"]')).to.exist;

    const nan = (await fixture(
      html`<lr-attachment-chip name="a.zip" status="uploading" .progress=${NaN}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect((nan.shadowRoot!.querySelector('[part="progress"]')) == null).to.be.true;
    expect(nan.shadowRoot!.querySelector('[part="spinner"]')).to.exist;
    const spinner = nan.shadowRoot!.querySelector('[part="spinner"]')!;
    expect(spinner.getAttribute('role')).to.equal(null);
    expect(spinner.getAttribute('aria-hidden')).to.equal('true');
  });

  it('keeps high-frequency upload ticks out of every live region', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a.zip" status="uploading" progress="1"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    for (const progress of [2, 3, 4, 5]) {
      el.progress = progress;
      await el.updateComplete;
    }
    expect(sinkTexts('assertive')).to.deep.equal([]);
    expect(sinkTexts('polite')).to.deep.equal([]);
  });

  it('shows the same clamped number in status-text as the progressbar aria-valuenow, for an out-of-range progress', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a.zip" status="uploading" progress="150"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const bar = el.shadowRoot!.querySelector('[part="progress"]') as HTMLElement;
    const text = el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
    expect(text.textContent).to.equal(`Uploading ${bar.getAttribute('aria-valuenow')}%`);
  });

  it('shows visible status-text for uploading and error, none for pending/success', async () => {
    const uploading = (await fixture(
      html`<lr-attachment-chip status="uploading" progress="30"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(uploading.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Uploading 30%');

    const error = (await fixture(html`<lr-attachment-chip status="error"></lr-attachment-chip>`)) as LyraAttachmentChip;
    const errorText = error.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
    expect(errorText.hidden).to.be.false;
    expect(errorText.textContent).to.equal('Upload failed');

    const pending = (await fixture(html`<lr-attachment-chip status="pending"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect((pending.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).hidden).to.be.true;

    const success = (await fixture(html`<lr-attachment-chip status="success"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect((success.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement).hidden).to.be.true;
  });

  it('leaves status-text as plain visible text -- no shadow live role for either state', async () => {
    const error = (await fixture(html`<lr-attachment-chip status="error"></lr-attachment-chip>`)) as LyraAttachmentChip;
    const errorText = error.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
    // A live region inside a shadow root is not reliably announced, and a visible node must stay
    // readable, so the announcement moves to the shared light-DOM region instead of living here.
    expect(errorText.getAttribute('role')).to.equal(null);
    expect(errorText.getAttribute('aria-hidden')).to.equal(null);

    const uploading = (await fixture(
      html`<lr-attachment-chip status="uploading" progress="30"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const uploadingText = uploading.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
    expect(uploadingText.hasAttribute('role')).to.be.false;
  });

  it('announces a transition into error through the shared assertive sink, but never a mount', async () => {
    const mounted = (await fixture(
      html`<lr-attachment-chip status="error"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(
      sinkTexts('assertive'),
      'a chip that mounts already failed is history, not a fresh interruption',
    ).to.deep.equal([]);
    mounted.remove();

    const el = (await fixture(
      html`<lr-attachment-chip status="uploading"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    el.status = 'error';
    await el.updateComplete;
    expect(sinkTexts('assertive')).to.deep.equal(['Upload failed']);
  });

  it('announces a repeated failure again instead of silently rewriting one text node', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip status="uploading"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    el.status = 'error';
    await el.updateComplete;
    el.status = 'uploading';
    await el.updateComplete;
    el.status = 'error';
    await el.updateComplete;
    expect(
      sinkTexts('assertive'),
      'an identical repeat must be a second addition so assistive tech reads it again',
    ).to.deep.equal(['Upload failed', 'Upload failed']);
  });

  it('ref-counts the shared assertive sink away once the last chip disconnects', async () => {
    const first = (await fixture(
      html`<lr-attachment-chip></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const second = (await fixture(
      html`<lr-attachment-chip></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(sinkElement('assertive') !== null, 'a connected chip holds the sink').to.be.true;
    first.remove();
    expect(sinkElement('assertive') !== null, 'a still-connected chip keeps it mounted').to.be.true;
    second.remove();
    expect(sinkElement('assertive') === null, 'the last disconnect unmounts it').to.be.true;
  });

  it('retargets its sink when adopted into another document and releases it there', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip status="uploading"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const targetDocument = frame.contentDocument!;

    try {
      targetDocument.body.append(targetDocument.adoptNode(el));
      await el.updateComplete;

      const targetSink = targetDocument.querySelector<HTMLElement>(
        `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
      );
      expect(targetSink?.ownerDocument === targetDocument).to.be.true;
      expect(sinkElement('assertive') === null, 'the old document released this chip handle').to.be.true;

      el.status = 'error';
      await el.updateComplete;
      expect(Array.from(targetSink?.children ?? [], (child) => child.textContent ?? '')).to.deep.equal([
        'Upload failed',
      ]);
      el.remove();
      expect(
        targetDocument.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`).length,
      ).to.equal(0);
    } finally {
      el.remove();
      frame.remove();
    }
  });
});

describe('retry affordance', () => {
  it('only renders while status="error"', async () => {
    const pending = (await fixture(html`<lr-attachment-chip status="pending"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect((pending.shadowRoot!.querySelector('[part="retry-button"]')) == null).to.be.true;

    const error = (await fixture(html`<lr-attachment-chip status="error"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect(error.shadowRoot!.querySelector('[part="retry-button"]')).to.exist;
  });

  it('has an aria-label of "Retry {filename}"', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="invoice.pdf" status="error"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Retry invoice.pdf');
  });

  it('emits lr-retry with { attachmentId } on click', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip attachment-id="att-1" name="invoice.pdf" status="error"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lr-retry');
    expect(ev.detail).to.deep.equal({ attachmentId: 'att-1' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('remove affordance', () => {
  it('renders only when removable is true (the default)', async () => {
    const el = (await fixture(html`<lr-attachment-chip name="a.txt"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')).to.exist;
  });

  it('does not render when removable is false', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a.txt" .removable=${false}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelectorAll('[part="remove-button"]').length).to.equal(0);
  });

  it('removable="false" (plain HTML attribute) also hides the remove button', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a.txt" removable="false"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.removable).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="remove-button"]').length).to.equal(0);
  });

  it('tints the remove button on hover and deepens it while pressed', async () => {
    // The pressed mix is written from the button's own `transparent` fill, which is the one
    // color-mix() shape that can silently resolve to nothing at all. Read the rendered colour,
    // with the transition disabled so each read observes the state's target rather than WebKit's
    // still-transparent first transition frame.
    const el = (await fixture(
      html`<lr-attachment-chip name="a.txt" style="--lr-transition-fast: 0s"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    const resting = getComputedStyle(btn).backgroundColor;
    const rect = btn.getBoundingClientRect();
    expect(rect.width, 'the remove button has real geometry to point at').to.be.greaterThan(0);
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      const hovered = getComputedStyle(btn).backgroundColor;
      expect(hovered, 'hover tints the transparent button').to.not.equal(resting);

      await sendMouse({ type: 'down' });
      const pressed = getComputedStyle(btn).backgroundColor;
      expect(pressed, 'pressed is a further step, not a repeat of hover').to.not.equal(hovered);
      await sendMouse({ type: 'up' });
    } finally {
      await resetMouse();
    }
  });

  it('has an aria-label of "Remove {filename}"', async () => {
    const el = (await fixture(html`<lr-attachment-chip name="invoice.pdf"></lr-attachment-chip>`)) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove invoice.pdf');
  });

  it('emits lr-remove with { attachmentId } on click', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip attachment-id="att-2" name="invoice.pdf"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lr-remove');
    expect(ev.detail).to.deep.equal({ attachmentId: 'att-2' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('hit area', () => {
  it('gives retry-button, preview-button, and remove-button the shared minimum tappable size', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        name="invoice.pdf"
        status="error"
        .file=${makeFile('invoice.pdf', 'text/plain')}
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    for (const part of ['retry-button', 'preview-button', 'remove-button']) {
      const btn = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect((btn) != null, `[part="${part}"] should render`).to.equal(true);
      expect(getComputedStyle(btn).minInlineSize, `${part} minInlineSize`).to.equal('40px');
      expect(getComputedStyle(btn).minBlockSize, `${part} minBlockSize`).to.equal('40px');
    }
  });

  it('keeps compact retry-button/preview-button/remove-button at the shared icon-button floor', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        compact
        name="invoice.pdf"
        status="error"
        .file=${makeFile('invoice.pdf', 'text/plain')}
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    for (const part of ['retry-button', 'preview-button', 'remove-button']) {
      const btn = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      // The compact thumbnail is smaller, but every interactive action still keeps the shared
      // --lr-icon-button-size hit-area floor.
      expect(getComputedStyle(btn).minInlineSize, `${part} minInlineSize`).to.equal('40px');
      expect(getComputedStyle(btn).minBlockSize, `${part} minBlockSize`).to.equal('40px');
    }
  });
});

describe('attachment identity resolution', () => {
  it('derives a stable attachmentId from file name+size+lastModified when no attachment-id is set', async () => {
    const file = makeFile('a.png', 'image/png', 10);
    const el = (await fixture(html`<lr-attachment-chip .file=${file}></lr-attachment-chip>`)) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lr-remove');
    expect(ev.detail.attachmentId).to.equal(`a.png:10:${file.lastModified}`);
  });

  it('treats a whitespace-only attachment-id as missing before action events', async () => {
    const file = new File(['contents'], 'a.png', { type: 'image/png', lastModified: 123 });
    const el = await fixture<LyraAttachmentChip>(html`
      <lr-attachment-chip attachment-id="   " .file=${file}></lr-attachment-chip>
    `);
    const pending = oneEvent(el, 'lr-remove');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!.click();
    expect((await pending).detail.attachmentId).to.equal(`a.png:${file.size}:123`);
  });

  it('falls back to a generated attachmentId when neither attachment-id nor file is set', async () => {
    const el = (await fixture(html`<lr-attachment-chip name="a.txt"></lr-attachment-chip>`)) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lr-remove');
    expect(ev.detail.attachmentId).to.be.a('string');
    expect(ev.detail.attachmentId.length).to.be.greaterThan(0);
  });

  it('prefers attachment-id and leaves platform id independent', async () => {
    const file = makeFile('a.png', 'image/png', 10);
    const el = (await fixture(
      html`<lr-attachment-chip id="dom-id" attachment-id="attachment-42" .file=${file}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLButtonElement;
    setTimeout(() => btn.click());
    const ev = await oneEvent(el, 'lr-remove');
    expect(ev.detail.attachmentId).to.equal('attachment-42');
    expect(el.id).to.equal('dom-id');
  });
});

describe('label overrides (i18n)', () => {
  it('never mistakes explicit old-English or empty labels for localization sentinels', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        name="invoice.pdf"
        status="error"
        remove-label="Remove"
        retry-label="Retry"
        upload-failed-label="Upload failed"
        untitled-label="Untitled file"
        .strings=${{
          removeWithContext: 'Localized remove {label}',
          attachmentRetryWithContext: 'Localized retry {label}',
          attachmentUploadFailed: 'Localized failure',
          attachmentUntitledFile: 'Localized untitled',
        }}
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')!.getAttribute('aria-label')).to.equal('Remove');
    expect(el.shadowRoot!.querySelector('[part="retry-button"]')!.getAttribute('aria-label')).to.equal('Retry');
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Upload failed');

    el.removeLabel = '';
    el.retryLabel = '';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="remove-button"]')!.getAttribute('aria-label')).to.equal('');
    expect(el.shadowRoot!.querySelector('[part="retry-button"]')!.getAttribute('aria-label')).to.equal('');
  });

  it('uses contextual message templates so translations control word order and punctuation', async () => {
    const uploading = (await fixture(html`
      <lr-attachment-chip
        name="report.pdf"
        status="uploading"
        progress="30"
        .strings=${{
          attachmentUploadingProgress: '{percent}% envoyé',
          attachmentUploadingWithContext: 'Envoi de {label}',
          removeWithContext: 'Supprimer « {label} »',
        }}
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(uploading.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('30% envoyé');
    expect(uploading.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('aria-label')).to.equal(
      'Envoi de report.pdf',
    );
    expect(uploading.shadowRoot!.querySelector('[part="remove-button"]')!.getAttribute('aria-label')).to.equal(
      'Supprimer « report.pdf »',
    );

    const indeterminate = (await fixture(html`
      <lr-attachment-chip
        name="report.pdf"
        status="uploading"
        .strings=${{ attachmentUploadingIndeterminate: 'Envoi en cours' }}
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(indeterminate.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Envoi en cours');

    const failed = (await fixture(html`
      <lr-attachment-chip
        name="report.pdf"
        status="error"
        .strings=${{ attachmentRetryWithContext: 'Réessayer « {label} »' }}
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(failed.shadowRoot!.querySelector('[part="retry-button"]')!.getAttribute('aria-label')).to.equal(
      'Réessayer « report.pdf »',
    );
  });

  it('lets an explicit remove label win verbatim', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="invoice.pdf" remove-label="Supprimer"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Supprimer');
  });

  it('defaults removeLabel to "Remove", matching today\'s hardcoded text exactly', async () => {
    const el = (await fixture(html`<lr-attachment-chip name="invoice.pdf"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.removeLabel).to.be.undefined;
    const btn = el.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Remove invoice.pdf');
  });

  it('lets an explicit retry label win verbatim', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="invoice.pdf" status="error" retry-label="Réessayer"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const btn = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Réessayer');
  });

  it('defaults retryLabel to "Retry", matching today\'s hardcoded text exactly', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="invoice.pdf" status="error"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.retryLabel).to.be.undefined;
    const btn = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLElement;
    expect(btn.getAttribute('aria-label')).to.equal('Retry invoice.pdf');
  });

  it('lets an explicit uploading label win verbatim', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip status="uploading" progress="30" uploading-label="Téléversement"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Téléversement');
  });

  it('overrides the indeterminate uploading status text verb (no numeric progress)', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip name="a.zip" status="uploading" uploading-label="Téléversement"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Téléversement');
  });

  it('defaults uploadingLabel to "Uploading", matching today\'s hardcoded text exactly', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip status="uploading" progress="30"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.uploadingLabel).to.be.undefined;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Uploading 30%');
  });

  it('overrides the upload-failed status text', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip status="error" upload-failed-label="Échec de l'envoi"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal("Échec de l'envoi");
  });

  it('defaults uploadFailedLabel to "Upload failed", matching today\'s hardcoded text exactly', async () => {
    const el = (await fixture(html`<lr-attachment-chip status="error"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.uploadFailedLabel).to.be.undefined;
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Upload failed');
  });
});

describe('uploadingLabel wiring', () => {
  it('wires uploadingLabel into the progressbar aria-label, not just the visible status text', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        name="report.pdf"
        status="uploading"
        progress="42"
        uploading-label="Envoi de"
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    const progress = el.shadowRoot!.querySelector('[part="progress"]')!;
    expect(progress.getAttribute('aria-label')).to.equal('Envoi de');
  });

  it('wires uploadingLabel into visible status text while the indeterminate spinner stays decorative', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip name="report.pdf" status="uploading" uploading-label="Envoi de"></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]')!;
    expect(spinner.getAttribute('aria-hidden')).to.equal('true');
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.equal('Envoi de');
  });
});

describe('untitledLabel', () => {
  it('overrides the empty-name fallback shown as the name and used as the title tooltip', async () => {
    const el = (await fixture(html`<lr-attachment-chip untitled-label="Fichier sans titre"></lr-attachment-chip>`)) as LyraAttachmentChip;
    const name = el.shadowRoot!.querySelector('[part="name"]')!;
    expect(name.textContent).to.equal('Fichier sans titre');
    expect(name.getAttribute('title')).to.equal('Fichier sans titre');
  });

  it('defaults to "Untitled file" (unchanged from before this property existed)', async () => {
    const el = (await fixture(html`<lr-attachment-chip></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.untitledLabel).to.be.undefined;
    const name = el.shadowRoot!.querySelector('[part="name"]')!;
    expect(name.textContent).to.equal('Untitled file');
  });
});

describe('compact', () => {
  it('defaults to false, unchanged visual chrome', async () => {
    const el = (await fixture(html`<lr-attachment-chip name="a.png"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.compact).to.be.false;
    expect(el.hasAttribute('compact')).to.be.false;
  });

  it('reflects the compact attribute when set', async () => {
    const el = (await fixture(html`<lr-attachment-chip compact name="a.png"></lr-attachment-chip>`)) as LyraAttachmentChip;
    expect(el.hasAttribute('compact')).to.be.true;
  });

  it('also shrinks font-size and gap in compact mode via themeable custom properties', async () => {
    const el = (await fixture(html`<lr-attachment-chip compact name="a.png"></lr-attachment-chip>`)) as LyraAttachmentChip;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const nonCompact = (await fixture(html`<lr-attachment-chip name="a.png"></lr-attachment-chip>`)) as LyraAttachmentChip;
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
      html`<lr-attachment-chip compact thumbnail-only name="a.png" mime-type="image/png"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.equal('none');
  });

  it('hides [part=meta] when image MIME type comes from a real File object', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip compact thumbnail-only .file=${makeFile('a.png', 'image/png')}></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.equal('none');
  });

  it('leaves [part=meta] visible for a non-image chip even when thumbnailOnly is set', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip compact thumbnail-only name="a.pdf" mime-type="application/pdf"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.not.equal('none');
  });

  it('defaults to false, unchanged visual chrome even in compact mode', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip compact name="a.png" mime-type="image/png"></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    expect(el.thumbnailOnly).to.be.false;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.not.equal('none');
  });
});

describe('file-size unit localization', () => {
  it('localizes file-size units via this.localize(), not hardcoded English abbreviations', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip
        .file=${makeFile('report.pdf', 'application/pdf', 2415919)}
        .strings=${{ fileSizeUnitMb: 'Mo' }}
      ></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const size = el.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(size.textContent).to.equal('2.3 Mo');
  });

  it('defaults to English unit abbreviations when no strings override is set', async () => {
    const el = (await fixture(
      html`<lr-attachment-chip .file=${makeFile('report.pdf', 'application/pdf', 2415919)}></lr-attachment-chip>`,
    )) as LyraAttachmentChip;
    const size = el.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
    expect(size.textContent).to.equal('2.3 MB');
  });

  it('formats numeric sizes and progress with the effective locale', async () => {
    const el = (await fixture(html`
      <lr-attachment-chip
        lang="ar-EG"
        name="report.pdf"
        bytes="2415919"
        status="uploading"
        progress="42"
      ></lr-attachment-chip>
    `)) as LyraAttachmentChip;
    expect(el.shadowRoot!.querySelector('[part="size"]')!.textContent).to.contain('٢٫٣');
    expect(el.shadowRoot!.querySelector('[part="status-text"]')!.textContent).to.contain('٤٢');
  });
});

it('honors inherited and direct public theme hooks', async () => {
  const wrapper = await fixture(html`
    <div style="--lr-transition-fast: 0ms linear; --lr-attachment-chip-bg: rgb(1, 2, 3); --lr-attachment-chip-accent: rgb(4, 5, 6)">
      <lr-attachment-chip status="uploading" name="report.pdf"></lr-attachment-chip>
    </div>
  `);
  const el = wrapper.querySelector('lr-attachment-chip') as LyraAttachmentChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const status = el.shadowRoot!.querySelector('[part="status-text"]') as HTMLElement;
  expect(getComputedStyle(base).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(status).color).to.equal('rgb(4, 5, 6)');

  el.style.setProperty('--lr-attachment-chip-bg', 'rgb(7, 8, 9)');
  await waitUntil(() => getComputedStyle(base).backgroundColor === 'rgb(7, 8, 9)');
});

it('keeps every status distinguishable without color in forced-colors mode', async () => {
  await setForcedColors('active');
  try {
    const wrapper = await fixture(html`
      <div>
        <lr-attachment-chip status="pending"></lr-attachment-chip>
        <lr-attachment-chip status="uploading"></lr-attachment-chip>
        <lr-attachment-chip status="error"></lr-attachment-chip>
        <lr-attachment-chip status="success"></lr-attachment-chip>
      </div>
    `);
    const stylesByStatus = new Map(
      Array.from(wrapper.querySelectorAll('lr-attachment-chip')).map((chip) => [
        chip.getAttribute('status'),
        getComputedStyle(chip.shadowRoot!.querySelector('[part="base"]') as HTMLElement),
      ]),
    );
    expect(stylesByStatus.get('pending')!.borderStyle).to.equal('solid');
    expect(stylesByStatus.get('uploading')!.borderStyle).to.equal('dashed');
    expect(stylesByStatus.get('error')!.borderStyle).to.equal('double');
    expect(stylesByStatus.get('success')!.outlineStyle).to.equal('double');
  } finally {
    await setForcedColors('none');
  }
});

for (const dir of ['ltr', 'rtl'] as const) {
  it(`contains long attachment content and all actions in a 320px ${dir} allocation`, async () => {
    const wrapper = await fixture(html`
      <div dir=${dir} style="inline-size: 320px; max-inline-size: 320px; overflow: auto">
        <lr-attachment-chip
          style="max-inline-size: 100%"
          status="error"
          name=${'a'.repeat(500)}
          preview-src="https://example.test/report.pdf"
        ></lr-attachment-chip>
      </div>
    `);
    const el = wrapper.querySelector('lr-attachment-chip') as LyraAttachmentChip;
    const hostRect = el.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    expect(hostRect.width).to.be.at.most(wrapperRect.width + 0.5);
    for (const action of el.shadowRoot!.querySelectorAll<HTMLElement>('button')) {
      const rect = action.getBoundingClientRect();
      expect(rect.left).to.be.at.least(wrapperRect.left - 0.5);
      expect(rect.right).to.be.at.most(wrapperRect.right + 0.5);
    }
  });
}

it('is accessible in the default (empty) state', async () => {
  const el = (await fixture(html`<lr-attachment-chip></lr-attachment-chip>`)) as LyraAttachmentChip;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated uploading state with numeric progress', async () => {
  const el = (await fixture(html`
    <lr-attachment-chip
      id="att-3"
      name="dataset.csv"
      bytes="9830400"
      mime-type="text/csv"
      status="uploading"
      progress="58"
    ></lr-attachment-chip>
  `)) as LyraAttachmentChip;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated error state with a retry button', async () => {
  const el = (await fixture(html`
    <lr-attachment-chip id="att-4" name="invoice.pdf" bytes="102400" mime-type="application/pdf" status="error"></lr-attachment-chip>
  `)) as LyraAttachmentChip;
  await expect(el).to.be.accessible();
});
