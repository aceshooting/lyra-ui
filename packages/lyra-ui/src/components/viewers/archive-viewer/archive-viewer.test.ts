import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { LYRA_DEFAULT_STRINGS } from '../../../internal/localization.js';
import './archive-viewer.js';
import type { LyraArchiveViewer } from './archive-viewer.js';
import type { ArchiveLibraryApi } from './archive-loader.js';

async function buildZip(files: Record<string, string>): Promise<ArrayBuffer> {
  const module = (await import('jszip')) as unknown as { default: new () => ArchiveLibraryApi };
  const zip = new module.default();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
function stubFetch(buffer: ArrayBuffer, ok = true): () => void { const original = window.fetch; window.fetch = (() => Promise.resolve({ ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(buffer) } as Response)) as typeof window.fetch; return () => { window.fetch = original; }; }
function useLibrary(el: LyraArchiveViewer, library: ArchiveLibraryApi | null): void { (el as unknown as { loadLibrary: () => Promise<ArchiveLibraryApi | null> }).loadLibrary = () => Promise.resolve(library); }

describe('archive localization', () => { it('defines archive messages', () => { expect(LYRA_DEFAULT_STRINGS.archiveViewerUnavailable).to.be.a('string'); expect(LYRA_DEFAULT_STRINGS.archiveViewerEmpty).to.be.a('string'); expect(LYRA_DEFAULT_STRINGS.archiveViewerFolder).to.be.a('string'); expect(LYRA_DEFAULT_STRINGS.archiveViewerFile).to.be.a('string'); }); });

describe('lr-archive-viewer', () => {
  it('renders the empty state by default', async () => { const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`); expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.'); });
  it('lists ZIP entries and computes file sizes', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`); const buffer = await buildZip({ 'README.txt': 'hello world', 'src/index.js': 'console.log(1);' }); const restore = stubFetch(buffer);
    try { el.src = 'https://example.test/archive.zip'; await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null || el.shadowRoot!.querySelector('[part="error"]') !== null, undefined, { timeout: 5000 }); expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist; const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: { name: string; dir: boolean; size: number }[] }; await waitUntil(() => list.items?.length === 3, undefined, { timeout: 5000 }); expect(list.items.map((item) => item.name).sort()).to.deep.equal(['README.txt', 'src/', 'src/index.js']); expect(list.items.find((item) => item.name === 'README.txt')!.size).to.equal(11); expect(list.items.find((item) => item.name === 'src/')!.dir).to.be.true; } finally { restore(); }
  });
  it('renders the empty archive message', async () => { const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`); const restore = stubFetch(await buildZip({})); try { el.src = 'https://example.test/empty.zip'; await waitUntil(() => el.shadowRoot!.querySelector('.empty-note')?.textContent === 'This archive is empty.'); } finally { restore(); } });
  it('renders a missing-peer error and rejects unsafe URLs', async () => { const missing = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`); useLibrary(missing, null); const restore = stubFetch(new ArrayBuffer(0)); try { missing.src = 'https://example.test/archive.zip'; await waitUntil(() => missing.shadowRoot!.querySelector('[part="error"]') !== null); expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Archive preview is unavailable.'); } finally { restore(); }
    let called = false; const original = window.fetch; window.fetch = (() => { called = true; return Promise.reject(new Error('unexpected')); }) as typeof window.fetch; try { const unsafe = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer .src=${'java\tscript:alert(1)'}></lr-archive-viewer>`); await unsafe.updateComplete; expect(called).to.be.false; expect(unsafe.shadowRoot!.querySelector('[part="error"]')).to.exist; } finally { window.fetch = original; }
  });
  it('emits one lr-render-error for an unsafe source without fetching it', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const original = window.fetch;
    let fetchCalls = 0;
    let errorCount = 0;
    window.fetch = (() => {
      fetchCalls++;
      return Promise.reject(new Error('unexpected'));
    }) as typeof window.fetch;
    el.addEventListener('lr-render-error', () => errorCount++);
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'java\tscript:alert(1)';
      const event = (await Promise.race([
        eventPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
      ])) as CustomEvent<{ error: unknown }> | null;
      expect(event).to.not.be.null;
      if (!event) return;
      expect(event.detail.error).to.be.instanceOf(Error);
      await el.updateComplete;
      expect(fetchCalls).to.equal(0);
      expect(errorCount).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    } finally {
      window.fetch = original;
    }
  });
  it('applies localized empty strings and is accessible', async () => { const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer .strings=${{ documentPreviewEmpty: 'Aucun {type} à afficher.' }}></lr-archive-viewer>`); expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('Aucun document à afficher.'); await expect(el).to.be.accessible(); });

  it('uses declared entry sizes without decompressing each entry', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    let decompressCalls = 0;
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => void) {
          cb('README.txt', { name: 'README.txt', dir: false, _data: { uncompressedSize: 11 }, async: () => { decompressCalls++; return Promise.resolve(new Uint8Array(11)); } });
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: { name: string; size: number }[] };
      await waitUntil(() => list.items?.length === 1);
      expect(list.items[0].size).to.equal(11);
      expect(decompressCalls).to.equal(0);
    } finally { restore(); }
  });

  it('falls back to decompressing an entry whose header omits the declared size', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => void) {
          const handlers = new Map<string, (...args: unknown[]) => void>();
          cb('README.txt', {
            name: 'README.txt',
            dir: false,
            async: () => Promise.reject(new Error('must use the bounded stream path')),
            internalStream: () => ({
              on(type: string, handler: (...args: unknown[]) => void) {
                handlers.set(type, handler);
                return this;
              },
              resume() {
                handlers.get('data')?.(new Uint8Array(11));
                handlers.get('end')?.();
              },
            }),
          } as never);
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: { name: string; size: number }[] };
      await waitUntil(() => list.items?.length === 1 && list.items[0].size === 11);
      expect(list.items[0].size).to.equal(11);
    } finally { restore(); }
  });

  it('enforces the aggregate uncompressed ceiling when entry headers omit their sizes', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const oversizedLength = 60 * 1024 * 1024;
    let eagerAllocations = 0;
    const streamingFile = (name: string) => ({
      name,
      dir: false,
      async: async () => {
        eagerAllocations++;
        throw new Error('the missing-metadata path must not eagerly allocate the complete entry');
      },
      internalStream: () => {
        const handlers = new Map<string, (...args: unknown[]) => void>();
        return {
          on(type: string, handler: (...args: unknown[]) => void) {
            handlers.set(type, handler);
            return this;
          },
          resume() {
            handlers.get('data')?.({ length: oversizedLength } as Uint8Array);
            handlers.get('end')?.();
          },
        };
      },
    });
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array> }) => void) {
          cb('one.bin', streamingFile('one.bin'));
          cb('two.bin', streamingFile('two.bin'));
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      let errors = 0;
      el.addEventListener('lr-render-error', () => errors++);
      el.src = 'https://example.test/archive.zip';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') !== null || el.shadowRoot!.querySelector('lr-virtual-list') !== null,
      );
      expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
      expect(errors).to.equal(1);
      expect(eagerAllocations).to.equal(0);
    } finally {
      restore();
    }
  });

  it('reloads its source after reconnecting the same element instance', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    useLibrary(el, {
      loadAsync: async () => ({ forEach: () => {} }),
    } as unknown as ArchiveLibraryApi);
    const original = window.fetch;
    let fetchCount = 0;
    window.fetch = (() => {
      fetchCount++;
      return Promise.resolve({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response);
    }) as typeof window.fetch;
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => fetchCount === 1);
      const container = document.createElement('div');
      document.body.append(container);
      container.append(el);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(fetchCount).to.equal(2);
      container.remove();
    } finally {
      window.fetch = original;
    }
  });

  it('emits lr-render-error when the optional archive peer is unavailable', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    useLibrary(el, null);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      let errors = 0;
      el.addEventListener('lr-render-error', () => errors++);
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(errors).to.equal(1);
    } finally {
      restore();
    }
  });

  it('formats entry sizes with the effective locale', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer locale="ar-EG"></lr-archive-viewer>`);
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => void) {
          cb('README.txt', {
            name: 'README.txt',
            dir: false,
            _data: { uncompressedSize: 11 },
            async: async () => new Uint8Array(11),
          });
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="entry-size"]') != null);
      const size = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('[part~="entry-size"]')!;
      expect(size.textContent).to.include(new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(11));
    } finally {
      restore();
    }
  });

  it('names the listing region from `name`, forwards a host aria-label, and omits the role when neither is set', async () => {
    const unnamed = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const base = unnamed.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.be.null;
    expect(base.getAttribute('aria-label')).to.be.null;

    const named = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer name="backup.zip"></lr-archive-viewer>`);
    const namedBase = named.shadowRoot!.querySelector('[part="base"]')!;
    expect(namedBase.getAttribute('role')).to.equal('region');
    expect(namedBase.getAttribute('aria-label')).to.equal('backup.zip');

    const hostLabeled = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer aria-label="Backup contents"></lr-archive-viewer>`);
    const hostLabeledBase = hostLabeled.shadowRoot!.querySelector('[part="base"]')!;
    expect(hostLabeledBase.getAttribute('role')).to.equal('region');
    expect(hostLabeledBase.getAttribute('aria-label')).to.equal('Backup contents');
  });
});

describe('lr-archive-viewer part reachability through the embedded virtual list', () => {
  // Entry rows are produced by this component's `renderItem` but committed into
  // `<lr-virtual-list>`'s OWN shadow root, one boundary deeper than this component's stylesheet.
  // Every assertion reads back the *rendered* result on the real row element -- a declaration that
  // never matches is indistinguishable from a working one when read off the stylesheet source.
  function resolveDeclaration(root: ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    root.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  const listingLibrary = {
    loadAsync: () => Promise.resolve({
      forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => void) {
        cb('src/', { name: 'src/', dir: true, _data: { uncompressedSize: 0 }, async: () => Promise.resolve(new Uint8Array(0)) });
        cb('README.txt', { name: 'README.txt', dir: false, _data: { uncompressedSize: 11 }, async: () => Promise.resolve(new Uint8Array(11)) });
      },
    }),
  };

  async function listing(className = ''): Promise<{ el: LyraArchiveViewer; vlistRoot: ShadowRoot; restore: () => void }> {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer class=${className} name="backup.zip"></lr-archive-viewer>`);
    useLibrary(el, listingLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    el.src = 'https://example.test/archive.zip';
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="entry"]') != null,
      undefined,
      { timeout: 5000 },
    );
    return { el, vlistRoot: el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!, restore };
  }

  it('applies the entry-row layout to rows rendered inside the virtual list', async () => {
    const { vlistRoot, restore } = await listing();
    try {
      const row = vlistRoot.querySelector('[part~="entry"]') as HTMLElement;
      const style = getComputedStyle(row);
      expect(style.display).to.equal('flex');
      expect(style.alignItems).to.equal('center');
      expect(style.fontSize).to.equal(resolveDeclaration(vlistRoot, 'font-size: var(--lr-font-size-sm)', 'font-size'));
      const quiet = resolveDeclaration(vlistRoot, 'color: var(--lr-color-text-quiet)', 'color');
      const size = vlistRoot.querySelector('[part~="entry-size"]') as HTMLElement;
      expect(getComputedStyle(size).color).to.equal(quiet);
      expect(getComputedStyle(size).fontSize).to.equal(
        resolveDeclaration(vlistRoot, 'font-size: var(--lr-font-size-md-sm)', 'font-size'),
      );
      const icon = vlistRoot.querySelector('[part~="entry-icon"]') as HTMLElement;
      // `inline-flex` blockifies to `flex` here because the icon is a flex item of the row; a
      // <span> with no rule applied would compute to `block` instead.
      expect(getComputedStyle(icon).display).to.equal('flex');
      expect(getComputedStyle(icon).color).to.equal(quiet);
      const name = vlistRoot.querySelector('[part~="entry-name"]') as HTMLElement;
      expect(getComputedStyle(name).textOverflow).to.equal('ellipsis');
      expect(getComputedStyle(name).whiteSpace).to.equal('nowrap');
    } finally {
      restore();
    }
  });

  it('gives a directory entry name the directory treatment and a file entry name the plain one', async () => {
    const { vlistRoot, restore } = await listing();
    try {
      const dirName = vlistRoot.querySelector('[part~="entry-name-dir"]') as HTMLElement;
      expect(dirName.textContent).to.equal('src/');
      const semibold = resolveDeclaration(vlistRoot, 'font-weight: var(--lr-font-weight-semibold)', 'font-weight');
      expect(getComputedStyle(dirName).fontWeight).to.equal(semibold);

      const names = vlistRoot.querySelectorAll('[part~="entry-name"]');
      expect(names).to.have.lengthOf(2);
      const fileName = Array.from(names).find((node) => node.textContent === 'README.txt') as HTMLElement;
      expect(fileName.getAttribute('part')).to.equal('entry-name');
      expect(getComputedStyle(fileName).fontWeight).to.not.equal(semibold);
    } finally {
      restore();
    }
  });

  it('isolates entry names and formatted sizes from an inherited RTL direction', async () => {
    const { vlistRoot, restore } = await listing();
    try {
      const names = Array.from(vlistRoot.querySelectorAll('[part~="entry-name"]'));
      expect(names.every((name) => name.getAttribute('dir') === 'auto')).to.be.true;
      expect(vlistRoot.querySelector('[part~="entry-size"]')!.getAttribute('dir')).to.equal('auto');
    } finally {
      restore();
    }
  });

  it('lets a consumer stylesheet reach the virtualized rows through exportparts', async () => {
    const sheet = document.createElement('style');
    sheet.textContent = `
      lr-archive-viewer.consumer-probe::part(entry) { background: rgb(1, 2, 3); }
      lr-archive-viewer.consumer-probe::part(entry-name-dir) { color: rgb(4, 5, 6); }
    `;
    document.head.append(sheet);
    const { vlistRoot, restore } = await listing('consumer-probe');
    try {
      const row = vlistRoot.querySelector('[part~="entry"]') as HTMLElement;
      expect(getComputedStyle(row).backgroundColor).to.equal('rgb(1, 2, 3)');
      const dirName = vlistRoot.querySelector('[part~="entry-name-dir"]') as HTMLElement;
      expect(getComputedStyle(dirName).color).to.equal('rgb(4, 5, 6)');
    } finally {
      restore();
      sheet.remove();
    }
  });

  it('is accessible with entries listed', async () => {
    const { el, vlistRoot, restore } = await listing();
    try {
      expect(vlistRoot.querySelectorAll('[part~="entry"]')).to.have.lengthOf(2);
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });
});
