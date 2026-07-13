import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './attachment-chip.js';
import type { LyraAttachmentChip } from './attachment-chip.js';
import { formatFileSize } from './attachment-chip.js';

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
  expect(el.progress).to.equal(0);
  expect(el.file).to.be.undefined;
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
