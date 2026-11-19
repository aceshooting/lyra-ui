import { expect, fixture, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { __setShikiModuleLoaderForTesting, loadShikiHighlighter, loadShikiLanguage } from './code-loader.js';
import { __resetShikiCoreEngineForTesting, __setShikiHighlighterCoreLoaderForTesting, ensureShikiLanguageLoaded,
  loadShikiHighlighterCore, setShikiCoreEngine, type ShikiHighlighter } from './shiki-types.js';
import './code-block.js';
import './code-block-core.js';
import type { LyraCodeBlock } from './code-block.js';

const mock: ShikiHighlighter = {
  codeToHtml: () => '<pre class="shiki"></pre>',
  getLoadedLanguages: () => ['json'],
  loadLanguage: async () => undefined,
};

afterEach(() => {
  __resetShikiCoreEngineForTesting();
  __setShikiHighlighterCoreLoaderForTesting(undefined);
  __setShikiModuleLoaderForTesting(undefined);
});

it('retries a rejected highlighter import and shares the successful instance', async () => {
  expectDevWarning('lyra-code-block-shiki-unavailable');
  let calls = 0;
  __setShikiModuleLoaderForTesting(async () => {
    if (++calls === 1) throw new Error();
    return { createHighlighter: async () => mock };
  });
  expect(await loadShikiHighlighter()).to.equal(null);
  expect(await loadShikiHighlighter() === mock).to.equal(true);
  expect(await loadShikiHighlighter() === mock).to.equal(true);
  expect(calls).to.equal(2);
});

it('keeps an invalid highlighter module cached until the importer changes', async () => {
  expectDevWarning('lyra-code-block-shiki-unavailable');
  let calls = 0;
  __setShikiModuleLoaderForTesting(async () => { calls++; return {}; });
  expect(await loadShikiHighlighter()).to.equal(null);
  expect(await loadShikiHighlighter()).to.equal(null);
  expect(calls).to.equal(1);
});

it('retries an engine failure for the same frozen grammar map', async () => {
  expectDevWarning('lyra-fine-grained-shiki-highlighter-unavailable');
  const grammars = Object.freeze({ json: jsonGrammar });
  let calls = 0;
  setShikiCoreEngine(async () => {
    if (++calls === 1) throw new Error();
    return createJavaScriptRegexEngine();
  });
  expect(await loadShikiHighlighterCore(grammars)).to.equal(null);
  expect(Boolean(await loadShikiHighlighterCore(grammars))).to.equal(true);
  expect(calls).to.equal(2);
});

it('retries a failed bundled grammar without poisoning the highlighter', async () => {
  let calls = 0;
  const hl = { ...mock, getLoadedLanguages: () => [], loadLanguage: async () => { if (++calls === 1) throw new Error(); } };
  expect(await loadShikiLanguage(hl, 'json')).to.equal(false);
  expect(await loadShikiLanguage(hl, 'json')).to.equal(true);
});

it('retries a failed lazy grammar and shares simultaneous attempts', async () => {
  expectDevWarning('lyra-shiki-lazy-language-source-failed');
  let calls = 0;
  const load = async () => {
    if (++calls === 1) throw new Error();
    return jsonGrammar;
  };
  expect(await ensureShikiLanguageLoaded(mock, 'json', load)).to.equal(false);
  expect(await Promise.all([ensureShikiLanguageLoaded(mock, 'json', load), ensureShikiLanguageLoaded(mock, 'json', load)])).to.deep.equal([true, true]);
  expect(calls).to.equal(2);
});

for (const name of ['lr-code-block', 'lr-code-block-core']) {
  it(`${name} renders plain source after a synchronous engine failure`, async () => {
    expectDevWarning('lyra-fine-grained-shiki-highlighter-unavailable');
    setShikiCoreEngine(() => { throw new Error(); });
    const el = document.createElement(name) as LyraCodeBlock;
    el.languages = { json: jsonGrammar };
    el.code = '42';
    el.language = 'json';
    const host = await fixture<HTMLElement>('<div></div>');
    host.append(el);
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('.line-source')?.textContent === '42' && !el.hasAttribute('aria-busy'));
  });

  it(`${name} renders source when the peer returns non-string markup`, async () => {
    let attempts = 0;
    __setShikiHighlighterCoreLoaderForTesting(async () => ({
      ...mock, codeToHtml: () => { attempts++; return {} as string; },
    }));
    const el = await fixture<LyraCodeBlock>(`<${name}></${name}>`);
    el.languages = { json: jsonGrammar };
    el.language = 'json';
    el.code = '42';
    await waitUntil(() => attempts > 0);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.line-source')?.textContent).to.equal('42');
  });

  it(`${name} retains rendered syntax across a same-task move`, async () => {
    let attempts = 0;
    __setShikiHighlighterCoreLoaderForTesting(async () => ({
      ...mock, codeToHtml: () => { attempts++; return '<pre class="shiki"><code>42</code></pre>'; },
    }));
    const el = await fixture<LyraCodeBlock>(`<${name}></${name}>`);
    el.languages = { json: jsonGrammar };
    el.language = 'json';
    el.code = '42';
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('pre.shiki')));
    const before = attempts;
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    await Promise.resolve();
    expect(attempts).to.equal(before);
    expect(el.shadowRoot!.querySelector('pre.shiki')?.textContent).to.equal('42');
  });
}

it('loads the full highlighter on first demand and recovers from a transient import on a new language', async () => {
  expectDevWarning('lyra-code-block-shiki-unavailable');
  let calls = 0;
  __setShikiModuleLoaderForTesting(async () => {
    if (++calls === 1) throw new Error();
    return { createHighlighter: async () => mock };
  });
  const el = await fixture<LyraCodeBlock>('<lr-code-block code="123"></lr-code-block>');
  expect(calls).to.equal(0);
  el.language = 'ts';
  await waitUntil(() => calls === 1 && !el.hasAttribute('aria-busy'));
  expect(el.shadowRoot!.querySelector('.line-source')?.textContent).to.equal('123');
  el.language = 'json';
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('pre.shiki')));
  expect(calls).to.equal(2);
});

for (const empty of [undefined, null]) {
  it(`accepts a ${String(empty)} core language map at connection and highlights a later assignment`, async () => {
    const el = document.createElement('lr-code-block-core');
    Reflect.set(el, 'languages', empty);
    el.code = '123';
    el.language = 'json';
    const host = await fixture<HTMLElement>('<div></div>');
    host.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.line-source')?.textContent).to.equal('123');
    el.languages = { json: jsonGrammar };
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('pre.shiki')));
  });
}
