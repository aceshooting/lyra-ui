import { expect, fixture, html } from '@open-wc/testing';
import './file-icon.js';
import type { LyraFileIcon } from './file-icon.js';
import {
  createFileTypeMetadataRegistry,
  getFileTypeMetadata,
  type LyraFileTypeMetadataEntry,
} from './file-type-metadata.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

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
    expect(el.shadowRoot!.querySelector('[part="icon"]')!.textContent).to.equal('My authored label');
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
    expect(style.textOverflow).to.equal('ellipsis');
    expect(style.whiteSpace).to.equal('nowrap');
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
