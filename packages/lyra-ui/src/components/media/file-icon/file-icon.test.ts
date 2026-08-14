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
    registerFileTypeMetadata('application/x-lr-demo', {
      label: 'Demo',
      icon: 'code',
      category: 'code',
      extensions: ['.lyra'],
    });
    expect(getFileTypeMetadata('application/x-lr-demo').label).to.equal('Demo');
    expect(getFileTypeMetadata('application/octet-stream', 'example.lyra').label).to.equal('Demo');
  });

  it('gives an explicit MIME type precedence over a conflicting filename extension', () => {
    const metadata = getFileTypeMetadata('application/pdf', 'notes.zip');
    expect(metadata.category).to.equal('document');
    expect(metadata.icon).to.equal('pdf');
  });
});

describe('lr-file-icon', () => {
  it('renders localized labels and is accessible', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="application/pdf" variant="label" .strings=${{ fileTypePdf: 'PDF personnalisé' }}></lr-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('PDF personnalisé');
    await expect(el).to.be.accessible();
  });

  it('supports decorative presentation', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="image/png" decorative></lr-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('presentation');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.be.null;
  });

  it('shows a formatted size and folds it into the accessible name', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="application/pdf" variant="label" bytes="2415919"></lr-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="size"]')!.textContent).to.equal('2.3 MB');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF (2.3 MB)');
  });

  it('lets a host aria-label win on the image owner without replacing the visible label', async () => {
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon
        aria-label="Author file description"
        label="Visible file label"
        mime-type="application/pdf"
        variant="label"
        bytes="2415919"
      ></lr-file-icon>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-label')).to.equal('Author file description');
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Visible file label');
  });

  it('formats the size number with the effective locale', async () => {
    const el = await fixture(html`
      <lr-file-icon lang="ar-EG" mime-type="application/pdf" variant="label" bytes="2415919"></lr-file-icon>
    `);
    expect(el.shadowRoot!.querySelector('[part="size"]')!.textContent).to.contain('٢٫٣');
  });

  it('renders no size part when bytes is unset', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="application/pdf" variant="label"></lr-file-icon>`);
    expect((el.shadowRoot!.querySelector('[part="size"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF');
  });

  it('exposes no `size` property, and a stale size="2415919" renders nothing', async () => {
    // `size` named a byte count here while naming a tier on the shared size ladder everywhere else
    // in the library. The rename is not aliased, so a stale attribute must be inert rather than
    // half-working.
    const el = (await fixture(
      html`<lr-file-icon mime-type="application/pdf" variant="label" size="2415919"></lr-file-icon>`,
    )) as LyraFileIcon;
    expect('size' in el, 'size is gone from the instance').to.be.false;
    expect(el.bytes).to.equal(0);
    expect((el.shadowRoot!.querySelector('[part="size"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF');
  });

  it('renders no "NaN B" size part when bytes is set to an invalid value', async () => {
    const el = (await fixture(
      html`<lr-file-icon mime-type="application/pdf" variant="label" bytes="not-a-number"></lr-file-icon>`,
    )) as LyraFileIcon;
    expect(Number.isNaN(el.bytes)).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="size"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF');
  });

  it('exposes the raw MIME type as a title tooltip', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="application/pdf"></lr-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('title')).to.equal('application/pdf');
  });

  it('truncates long badge text instead of overflowing the fixed-size badge', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="application/msword"></lr-file-icon>`);
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    const style = getComputedStyle(icon);
    expect(style.overflow).to.equal('hidden');
    expect(style.textOverflow).to.equal('ellipsis');
    expect(style.whiteSpace).to.equal('nowrap');
  });

  it('hides the complete label badge subtree from accessibility APIs when decorative', async () => {
    const el = await fixture(html`
      <lr-file-icon mime-type="application/pdf" variant="label" bytes="2415919" decorative></lr-file-icon>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-hidden')).to.equal('true');
    expect(base.querySelector('[part="label"]')).to.exist;
    expect(base.querySelector('[part="size"]')).to.exist;
    await expect(el).to.be.accessible();
  });

  it('contains an unbroken public label inside a 280px allocation', async () => {
    const wrapper = (await fixture(html`
      <div style="inline-size: 280px">
        <lr-file-icon
          style="max-inline-size: 100%"
          mime-type="application/pdf"
          variant="label"
          label=${'Document'.repeat(200)}
          bytes="2415919"
        ></lr-file-icon>
      </div>
    `)) as HTMLElement;
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  });
});
