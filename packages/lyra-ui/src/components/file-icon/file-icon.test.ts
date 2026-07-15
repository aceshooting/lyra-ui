import { expect, fixture, html } from '@open-wc/testing';
import './file-icon.js';
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
});
