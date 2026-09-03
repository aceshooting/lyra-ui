import { expect } from '@open-wc/testing';
import { loadKatex, getKatex } from './katex-loader.js';
import { createMarkdownKatexState } from './markdown-shared.js';

const KATEX_CACHE_GENERATION = Symbol.for('@aceshooting/lyra-ui/markdown-katex-cache-generation');
function clearKatexCache(): void {
  Reflect.set(globalThis, KATEX_CACHE_GENERATION, {});
}

describe('loadKatex', () => {
  afterEach(() => clearKatexCache());

  it('resolves the katex module on success', async () => {
    const fakeKatex = { renderToString: () => '<math></math>' };
    const result = await loadKatex(() => Promise.resolve({ default: fakeKatex } as never));
    expect(result).to.equal(fakeKatex);
  });

  it('uses a fixed, bounded development diagnostic when the optional peer fails and stays silent in production', async () => {
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const originalWarn = console.warn;
    const messages: string[] = [];
    const error = new Error('private katex loader failure');
    runtime.litIssuedWarnings = new Set();
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    try {
      expect(await loadKatex(() => Promise.reject(error))).to.equal(null);
      expect(await loadKatex(() => Promise.reject(error))).to.equal(null);
      expect(messages).to.deep.equal([
        '<lr-markdown>/<lr-markdown-core>: Math rendering is unavailable because the optional KaTeX peer could not load. TeX is rendered as literal text.',
      ]);
      expect(messages.join(' ')).to.not.contain(error.message);

      messages.length = 0;
      delete runtime.litIssuedWarnings;
      expect(await loadKatex(() => Promise.reject(error))).to.equal(null);
      expect(messages).to.deep.equal([]);
    } finally {
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
      console.warn = originalWarn;
    }
  });

  it('caches the resolved module across calls', async () => {
    let calls = 0;
    const fakeKatex = { renderToString: () => '<math></math>' };
    const importer = () => {
      calls++;
      return Promise.resolve({ default: fakeKatex } as never);
    };
    await getKatex(importer);
    await getKatex(importer);
    expect(calls).to.equal(1);
  });

  it('notifies every instance subscribed to the same in-flight load', async () => {
    const state = createMarkdownKatexState();
    const notified: string[] = [];
    const notifyFirst = () => notified.push('first');

    state.startLoad(notifyFirst);
    state.startLoad(notifyFirst);
    state.startLoad(() => notified.push('second'));

    await getKatex();
    await Promise.resolve();
    expect(notified).to.deep.equal(['first', 'second']);
  });
});
