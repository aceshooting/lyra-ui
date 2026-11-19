import { expect } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { __setDompurifyImporterForTesting } from '../../../internal/dompurify-loader.js';
import { getMarkdownDepsIfLoaded, loadMarkdownDeps } from './markdown-loader.js';
import { getKatex } from './katex-loader.js';
import type { ShikiHighlighter } from '../code-block/shiki-types.js';
import { createMarkdownKatexState, tokenizeMarkdownHighlight } from './markdown-shared.js';

it('retries a missing sanitizer and only caches complete Markdown dependencies', async () => {
  expectDevWarning('lyra-dompurify-unavailable');
  let calls = 0;
  __setDompurifyImporterForTesting(async () => {
    if (++calls === 1) throw new Error();
    return import('dompurify');
  });
  try {
    const partial = await loadMarkdownDeps();
    expect(Boolean(partial.marked)).to.equal(true);
    expect(Boolean(partial.DOMPurify)).to.equal(false);
    expect(getMarkdownDepsIfLoaded() === undefined).to.equal(true);
    const complete = await loadMarkdownDeps();
    expect(Boolean(complete.DOMPurify)).to.equal(true);
    expect(getMarkdownDepsIfLoaded() === complete).to.equal(true);
  } finally {
    __setDompurifyImporterForTesting(undefined);
  }
});

it('lets a later math subscriber recover a transient KaTeX import', async () => {
  expectDevWarning('lyra-markdown-katex-unavailable');
  const generation = Symbol.for('@aceshooting/lyra-ui/markdown-katex-cache-generation');
  const original = Object.getOwnPropertyDescriptor(globalThis, generation);
  Reflect.set(globalThis, generation, {});
  let calls = 0;
  const api = { renderToString: () => '<math></math>' };
  const importer = async () => {
    if (++calls < 3) throw new Error();
    return api;
  };
  try {
    const state = createMarkdownKatexState();
    const first = getKatex(importer);
    const settled = new Promise<void>((resolve) => state.startLoad(resolve));
    expect(await first).to.equal(null);
    await settled;
    expect(state.isConfirmedMissing()).to.equal(true);
    const stillMissing = getKatex(importer);
    let repeatedNotification = false;
    state.startLoad(() => { repeatedNotification = true; });
    expect(await stillMissing).to.equal(null);
    await Promise.resolve();
    expect(repeatedNotification).to.equal(false);
    const retry = getKatex(importer);
    let notified = false;
    state.startLoad(() => { notified = true; });
    expect(await retry === api).to.equal(true);
    await Promise.resolve();
    expect(notified && state.getIfLoaded() === api).to.equal(true);
    expect(calls).to.equal(3);
  } finally {
    if (original) Object.defineProperty(globalThis, generation, original);
    else Reflect.deleteProperty(globalThis, generation);
  }
});

it('keeps a fence plain when the highlighter returns non-string markup', () => {
  const peer = { codeToHtml: () => ({ replace: () => 'unexpected markup' }), getLoadedLanguages: () => [], loadLanguage: async () => {} };
  expect(tokenizeMarkdownHighlight(peer as unknown as ShikiHighlighter, { key: 'js:1', lang: 'js', code: '1' })).to.equal(null);
});
