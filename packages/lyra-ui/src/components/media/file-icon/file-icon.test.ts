import { expect, fixture, html } from '@open-wc/testing';
import './file-icon.js';
import type { LyraFileIcon } from './file-icon.js';
import {
  createFileTypeMetadataRegistry,
  getFileTypeMetadata,
  type LyraFileTypeMetadataEntry,
  type LyraFileTypeMetadataRegistry,
  type LyraResolvedFileTypeMetadata,
} from './file-type-metadata.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

// Every rendering assertion below that is sensitive to font metrics or baseline synthesis
// includes the engine name, so a failure is attributable without re-running every engine.
function engineLabel(): string {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'WebKit';
  return 'Chromium';
}

/** A zero-size inline-block appended at the end of an inline run sits exactly on that run's
 *  baseline (its own baseline, with no in-flow content, is its bottom margin edge; the default
 *  `vertical-align: baseline` then aligns that edge with the line's baseline). Returns the
 *  viewport Y coordinate of the baseline. */
function probeBaselineY(afterNode: Element): number {
  const probe = document.createElement('span');
  probe.style.display = 'inline-block';
  probe.style.inlineSize = '0';
  probe.style.blockSize = '0';
  afterNode.append(probe);
  const y = probe.getBoundingClientRect().top;
  probe.remove();
  return y;
}

/** Sub-pixel fit: a `Range` over the token's text node reports the full run even while an
 *  ellipsis is painted, unlike integer `scrollWidth`/`clientWidth`. */
function measureTokenFit(el: LyraFileIcon): { token: HTMLElement; textRect: DOMRect; boxRect: DOMRect } {
  const token = el.shadowRoot!.querySelector<HTMLElement>('.token')!;
  const range = document.createRange();
  range.selectNodeContents(token);
  return { token, textRect: range.getBoundingClientRect(), boxRect: token.getBoundingClientRect() };
}

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-file-icon', 'size');

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
    const registry = createFileTypeMetadataRegistry([{
      mimeTypes: 'application/x-lr-demo',
      metadata: { label: 'Demo', icon: 'code', category: 'code', extensions: ['.lyra'] },
    }]);
    expect(registry.resolve('application/x-lr-demo').label).to.equal('Demo');
    expect(registry.resolve('application/octet-stream', 'example.lyra').label).to.equal('Demo');
  });

  it('uses bounded longest-suffix lookup for punctuation and multi-dot extensions', () => {
    const registry = createFileTypeMetadataRegistry([
      { mimeTypes: 'application/x-short', metadata: { label: 'GZip', icon: 'archive', category: 'archive', extensions: ['.gz'] } },
      { mimeTypes: 'application/x-long', metadata: { label: 'Tarball', icon: 'archive', category: 'archive', extensions: ['.tar.gz'] } },
      { mimeTypes: 'text/x-cpp', metadata: { label: 'C++', icon: 'code', category: 'code', extensions: ['.c++'] } },
      { mimeTypes: 'text/x-dash', metadata: { label: 'Dash', icon: 'code', category: 'code', extensions: ['.foo-bar'] } },
    ]);
    expect(registry.resolve('', 'bundle.tar.gz').label).to.equal('Tarball');
    expect(registry.resolve('', 'source.c++').label).to.equal('C++');
    expect(registry.resolve('', 'name.foo-bar').label).to.equal('Dash');
  });

  it('is immune to prototype keys and snapshots/freezes caller records', () => {
    const extensions = ['.safe'];
    const metadata = { label: 'Safe', icon: 'code', category: 'code', extensions } as const;
    const entries: LyraFileTypeMetadataEntry[] = [
      { mimeTypes: ['__proto__', 'constructor', 'application/x-safe'], metadata },
    ];
    const registry = createFileTypeMetadataRegistry(entries);
    extensions.push('.mutated');
    entries.length = 0;
    const resolved = registry.resolve('application/x-safe');
    expect(resolved.label).to.equal('Safe');
    expect(resolved.extensions).to.deep.equal(['.safe']);
    expect(Object.isFrozen(resolved)).to.be.true;
    expect(Object.isFrozen(resolved.extensions)).to.be.true;
    expect(registry.resolve('__proto__').category).to.equal('generic');
    expect(registry.resolve('', 'x.mutated').category).to.equal('generic');
  });

  it('reconciles replacement extensions and uses deterministic last-entry collision wins', () => {
    const registry = createFileTypeMetadataRegistry([
      { mimeTypes: 'application/x-demo', metadata: { label: 'Old', icon: 'file', category: 'generic', extensions: ['.old', '.same'] } },
      { mimeTypes: 'application/x-other', metadata: { label: 'Other', icon: 'text', category: 'document', extensions: ['.same'] } },
      { mimeTypes: 'application/x-demo', metadata: { label: 'New', icon: 'code', category: 'code', extensions: ['.new'] } },
    ]);
    expect(registry.resolve('application/x-demo').label).to.equal('New');
    expect(registry.resolve('', 'x.old').category).to.equal('generic');
    expect(registry.resolve('', 'x.same').label).to.equal('Other');
    expect(registry.resolve('', 'x.new').label).to.equal('New');
  });

  it('gives an explicit MIME type precedence over a conflicting filename extension', () => {
    const metadata = getFileTypeMetadata('application/pdf', 'notes.zip');
    expect(metadata.category).to.equal('document');
    expect(metadata.icon).to.equal('pdf');
  });
});

describe('lr-file-icon', () => {
  it('renders localized labels and is accessible', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="application/pdf" mode="label" .strings=${{ fileTypePdf: 'PDF personnalisé' }}></lr-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('PDF personnalisé');
    await expect(el).to.be.accessible();
  });

  it('projects consumer metadata label and description verbatim through an injected registry', async () => {
    const registry = createFileTypeMetadataRegistry([{
      mimeTypes: 'application/x-analysis',
      metadata: {
        label: 'My authored label',
        description: 'My authored description',
        icon: 'code',
        category: 'code',
        extensions: ['.analysis'],
      },
    }]);
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/x-analysis" mode="label" .registry=${registry}></lr-file-icon>
    `);
    expect(el.shadowRoot!.querySelector('[part="icon"]')!.textContent).to.not.include('My authored label');
    expect(el.shadowRoot!.querySelector('[part="icon"] .token') === null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('My authored label');
    expect(el.shadowRoot!.querySelector('[part="description"]')!.textContent).to.equal('My authored description');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-describedby')).to.equal('metadata-description');
    const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
    const probe = document.createElement('span');
    probe.style.color = 'var(--lr-color-text-quiet)';
    el.shadowRoot!.append(probe);
    expect(getComputedStyle(description).color).to.equal(getComputedStyle(probe).color);
    probe.remove();
  });

  it('references consumer metadata descriptions only while label mode renders their target', async () => {
    const registry = createFileTypeMetadataRegistry([{
      mimeTypes: 'application/x-analysis',
      metadata: {
        label: 'Analysis',
        description: 'Analysis document',
        icon: 'code',
        category: 'code',
      },
    }]);
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/x-analysis" .registry=${registry}></lr-file-icon>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    expect(el.mode).to.equal('icon');
    expect(el.shadowRoot!.querySelectorAll('[part="description"]').length).to.equal(0);
    expect(base.hasAttribute('aria-describedby')).to.equal(false);

    el.mode = 'label';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('#metadata-description').length).to.equal(1);
    expect(base.getAttribute('aria-describedby')).to.equal('metadata-description');

    el.mode = 'icon';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('#metadata-description').length).to.equal(0);
    expect(base.hasAttribute('aria-describedby')).to.equal(false);
    await expect(el).to.be.accessible();
  });

  it('normalizes invalid mode and preserves an explicit empty host aria-label', async () => {
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/pdf" mode="unknown" aria-label=""></lr-file-icon>
    `);
    expect(el.mode).to.equal('icon');
    expect(el.getAttribute('mode')).to.equal('icon');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
  });

  it('supports decorative presentation', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="image/png" decorative></lr-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('presentation');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.be.null;
  });

  it('shows a formatted size and folds it into the accessible name', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="application/pdf" mode="label" bytes="2415919"></lr-file-icon>`);
    expect(el.shadowRoot!.querySelector('[part="size"]')!.textContent).to.equal('2.3 MB');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF (2.3 MB)');
  });

  it('lets a host aria-label win on the image owner without replacing the visible label', async () => {
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon
        aria-label="Author file description"
        label="Visible file label"
        mime-type="application/pdf"
        mode="label"
        bytes="2415919"
      ></lr-file-icon>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-label')).to.equal('Author file description');
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Visible file label');
  });

  it('never leaves the default icon-only role="img" unnamed when label is explicitly empty', async () => {
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/pdf" label=""></lr-file-icon>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('img');
    expect(base.getAttribute('aria-label')).to.equal('PDF');
  });

  it('still suppresses only the visible mode="label" text when label is explicitly empty', async () => {
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/pdf" mode="label" label=""></lr-file-icon>
    `);
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('');
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF');
  });

  it('formats the size number with the effective locale', async () => {
    const el = await fixture(html`
      <lr-file-icon lang="ar-EG" mime-type="application/pdf" mode="label" bytes="2415919"></lr-file-icon>
    `);
    expect(el.shadowRoot!.querySelector('[part="size"]')!.textContent).to.contain('٢٫٣');
  });

  it('renders no size part when bytes is unset', async () => {
    const el = await fixture(html`<lr-file-icon mime-type="application/pdf" mode="label"></lr-file-icon>`);
    expect((el.shadowRoot!.querySelector('[part="size"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF');
  });

  it('exposes no `size` property, and a stale size="2415919" renders nothing', async () => {
    // `size` named a byte count here while naming a tier on the shared size ladder everywhere else
    // in the library. The rename is not aliased, so a stale attribute must be inert rather than
    // half-working.
    const el = (await fixture(
      html`<lr-file-icon mime-type="application/pdf" mode="label" size="2415919"></lr-file-icon>`,
    )) as LyraFileIcon;
    expect('size' in el, 'size is gone from the instance').to.be.false;
    expect(el.bytes).to.equal(0);
    expect((el.shadowRoot!.querySelector('[part="size"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('PDF');
  });

  it('renders no "NaN B" size part when bytes is set to an invalid value', async () => {
    const el = (await fixture(
      html`<lr-file-icon mime-type="application/pdf" mode="label" bytes="not-a-number"></lr-file-icon>`,
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
    expect(icon.querySelector('.token')?.textContent).to.equal('DOC');
    expect(getComputedStyle(icon.querySelector('.token')!).whiteSpace).to.equal('nowrap');
  });

  it('keeps localized labels out of the icon badge and renders a format token', async () => {
    for (const [language, label] of [['en', 'Code file'], ['fr', 'Fichier de code']] as const) {
      for (const direction of ['ltr', 'rtl'] as const) {
        for (const size of ['2rem', '1rem']) {
          const el = await fixture<LyraFileIcon>(html`
            <lr-file-icon
              lang=${language}
              dir=${direction}
              mime-type="application/json"
              style=${`--lr-file-icon-size: ${size}`}
              .strings=${language === 'fr' ? { fileTypeCode: label } : {}}
            ></lr-file-icon>
          `);
          const icon = el.shadowRoot!.querySelector<HTMLElement>('[part="icon"]')!;
          const token = icon.querySelector<HTMLElement>('.token');
          expect(token?.textContent, `${language}/${direction}/${size}`).to.equal('JSON');
          if (size === '1rem') expect(getComputedStyle(token!).display).to.equal('none');
          expect(icon.textContent).to.not.include(label);
          expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
            language === 'fr' ? 'Fichier de code' : label,
          );
        }
      }
    }
  });

  it('uses abbreviation and filename extension tokens without localizing them', async () => {
    const registry = createFileTypeMetadataRegistry([
      {
        mimeTypes: 'application/x-authored',
        metadata: { label: 'Authored format', abbreviation: '  Md  ', icon: 'code', category: 'code' },
      },
    ]);
    const authored = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/x-authored" .registry=${registry}></lr-file-icon>
    `);
    expect(authored.shadowRoot!.querySelector('.token')!.textContent).to.equal('Md');

    const filename = await fixture<LyraFileIcon>(html`
      <lr-file-icon name="scan.jpeg" mime-type="application/octet-stream"></lr-file-icon>
    `);
    expect(filename.shadowRoot!.querySelector('.token')!.textContent).to.equal('JPEG');
  });

  it('--lr-file-icon-bg / --lr-file-icon-color retint the format badge independently of the shared brand tokens', async () => {
    const el = await fixture(html`
      <lr-file-icon
        mime-type="application/pdf"
        style="--lr-file-icon-bg: rgb(10, 20, 30); --lr-file-icon-color: rgb(40, 50, 60)"
      ></lr-file-icon>
    `);
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(getComputedStyle(icon).backgroundColor).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(icon).color).to.equal('rgb(40, 50, 60)');
  });

  it('hides the complete label badge subtree from accessibility APIs when decorative', async () => {
    const el = await fixture(html`
      <lr-file-icon mime-type="application/pdf" mode="label" bytes="2415919" decorative></lr-file-icon>
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
          mode="label"
          label=${'Document'.repeat(200)}
          bytes="2415919"
        ></lr-file-icon>
      </div>
    `)) as HTMLElement;
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  });

  it('contains an unbroken long label and description inside a 280px allocation under dir="rtl"', async () => {
    const registry = createFileTypeMetadataRegistry([{
      mimeTypes: 'application/x-analysis',
      metadata: {
        label: 'Analysis',
        description: 'AnUnbrokenTranslatedDescriptionWithNoBreakOpportunity'.repeat(20),
        icon: 'code',
        category: 'code',
      },
    }]);
    const wrapper = (await fixture(html`
      <div dir="rtl" style="inline-size: 280px">
        <lr-file-icon
          style="max-inline-size: 100%"
          mime-type="application/x-analysis"
          mode="label"
          label=${'Document'.repeat(200)}
          bytes="2415919"
          .registry=${registry}
        ></lr-file-icon>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-file-icon') as LyraFileIcon;
    expect(el.matches(':dir(rtl)')).to.be.true;
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  });
});

describe('lr-file-icon badge token fit across the built-in registry (T3)', () => {
  // One MIME type per built-in record (37 total): the badge token it resolves to, and the size
  // tier `estimatedTokenEm` buckets it into. Every one must fit inside the default-size badge
  // without hitting its own ellipsis -- only a custom `abbreviation` (T4) or a narrower
  // `--lr-file-icon-size` (T2) is meant to overflow it.
  const BUILT_IN_TOKEN_FIT_CASES: readonly (readonly [mimeType: string, token: string, tier: 'short' | 'long'])[] = [
    ['application/pdf', 'PDF', 'short'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCX', 'long'],
    ['application/msword', 'DOC', 'short'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'XLSX', 'long'],
    ['application/vnd.ms-excel', 'XLS', 'short'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PPTX', 'long'],
    ['application/vnd.ms-powerpoint', 'PPT', 'short'],
    ['application/vnd.oasis.opendocument.text', 'ODT', 'short'],
    ['application/vnd.oasis.opendocument.spreadsheet', 'ODS', 'short'],
    ['application/vnd.oasis.opendocument.presentation', 'ODP', 'short'],
    ['application/rtf', 'RTF', 'short'],
    ['application/epub+zip', 'EPUB', 'long'],
    ['application/x-mobipocket-ebook', 'MOBI', 'long'],
    ['text/plain', 'TXT', 'short'],
    ['text/csv', 'CSV', 'short'],
    ['text/markdown', 'MD', 'short'],
    ['text/html', 'HTML', 'long'],
    ['text/xml', 'XML', 'short'],
    ['application/json', 'JSON', 'long'],
    ['application/yaml', 'YAML', 'long'],
    ['application/zip', 'ZIP', 'short'],
    ['application/gzip', 'GZ', 'short'],
    ['application/x-tar', 'TAR', 'short'],
    ['application/x-7z-compressed', '7Z', 'short'],
    ['application/vnd.rar', 'RAR', 'short'],
    ['image/jpeg', 'JPG', 'short'],
    ['image/png', 'PNG', 'short'],
    ['image/gif', 'GIF', 'short'],
    ['image/webp', 'WEBP', 'long'],
    ['image/svg+xml', 'SVG', 'short'],
    ['image/tiff', 'TIF', 'short'],
    ['image/bmp', 'BMP', 'short'],
    ['image/heic', 'HEIC', 'long'],
    ['audio/mpeg', 'MP3', 'short'],
    // `WAV`'s W+A+V combination measures wider in Firefox/WebKit than the per-character estimate
    // predicted (it overflowed the short tier's 12px badge by a few tenths of a pixel on those
    // engines); `estimatedTokenEm` now buckets `A`/`V` above the generic weight so it lands here.
    ['audio/wav', 'WAV', 'long'],
    ['video/mp4', 'MP4', 'short'],
    ['video/webm', 'WEBM', 'long'],
  ];

  it('T3: covers all 37 built-in records, 25 short-tier and 12 long-tier', () => {
    expect(BUILT_IN_TOKEN_FIT_CASES).to.have.length(37);
    expect(BUILT_IN_TOKEN_FIT_CASES.filter(([, , tier]) => tier === 'short')).to.have.length(25);
    expect(BUILT_IN_TOKEN_FIT_CASES.filter(([, , tier]) => tier === 'long')).to.have.length(12);
  });

  for (const [mimeType, expectedToken, tier] of BUILT_IN_TOKEN_FIT_CASES) {
    it(`fits the ${expectedToken} token for ${mimeType} inside its ${tier}-tier badge`, async () => {
      const el = await fixture<LyraFileIcon>(html`<lr-file-icon mime-type=${mimeType}></lr-file-icon>`);
      const face = el.shadowRoot!.querySelector<HTMLElement>('.face')!;
      expect(face.dataset['token'], `${engineLabel()}: ${mimeType} tier`).to.equal(tier);
      const { token, textRect, boxRect } = measureTokenFit(el);
      expect(token.textContent).to.equal(expectedToken);
      expect(
        textRect.width,
        `${engineLabel()}: ${expectedToken} overflowed its ${tier}-tier badge`,
      ).to.be.at.most(boxRect.width + 0.01);
      if (tier === 'short') {
        const probe = document.createElement('span');
        probe.style.fontSize = 'var(--lr-font-size-xs)';
        el.shadowRoot!.append(probe);
        const expectedFontSize = getComputedStyle(probe).fontSize;
        probe.remove();
        expect(
          getComputedStyle(token).fontSize,
          `${engineLabel()}: ${expectedToken} short-tier font-size`,
        ).to.equal(expectedFontSize);
      }
    });
  }

  it('T3: fits a name-derived long-tier token resolved from an empty MIME type', async () => {
    for (const [name, expectedToken] of [['home-movie.wmv', 'WMV'], ['podcast.wma', 'WMA']] as const) {
      const el = await fixture<LyraFileIcon>(html`<lr-file-icon name=${name}></lr-file-icon>`);
      const face = el.shadowRoot!.querySelector<HTMLElement>('.face')!;
      expect(face.dataset['token'], `${engineLabel()}: ${name} tier`).to.equal('long');
      const { token, textRect, boxRect } = measureTokenFit(el);
      expect(token.textContent, name).to.equal(expectedToken);
      expect(textRect.width, `${engineLabel()}: ${expectedToken} overflowed`).to.be.at.most(boxRect.width + 0.01);
    }
  });

  it('T3: fits a consumer abbreviation at the long-tier size', async () => {
    const registry = createFileTypeMetadataRegistry([{
      mimeTypes: 'application/x-mmm',
      metadata: { label: 'Triple M', abbreviation: 'MMM', icon: 'code', category: 'code' },
    }]);
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/x-mmm" .registry=${registry}></lr-file-icon>
    `);
    const face = el.shadowRoot!.querySelector<HTMLElement>('.face')!;
    expect(face.dataset['token'], engineLabel()).to.equal('long');
    const { token, textRect, boxRect } = measureTokenFit(el);
    expect(token.textContent).to.equal('MMM');
    expect(textRect.width, `${engineLabel()}: MMM overflowed`).to.be.at.most(boxRect.width + 0.01);
  });
});

describe('lr-file-icon badge token start-alignment, RTL and vertical containment (T4)', () => {
  it('T4: truncates an 8-code-point abbreviation with a start-aligned ellipsis, not a centered clip', async () => {
    const registry = createFileTypeMetadataRegistry([{
      mimeTypes: 'application/x-authored-max',
      metadata: { label: 'Authored max', abbreviation: 'AUTHORED', icon: 'code', category: 'code' },
    }]);
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/x-authored-max" .registry=${registry}></lr-file-icon>
    `);
    const { token, textRect, boxRect } = measureTokenFit(el);
    expect(token.textContent).to.equal('AUTHORED');
    expect(getComputedStyle(token).textOverflow, engineLabel()).to.equal('ellipsis');
    expect(
      textRect.width,
      `${engineLabel()}: the full run must overflow to exercise the ellipsis`,
    ).to.be.greaterThan(boxRect.width);
    expect(
      Math.abs(textRect.left - boxRect.left),
      `${engineLabel()}: clipped from the end, not centered`,
    ).to.be.lessThan(0.5);
  });

  it('T4: right-aligns a Hebrew abbreviation resolved by dir="auto"', async () => {
    const registry = createFileTypeMetadataRegistry([{
      mimeTypes: 'application/x-hebrew',
      metadata: { label: 'Hebrew file', abbreviation: 'קובץ', icon: 'code', category: 'code' },
    }]);
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/x-hebrew" .registry=${registry}></lr-file-icon>
    `);
    const { token, textRect, boxRect } = measureTokenFit(el);
    expect(token.textContent).to.equal('קובץ');
    expect(
      getComputedStyle(token).direction,
      `${engineLabel()}: dir="auto" must resolve rtl from Hebrew content`,
    ).to.equal('rtl');
    expect(
      Math.abs(textRect.right - boxRect.right),
      `${engineLabel()}: right-aligned, not left-clipped`,
    ).to.be.lessThan(0.5);
  });

  it('T4: keeps a Latin token left-to-right and fitting under a dir="rtl" ancestor', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir="rtl">
        <lr-file-icon
          mime-type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ></lr-file-icon>
      </div>
    `);
    const el = wrapper.querySelector<LyraFileIcon>('lr-file-icon')!;
    const { token, textRect, boxRect } = measureTokenFit(el);
    expect(token.textContent).to.equal('DOCX');
    expect(getComputedStyle(token).direction, engineLabel()).to.equal('ltr');
    expect(
      textRect.width,
      `${engineLabel()}: DOCX overflowed under a dir="rtl" ancestor`,
    ).to.be.at.most(boxRect.width + 0.01);
  });

  for (const abbreviation of ['jpg', 'ÅÄÖ', 'ÉPUB', 'קובץ']) {
    it(`T4: keeps the vertical ink of a ${abbreviation} abbreviation inside the token box`, async () => {
      const registry = createFileTypeMetadataRegistry([{
        mimeTypes: 'application/x-ink-probe',
        metadata: { label: 'Ink probe', abbreviation, icon: 'code', category: 'code' },
      }]);
      const el = await fixture<LyraFileIcon>(html`
        <lr-file-icon mime-type="application/x-ink-probe" .registry=${registry}></lr-file-icon>
      `);
      const token = el.shadowRoot!.querySelector<HTMLElement>('.token')!;
      expect(token.textContent).to.equal(abbreviation);
      const baseline = probeBaselineY(token);
      const box = token.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      ctx.font = getComputedStyle(token).font;
      const metrics = ctx.measureText(abbreviation);
      const inkTop = baseline - metrics.actualBoundingBoxAscent;
      const inkBottom = baseline + metrics.actualBoundingBoxDescent;
      expect(
        inkTop,
        `${engineLabel()}: ${abbreviation} ink clipped above the token box`,
      ).to.be.at.least(box.top - 0.5);
      expect(
        inkBottom,
        `${engineLabel()}: ${abbreviation} ink clipped below the token box`,
      ).to.be.at.most(box.bottom + 0.5);
    });
  }
});

describe('lr-file-icon badge token resolution edge cases (T5)', () => {
  it('T5: keeps a .ini extension token as INI under lang="tr", with no CSS text-transform doing the casing', async () => {
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon lang="tr" name="config.ini" mime-type="application/octet-stream"></lr-file-icon>
    `);
    const token = el.shadowRoot!.querySelector<HTMLElement>('.token')!;
    expect(token.textContent, 'the Turkish dotless/dotted-I mapping must not touch this token').to.equal('INI');
    expect(getComputedStyle(token).textTransform, engineLabel()).to.equal('none');
  });

  it('T5: degrades to the glyph without throwing when a directly implemented registry record throws from its abbreviation getter', async () => {
    const hostileMetadata = {
      label: 'Hostile record',
      icon: 'code',
      category: 'code',
      provenance: 'consumer',
      extensions: [5, {}],
      get abbreviation(): string {
        throw new Error('hostile abbreviation getter');
      },
    } as unknown as LyraResolvedFileTypeMetadata;
    const hostileRegistry: LyraFileTypeMetadataRegistry = {
      resolve: () => hostileMetadata,
    };
    const el = await fixture<LyraFileIcon>(html`
      <lr-file-icon mime-type="application/x-hostile" .registry=${hostileRegistry}></lr-file-icon>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(
      base.getAttribute('aria-label'),
      'label and accessible name still come from the record',
    ).to.equal('Hostile record');
    const face = el.shadowRoot!.querySelector<HTMLElement>('.face')!;
    expect(
      face.dataset['token'],
      'a throwing abbreviation getter must degrade to the glyph, not throw',
    ).to.equal('none');
    expect(face.querySelector('.token') === null, 'a throwing getter must render no token').to.be.true;
    expect(getComputedStyle(face.querySelector('.glyph')!).display).to.equal('block');
    await expect(el).to.be.accessible();
  });
});

describe('lr-file-icon forced-colors contract (T6)', () => {
  it('T6: forces the glyph stroke and token color to CanvasText only where the engine actually forces colors', async function () {
    await setForcedColors('active');
    try {
      expect(matchMedia('(forced-colors: active)').matches, engineLabel()).to.be.true;

      // Independent control that never reads the component under test: a glyph that fails to
      // follow forced colors must not be able to skip its own assertions. WebKit matches the
      // forced-colors media query under emulation without forcing any rendered color, which
      // this control -- keeping its authored color -- is what actually detects.
      const control = document.createElement('span');
      control.style.color = 'rgb(40, 50, 60)';
      document.body.append(control);
      const controlColor = getComputedStyle(control).color;
      control.remove();
      const engineForcesColors = controlColor !== 'rgb(40, 50, 60)';
      if (!engineForcesColors) this.skip();

      const canvasTextProbe = document.createElement('span');
      canvasTextProbe.style.color = 'CanvasText';
      document.body.append(canvasTextProbe);
      const canvasText = getComputedStyle(canvasTextProbe).color;
      canvasTextProbe.remove();

      const generic = await fixture<LyraFileIcon>(html`
        <lr-file-icon
          mime-type="application/x-unrecognized"
          style="--lr-file-icon-color: rgb(40, 50, 60)"
        ></lr-file-icon>
      `);
      const glyphPath = generic.shadowRoot!.querySelector<SVGPathElement>('.glyph path')!;
      expect(getComputedStyle(glyphPath).stroke, engineLabel()).to.equal(canvasText);
      expect(getComputedStyle(glyphPath).stroke).to.not.equal('rgb(40, 50, 60)');
      const glyphBox = generic.shadowRoot!.querySelector<HTMLElement>('.glyph')!.getBoundingClientRect();
      expect(glyphBox.width, `${engineLabel()}: glyph box collapsed`).to.be.greaterThan(0);
      expect(glyphBox.height, `${engineLabel()}: glyph box collapsed`).to.be.greaterThan(0);

      const pdf = await fixture<LyraFileIcon>(html`
        <lr-file-icon mime-type="application/pdf" style="--lr-file-icon-color: rgb(40, 50, 60)"></lr-file-icon>
      `);
      const { token, textRect, boxRect } = measureTokenFit(pdf);
      expect(getComputedStyle(token).color, engineLabel()).to.equal(canvasText);
      expect(getComputedStyle(token).color).to.not.equal('rgb(40, 50, 60)');
      expect(getComputedStyle(token).display, `${engineLabel()}: token must stay visible`).to.not.equal('none');
      expect(
        textRect.width,
        `${engineLabel()}: PDF token overflowed under forced colors`,
      ).to.be.at.most(boxRect.width + 0.01);
    } finally {
      await setForcedColors('none');
    }
  });
});

describe('lr-file-icon baseline contract (T9)', () => {
  async function bottomEdgeBaselineOffset(mimeType: string, hostStyle = ''): Promise<number> {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="display: flex; align-items: baseline">
        <lr-file-icon mime-type=${mimeType} style=${hostStyle}></lr-file-icon>
        <span>Sibling label</span>
      </div>
    `);
    const el = wrapper.querySelector<LyraFileIcon>('lr-file-icon')!;
    const sibling = wrapper.querySelector('span')!;
    const baseline = probeBaselineY(sibling);
    return baseline - el.getBoundingClientRect().bottom;
  }

  it('T9: exports a baseline at the badge bottom edge for the token state, the glyph state, and a small size', async () => {
    const borderProbe = document.createElement('div');
    borderProbe.style.borderTopStyle = 'solid';
    borderProbe.style.borderTopWidth = 'var(--lr-border-width-thin)';
    document.body.append(borderProbe);
    const borderWidth = Number.parseFloat(getComputedStyle(borderProbe).borderTopWidth);
    borderProbe.remove();

    const cases: readonly (readonly [label: string, mimeType: string, hostStyle: string])[] = [
      ['token state', 'application/pdf', ''],
      ['glyph state', 'application/x-unrecognized', ''],
      ['small size', 'application/pdf', '--lr-file-icon-size: 1rem'],
    ];
    for (const [label, mimeType, hostStyle] of cases) {
      const offset = await bottomEdgeBaselineOffset(mimeType, hostStyle);
      expect(Math.abs(offset), `${engineLabel()}: ${label}`).to.be.at.most(borderWidth + 0.5);
    }
  });

  it('T9: places the host at the same inline offset from following text in both the token and glyph states', async () => {
    async function offsetFromFollowingText(mimeType: string): Promise<number> {
      const wrapper = await fixture<HTMLElement>(html`
        <p style="margin: 0"><lr-file-icon mime-type=${mimeType}></lr-file-icon>Following text</p>
      `);
      const el = wrapper.querySelector<LyraFileIcon>('lr-file-icon')!;
      const textNode = wrapper.lastChild as Text;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 1);
      return range.getBoundingClientRect().top - el.getBoundingClientRect().top;
    }
    const tokenOffset = await offsetFromFollowingText('application/pdf');
    const glyphOffset = await offsetFromFollowingText('application/x-unrecognized');
    expect(Math.abs(tokenOffset - glyphOffset), engineLabel()).to.be.lessThan(0.5);
  });
});

describe('file type metadata registry input validation', () => {
  // Consumer entries are untrusted: a malformed record must be dropped whole rather than
  // half-installed, and it must never displace the built-in record it collides with.
  const VALID = { label: 'Custom', icon: 'code', category: 'code' } as const;
  const asEntry = (value: unknown) => value as LyraFileTypeMetadataEntry;

  const invalidMimeTokens: [label: string, mimeTypes: unknown][] = [
    ['a non-string MIME token', 42],
    ['a MIME token carrying no slash', 'notamime'],
    ['a MIME token over the length ceiling', `application/${'x'.repeat(300)}`],
    ['an empty MIME token', '   '],
  ];

  for (const [label, mimeTypes] of invalidMimeTokens) {
    it(`drops an entry with ${label}`, () => {
      const registry = createFileTypeMetadataRegistry([
        asEntry({ mimeTypes, metadata: VALID }),
      ]);
      expect(registry.resolve(String(mimeTypes)).label).to.equal('File');
    });
  }

  const invalidMetadata: [label: string, metadata: unknown][] = [
    ['an unknown icon', { ...VALID, icon: 'nope' }],
    ['an unknown category', { ...VALID, category: 'nope' }],
    ['an empty label', { ...VALID, label: '' }],
    ['a label over the length ceiling', { ...VALID, label: 'x'.repeat(513) }],
    ['a non-string description', { ...VALID, description: 5 }],
    ['a description over the length ceiling', { ...VALID, description: 'x'.repeat(2049) }],
    ['a non-string abbreviation', { ...VALID, abbreviation: 5 }],
    ['an abbreviation over the code-point ceiling', { ...VALID, abbreviation: 'ABCDEFGHI' }],
    ['a null metadata record', null],
  ];

  for (const [label, metadata] of invalidMetadata) {
    it(`keeps the built-in record when a consumer entry carries ${label}`, () => {
      const registry = createFileTypeMetadataRegistry([
        asEntry({ mimeTypes: 'application/pdf', metadata }),
      ]);
      expect(registry.resolve('application/pdf').label).to.equal('PDF');
    });
  }

  it('accepts a MIME token carrying parameters by matching on the bare type', () => {
    const registry = createFileTypeMetadataRegistry([
      asEntry({ mimeTypes: 'text/x-custom; charset=utf-8', metadata: VALID }),
    ]);
    expect(registry.resolve('text/x-custom').label).to.equal('Custom');
  });

  it('trims and snapshots abbreviations, while treating blank values as absent', () => {
    const registry = createFileTypeMetadataRegistry([
      asEntry({ mimeTypes: 'text/x-trimmed', metadata: { ...VALID, abbreviation: '  PDF  ' } }),
      asEntry({ mimeTypes: 'text/x-blank', metadata: { ...VALID, abbreviation: '   ', extensions: ['.lyra'] } }),
    ]);
    const trimmed = registry.resolve('text/x-trimmed');
    expect(trimmed.abbreviation).to.equal('PDF');
    expect(Object.isFrozen(trimmed)).to.be.true;
    const blank = registry.resolve('text/x-blank');
    expect('abbreviation' in blank).to.be.false;
    expect(blank.label).to.equal('Custom');
  });

  it('installs an entry whose extensions field is not an array, without extension aliases', () => {
    const registry = createFileTypeMetadataRegistry([
      asEntry({ mimeTypes: 'text/x-custom', metadata: { ...VALID, extensions: 'nope' } }),
    ]);
    expect(registry.resolve('text/x-custom').label).to.equal('Custom');
    expect(registry.resolve('', 'file.nope').label).to.equal('File');
  });

  it('normalizes an extension written without a leading dot', () => {
    const registry = createFileTypeMetadataRegistry([
      asEntry({ mimeTypes: 'text/x-custom', metadata: { ...VALID, extensions: ['xcust'] } }),
    ]);
    expect(registry.resolve('', 'notes.xcust').label).to.equal('Custom');
  });

  it('discards individually malformed extensions while keeping the valid ones', () => {
    const registry = createFileTypeMetadataRegistry([
      asEntry({
        mimeTypes: 'text/x-custom',
        metadata: {
          ...VALID,
          extensions: [42, '.', ' ', '.has space', '.has/slash', '.has?query', `.${'x'.repeat(80)}`, '.keep'],
        },
      }),
    ]);
    expect(registry.resolve('', 'notes.keep').label).to.equal('Custom');
    expect(registry.resolve('', 'notes.has space').label).to.equal('File');
  });

  it('preserves the built-in registry when a consumer supplies a throwing iterable', () => {
    const hostile = {
      [Symbol.iterator]() {
        return {
          next() {
            throw new Error('hostile iterable');
          },
        };
      },
    };
    const registry = createFileTypeMetadataRegistry(
      hostile as unknown as readonly LyraFileTypeMetadataEntry[]
    );
    expect(registry.resolve('application/pdf').label).to.equal('PDF');
  });

  it('releases the extension aliases a replaced MIME record previously owned', () => {
    const registry = createFileTypeMetadataRegistry([
      asEntry({
        mimeTypes: 'application/pdf',
        metadata: { label: 'Portable Doc', icon: 'pdf', category: 'document', extensions: ['.portable'] },
      }),
    ]);
    expect(registry.resolve('application/pdf').label).to.equal('Portable Doc');
    expect(registry.resolve('', 'report.pdf').label).to.equal('File');
    expect(registry.resolve('', 'report.portable').label).to.equal('Portable Doc');
  });
});

it('frames the extension tile in the subtle border tier', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-theme-color-surface-border-subtle: rgb(1, 2, 3); --lr-theme-color-surface-border: rgb(7, 8, 9)">
      <lr-file-icon mime-type="application/pdf"></lr-file-icon>
    </div>
  `);
  const el = wrapper.querySelector<LyraFileIcon>('lr-file-icon')!;
  await el.updateComplete;
  const icon = el.shadowRoot!.querySelector<HTMLElement>('[part="icon"]');
  expect(icon === null, 'icon part missing').to.be.false;
  expect(getComputedStyle(icon!).borderTopColor).to.equal('rgb(1, 2, 3)');
});
