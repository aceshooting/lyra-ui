import { expect } from '@open-wc/testing';
import { getEpubJs, loadEpubJs, __setEpubJsForTesting } from './ebook-loader.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';

// Tests below deliberately make the optional peer unavailable or malformed; the loader's one-time diagnostic is expected.
expectDevWarning('lyra-ebook-viewer-epubjs-unavailable');

afterEach(() => __setEpubJsForTesting(undefined));

describe('ebook loader', () => {
  it('loads the installed epubjs factory', async () => {
    const factory = (() => ({})) as never;
    expect(await loadEpubJs(() => Promise.resolve(factory))).to.equal(factory);
  });

  it('unwraps module namespaces and returns null on failure', async () => {
    const fake = (() => ({})) as never;
    expect(await loadEpubJs(() => Promise.resolve({ default: fake }))).to.equal(fake);
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    runtime.litIssuedWarnings = new Set();
    try {
      expect(await loadEpubJs(() => Promise.reject(new Error('missing; secret')))).to.be.null;
      expect(await loadEpubJs(() => Promise.reject(new Error('again')))).to.be.null;
    } finally {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    }
    expect(calls).to.have.lengthOf(1);
    expect(calls.flat().map(String).join(' ')).to.equal('<lr-ebook-viewer> could not load its optional epubjs peer.');
  });

  it('caches the factory and supports a test override', async () => {
    const fake = (() => ({})) as never;
    __setEpubJsForTesting(fake);
    expect(await getEpubJs()).to.equal(fake);
    expect(await getEpubJs()).to.equal(fake);
  });
});
