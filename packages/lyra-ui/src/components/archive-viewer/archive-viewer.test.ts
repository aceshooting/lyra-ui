import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LYRA_DEFAULT_STRINGS } from '../../internal/localization.js';
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
          cb('README.txt', { name: 'README.txt', dir: false, async: () => Promise.resolve(new Uint8Array(11)) });
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
