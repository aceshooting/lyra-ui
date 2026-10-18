import { expect, nextFrame, waitUntil } from '@open-wc/testing';
import './markdown.js';
import jsonGrammar from 'shiki/langs/json.mjs';
import type { ShikiLanguageInput } from '../code-block/shiki-types.js';
import { markdownHighlightKey, type PendingHighlight } from './markdown-shared.js';

it('preserves unset concrete grammar identity and isolates shared output after loader changes', async () => {
  const el = document.createElement('lr-markdown');
  const languages = { json: { name: 'json', scopeName: 'source.json' } };
  el.languages = languages;
  document.body.append(el);
  const cache = el as unknown as {
    setCachedHighlight(key: string, value: string): boolean;
    getCachedHighlight(key: string): string | undefined;
  };
  const key = markdownHighlightKey('json', 'loader identity regression');
  try {
    await el.updateComplete;
    expect(el.languageLoaders).equal(undefined);
    expect(el.languages).equal(languages);
    cache.setCachedHighlight(key, '<pre>concrete</pre>');
    expect(cache.getCachedHighlight(key)).equal('<pre>concrete</pre>');
    el.languageLoaders = { extra: async () => languages.json };
    await el.updateComplete;
    expect(el.languages).equal(languages);
    expect(cache.getCachedHighlight(key)).equal(undefined);
    cache.setCachedHighlight(key, '<pre>first loader map</pre>');
    el.languageLoaders = { extra: async () => languages.json };
    await el.updateComplete;
    expect(cache.getCachedHighlight(key)).equal(undefined);
    el.languageLoaders = undefined;
    await el.updateComplete;
    expect(cache.getCachedHighlight(key)).equal('<pre>concrete</pre>');
    expect(el.languages).equal(languages);
  } finally { el.remove(); }
});

it('retains tokenizer override dispatch and discards pending output after changing only loaders', async () => {
  const el = document.createElement('lr-markdown');
  const languages = { json: { name: 'json', scopeName: 'source.json' } };
  el.languages = languages;
  el.content = '```json\n{"loaderOverride": true}\n```';
  const pending: { resolve(value: string): void; current(): boolean; languages: Readonly<Record<string, ShikiLanguageInput>> | undefined }[] = [];
  const tokenizer = el as unknown as {
    tokenizePendingHighlight(pending: PendingHighlight, languages: Readonly<Record<string, ShikiLanguageInput>> | undefined, current: () => boolean): Promise<string>;
  };
  tokenizer.tokenizePendingHighlight = (_pending, concrete, current) => new Promise(resolve => {
    pending.push({ resolve, current, languages: concrete });
  });
  document.body.append(el);
  try {
    await waitUntil(() => pending.length === 1);
    expect(pending[0]!.languages).equal(languages);
    el.languageLoaders = { extra: async () => languages.json };
    await waitUntil(() => pending.length === 2);
    expect(pending[1]!.languages).equal(languages);
    expect(pending[0]!.current()).equal(false);
    expect(pending[1]!.current()).equal(true);
    pending[1]!.resolve('<pre><code>current override output</code></pre>');
    await waitUntil(() => Boolean(el.shadowRoot!.textContent?.includes('current override output')));
    pending[0]!.resolve('<pre><code>obsolete override output</code></pre>');
    await nextFrame(); await el.updateComplete;
    expect(el.shadowRoot!.textContent).contain('current override output');
    expect(el.shadowRoot!.textContent).not.contain('obsolete override output');
  } finally {
    el.remove();
    pending.forEach(entry => entry.resolve(''));
  }
});

it('prioritizes a concrete grammar over its matching lazy loader', async () => {
  const el = document.createElement('lr-markdown');
  let calls = 0;
  const languages = { 'concrete-priority': jsonGrammar };
  el.languages = languages;
  el.languageLoaders = { 'concrete-priority': async () => { calls++; return jsonGrammar; } };
  const tokenizer = el as unknown as {
    tokenizePendingHighlight(pending: PendingHighlight, languages: Readonly<Record<string, ShikiLanguageInput>> | undefined, current: () => boolean): Promise<string | null | undefined>;
  };
  const code = '{"priority": true}';
  const pending = { key: markdownHighlightKey('concrete-priority', code), lang: 'concrete-priority', code };
  const output = await tokenizer.tokenizePendingHighlight(pending, languages, () => true);
  expect(typeof output).equal('string');
  expect(calls).equal(0);
  expect(el.languages).equal(languages);
});
