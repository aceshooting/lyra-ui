import { expect } from '@open-wc/testing';
import { clearArchiveLibraryCache, loadArchiveLibrary, loadArchiveLibraryCached } from './archive-loader.js';

afterEach(() => clearArchiveLibraryCache());

describe('archive loader', () => {
  it('loads the real JSZip API', async () => { expect((await loadArchiveLibraryCached())?.loadAsync).to.exist; });
  it('caches the API', async () => { const first = await loadArchiveLibraryCached(); const second = await loadArchiveLibraryCached(); expect(first).to.equal(second); });
  it('supports an injected importer and reports missing peers', async () => {
    expect((await loadArchiveLibrary(() => import('jszip')))?.loadAsync).to.exist;
    const error = new Error('jszip boom'); const originalWarn = console.warn; const calls: unknown[][] = []; console.warn = (...args: unknown[]) => calls.push(args);
    try { expect(await loadArchiveLibrary(() => Promise.reject(error))).to.be.null; expect(calls.flat()).to.contain(error); expect(calls.flat().join(' ')).to.contain('pnpm add jszip'); } finally { console.warn = originalWarn; }
  });
});
