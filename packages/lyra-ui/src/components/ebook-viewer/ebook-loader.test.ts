import { expect } from '@open-wc/testing';
import { getEpubJs, loadEpubJs, __setEpubJsForTesting } from './ebook-loader.js';

afterEach(() => __setEpubJsForTesting(undefined));

describe('ebook loader', () => {
  it('loads the installed epubjs factory', async () => {
    const factory = (() => ({})) as never;
    expect(await loadEpubJs(() => Promise.resolve(factory))).to.equal(factory);
  });

  it('unwraps module namespaces and returns null on failure', async () => {
    const fake = (() => ({})) as never;
    expect(await loadEpubJs(() => Promise.resolve({ default: fake }))).to.equal(fake);
    const error = new Error('missing');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      expect(await loadEpubJs(() => Promise.reject(error))).to.be.null;
    } finally {
      console.warn = originalWarn;
    }
    expect(calls).to.have.lengthOf(1);
    expect(calls.flat()).to.contain(error);
  });

  it('caches the factory and supports a test override', async () => {
    const fake = (() => ({})) as never;
    __setEpubJsForTesting(fake);
    expect(await getEpubJs()).to.equal(fake);
    expect(await getEpubJs()).to.equal(fake);
  });
});
