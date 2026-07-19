import { expect } from '@open-wc/testing';
import { loadKatex, clearKatexCache } from './katex-loader.js';

describe('loadKatex', () => {
  afterEach(() => clearKatexCache());

  it('resolves the katex module on success', async () => {
    const fakeKatex = { renderToString: () => '<math></math>' };
    const result = await loadKatex(() => Promise.resolve({ default: fakeKatex } as never));
    expect(result).to.equal(fakeKatex);
  });

  it('resolves null and warns when the optional peer fails to load', async () => {
    const error = new Error('not installed');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    let result: Awaited<ReturnType<typeof loadKatex>>;
    try {
      result = await loadKatex(() => Promise.reject(error));
    } finally {
      console.warn = originalWarn;
    }
    expect(result).to.equal(null);
    expect(calls).to.have.lengthOf(1);
    expect(calls.flat()).to.contain(error);
  });

  it('caches the resolved module across calls', async () => {
    let calls = 0;
    const fakeKatex = { renderToString: () => '<math></math>' };
    const importer = () => {
      calls++;
      return Promise.resolve({ default: fakeKatex } as never);
    };
    const { getKatex } = await import('./katex-loader.js');
    await getKatex(importer);
    await getKatex(importer);
    expect(calls).to.equal(1);
  });
});
