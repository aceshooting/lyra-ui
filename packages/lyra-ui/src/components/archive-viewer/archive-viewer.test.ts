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

describe('lyra-archive-viewer', () => {
  it('renders the empty state by default', async () => { const el = await fixture<LyraArchiveViewer>(html`<lyra-archive-viewer></lyra-archive-viewer>`); expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.'); });
  it('lists ZIP entries and computes file sizes', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lyra-archive-viewer></lyra-archive-viewer>`); const buffer = await buildZip({ 'README.txt': 'hello world', 'src/index.js': 'console.log(1);' }); const restore = stubFetch(buffer);
    try { el.src = 'https://example.test/archive.zip'; await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null || el.shadowRoot!.querySelector('[part="error"]') !== null, undefined, { timeout: 5000 }); expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist; const list = el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement & { items: { name: string; dir: boolean; size: number }[] }; await waitUntil(() => list.items?.length === 3, undefined, { timeout: 5000 }); expect(list.items.map((item) => item.name).sort()).to.deep.equal(['README.txt', 'src/', 'src/index.js']); expect(list.items.find((item) => item.name === 'README.txt')!.size).to.equal(11); expect(list.items.find((item) => item.name === 'src/')!.dir).to.be.true; } finally { restore(); }
  });
  it('renders the empty archive message', async () => { const el = await fixture<LyraArchiveViewer>(html`<lyra-archive-viewer></lyra-archive-viewer>`); const restore = stubFetch(await buildZip({})); try { el.src = 'https://example.test/empty.zip'; await waitUntil(() => el.shadowRoot!.querySelector('.empty-note')?.textContent === 'This archive is empty.'); } finally { restore(); } });
  it('renders a missing-peer error and rejects unsafe URLs', async () => { const missing = await fixture<LyraArchiveViewer>(html`<lyra-archive-viewer></lyra-archive-viewer>`); useLibrary(missing, null); const restore = stubFetch(new ArrayBuffer(0)); try { missing.src = 'https://example.test/archive.zip'; await waitUntil(() => missing.shadowRoot!.querySelector('[part="error"]') !== null); expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Archive preview is unavailable.'); } finally { restore(); }
    let called = false; const original = window.fetch; window.fetch = (() => { called = true; return Promise.reject(new Error('unexpected')); }) as typeof window.fetch; try { const unsafe = await fixture<LyraArchiveViewer>(html`<lyra-archive-viewer .src=${'java\tscript:alert(1)'}></lyra-archive-viewer>`); await unsafe.updateComplete; expect(called).to.be.false; expect(unsafe.shadowRoot!.querySelector('[part="error"]')).to.exist; } finally { window.fetch = original; }
  });
  it('applies localized empty strings and is accessible', async () => { const el = await fixture<LyraArchiveViewer>(html`<lyra-archive-viewer .strings=${{ documentPreviewEmpty: 'Aucun {type} à afficher.' }}></lyra-archive-viewer>`); expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('Aucun document à afficher.'); await expect(el).to.be.accessible(); });
});
