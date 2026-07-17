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
    const result = await loadKatex(() => Promise.reject(new Error('not installed')));
    expect(result).to.equal(null);
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
