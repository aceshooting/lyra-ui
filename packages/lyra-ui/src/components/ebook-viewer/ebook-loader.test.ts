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
    expect(await loadEpubJs(() => Promise.reject(new Error('missing')))).to.be.null;
  });

  it('caches the factory and supports a test override', async () => {
    const fake = (() => ({})) as never;
    __setEpubJsForTesting(fake);
    expect(await getEpubJs()).to.equal(fake);
    expect(await getEpubJs()).to.equal(fake);
  });
});
