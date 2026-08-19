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

  it('configures the worker from a consumer-supplied URL when the peer module resolver has none', async () => {
    const fake = fakePdfJsModule();
    await loadPdfJsDeps(
      () => Promise.resolve(fake),
      () => null,
      'https://app.example.test/bundled-pdf.worker.mjs',
    );
    expect(fake.GlobalWorkerOptions.workerSrc).to.equal('https://app.example.test/bundled-pdf.worker.mjs');
  });

  it('prefers the consumer-supplied worker URL over the resolved peer module', async () => {
    const fake = fakePdfJsModule();
    await loadPdfJsDeps(
      () => Promise.resolve(fake),
      () => 'https://cdn.example.test/pdf.worker.min.mjs',
      'https://app.example.test/bundled-pdf.worker.mjs',
    );
    expect(fake.GlobalWorkerOptions.workerSrc).to.equal('https://app.example.test/bundled-pdf.worker.mjs');
  });

  // A bundler emits a document-relative worker chunk (Vite's `?worker&url` yields
  // `/assets/pdf.worker-<hash>.mjs`), which the bare-specifier resolver path deliberately refuses.
  it('resolves a document-relative consumer worker URL against the document base', async () => {
    const fake = fakePdfJsModule();
    await loadPdfJsDeps(() => Promise.resolve(fake), () => null, '/assets/pdf.worker-abc123.mjs');
    expect(fake.GlobalWorkerOptions.workerSrc)
      .to.equal(new URL('/assets/pdf.worker-abc123.mjs', document.baseURI).href);
  });

  it('fails closed on an active-content consumer worker URL', async () => {
    for (const candidate of ['javascript:alert(1)', 'data:text/javascript,postMessage(1)']) {
      const fake = fakePdfJsModule();
      await loadPdfJsDeps(() => Promise.resolve(fake), () => null, candidate);
      expect(fake.GlobalWorkerOptions.workerSrc, candidate).to.equal('');
    }
  });

  it('never lets a consumer-supplied URL overwrite an already-configured worker', async () => {
    const fake = fakePdfJsModule();
    fake.GlobalWorkerOptions.workerSrc = 'https://app.example.test/pdf.worker.mjs';
    await loadPdfJsDeps(
      () => Promise.resolve(fake),
      () => null,
      'https://other.example.test/late-pdf.worker.mjs',
    );
    expect(fake.GlobalWorkerOptions.workerSrc).to.equal('https://app.example.test/pdf.worker.mjs');
  });

  it('applies a worker URL supplied after the module promise was already memoized', async () => {
    const first = await loadPdfJs();
    expect(first === null, 'pdfjs-dist must be installed for this test to mean anything').to.be.false;
    const globalWorkerOptions = first!.GlobalWorkerOptions;
    const originalWorkerSrc = globalWorkerOptions.workerSrc;
    try {
      globalWorkerOptions.workerSrc = '';
      const second = await loadPdfJs('https://app.example.test/late-pdf.worker.mjs');
      expect(second === first, 'memoized module identity').to.be.true;
      expect(globalWorkerOptions.workerSrc).to.equal('https://app.example.test/late-pdf.worker.mjs');
    } finally {
      globalWorkerOptions.workerSrc = originalWorkerSrc;
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
