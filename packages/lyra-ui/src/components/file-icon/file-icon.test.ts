import { expect, fixture, html } from '@open-wc/testing';
import './file-icon.js';
import type { LyraFileIcon } from './file-icon.js';
import { getFileTypeMetadata, registerFileTypeMetadata } from './file-type-metadata.js';

describe('file type metadata', () => {
  it('covers every presentation category', () => {
    const values = [
      ['application/pdf', 'document'], ['text/csv', 'spreadsheet'], ['application/vnd.ms-powerpoint', 'presentation'],
      ['image/png', 'image'], ['audio/mpeg', 'audio'], ['video/mp4', 'video'], ['application/zip', 'archive'],
      ['application/json', 'code'], ['application/x-unknown', 'generic'],
    ] as const;
    for (const [mimeType, category] of values) expect(getFileTypeMetadata(mimeType).category).to.equal(category);
  });

  it('uses extension fallback only for empty or generic MIME values', () => {
    expect(getFileTypeMetadata('', 'slides.pptx').category).to.equal('presentation');
    expect(getFileTypeMetadata('application/octet-stream', 'photo.png').category).to.equal('image');
    expect(getFileTypeMetadata('application/x-vendor', 'photo.png').category).to.equal('generic');
  });

  it('supports custom MIME mappings', () => {
    registerFileTypeMetadata('application/x-lyra-demo', {
      label: 'Demo',
      icon: 'code',
      category: 'code',
      extensions: ['.lyra'],
    });
    expect(getFileTypeMetadata('application/x-lyra-demo').label).to.equal('Demo');
    expect(getFileTypeMetadata('application/octet-stream', 'example.lyra').label).to.equal('Demo');
  });

  it('gives an explicit MIME type precedence over a conflicting filename extension', () => {
    const metadata = getFileTypeMetadata('application/pdf', 'notes.zip');
    expect(metadata.category).to.equal('document');
    expect(metadata.icon).to.equal('pdf');
  });
});

describe('lyra-file-icon', () => {
  it('renders localized labels and is accessible', async () => {
    const el = await fixture(html`<lyra-file-icon mime-type="application/pdf" variant="label" .strings=${{ fileTypePdf: 'PDF personnalisé' }}></lyra-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('PDF personnalisé');
    await expect(el).to.be.accessible();
  });

  it('supports decorative presentation', async () => {
    const el = await fixture(html`<lyra-file-icon mime-type="image/png" decorative></lyra-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('presentation');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.be.null;
  });

  it('shows a formatted size and folds it into the accessible name', async () => {
    const el = await fixture(html`<lyra-file-icon mime-type="application/pdf" variant="label" size="2415919"></lyra-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="size"]')!.textContent).to.equal('2.3 MB');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF (2.3 MB)');
  });

  it('renders no size part when size is unset', async () => {
    const el = await fixture(html`<lyra-file-icon mime-type="application/pdf" variant="label"></lyra-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="size"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF');
  });

  it('renders no "NaN B" size part when size is set to an invalid value', async () => {
    const el = (await fixture(
      html`<lyra-file-icon mime-type="application/pdf" variant="label" size="not-a-number"></lyra-file-icon>`,
    )) as LyraFileIcon;
    expect(Number.isNaN(el.size)).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="size"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF');
  });

  it('exposes the raw MIME type as a title tooltip', async () => {
    const el = await fixture(html`<lyra-file-icon mime-type="application/pdf"></lyra-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('title')).to.equal('application/pdf');
  });

  it('truncates long badge text instead of overflowing the fixed-size badge', async () => {
    const el = await fixture(html`<lyra-file-icon mime-type="application/msword"></lyra-file-icon>`);
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    const style = getComputedStyle(icon);
    expect(style.overflow).to.equal('hidden');
    expect(style.textOverflow).to.equal('ellipsis');
    expect(style.whiteSpace).to.equal('nowrap');
  });
});
