import { expect } from '@open-wc/testing';
import { clearPdfJsCache, loadPdfJs, loadPdfJsDeps } from './pdf-loader.js';

afterEach(() => clearPdfJsCache());

function fakePdfJsModule(): { getDocument: () => unknown; GlobalWorkerOptions: { workerSrc: string } } {
  return { getDocument: () => ({ promise: Promise.resolve({ numPages: 1 }) }), GlobalWorkerOptions: { workerSrc: '' } };
}

describe('loadPdfJsDeps()', () => {
  it('resolves the injected module and configures its worker URL', async () => {
    const fake = fakePdfJsModule();
    expect(await loadPdfJsDeps(() => Promise.resolve(fake))).to.equal(fake);
    expect(fake.GlobalWorkerOptions.workerSrc).to.contain('pdf.worker.min.mjs');
  });

  it('returns null and logs the import error when pdfjs-dist is unavailable', async () => {
    const importError = new Error('pdfjs-dist boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      expect(await loadPdfJsDeps(() => Promise.reject(importError))).to.equal(null);
      expect(calls.flat()).to.contain(importError);
      expect(calls.flat().join(' ')).to.contain('lyra-pdf-viewer');
      expect(calls.flat().join(' ')).to.contain('pnpm add pdfjs-dist');
    } finally {
      console.warn = originalWarn;
    }
  });

  it('caches the real optional module result', async () => {
    const first = await loadPdfJs();
    const second = await loadPdfJs();
    expect(second).to.equal(first);
  });
});
