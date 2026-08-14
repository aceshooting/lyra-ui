import { expect } from '@open-wc/testing';
import { clearPdfJsCache, loadPdfJs, loadPdfJsDeps } from './pdf-loader.js';

afterEach(() => clearPdfJsCache());

function fakePdfJsModule(): { getDocument: () => unknown; GlobalWorkerOptions: { workerSrc: string } } {
  return { getDocument: () => ({ promise: Promise.resolve({ numPages: 1 }) }), GlobalWorkerOptions: { workerSrc: '' } };
}

describe('loadPdfJsDeps()', () => {
  it('resolves the injected module and configures its worker from the peer module resolver', async () => {
    const fake = fakePdfJsModule();
    expect(await loadPdfJsDeps(
      () => Promise.resolve(fake),
      () => 'https://cdn.example.test/pdf.worker.min.mjs',
    )).to.equal(fake);
    expect(fake.GlobalWorkerOptions.workerSrc).to.equal('https://cdn.example.test/pdf.worker.min.mjs');
  });

  it('does not overwrite a consumer-configured PDF.js worker', async () => {
    const fake = fakePdfJsModule();
    fake.GlobalWorkerOptions.workerSrc = 'https://app.example.test/pdf.worker.mjs';
    let resolverCalls = 0;
    await loadPdfJsDeps(
      () => Promise.resolve(fake),
      () => { resolverCalls++; return 'https://cdn.example.test/pdf.worker.min.mjs'; },
    );
    expect(fake.GlobalWorkerOptions.workerSrc).to.equal('https://app.example.test/pdf.worker.mjs');
    expect(resolverCalls).to.equal(0);
  });

  it('fails closed instead of assigning an unresolved or active-content worker URL', async () => {
    for (const candidate of ['pdfjs-dist/build/pdf.worker.min.mjs', 'javascript:alert(1)', 'data:text/javascript,postMessage(1)']) {
      const fake = fakePdfJsModule();
      await loadPdfJsDeps(() => Promise.resolve(fake), () => candidate);
      expect(fake.GlobalWorkerOptions.workerSrc, candidate).to.equal('');
    }
  });

  it('returns null and logs the import error when pdfjs-dist is unavailable', async () => {
    const importError = new Error('pdfjs-dist boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      expect(await loadPdfJsDeps(() => Promise.reject(importError))).to.equal(null);
      expect(calls.flat()).to.contain(importError);
      expect(calls.flat().join(' ')).to.contain('lr-pdf-viewer');
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
