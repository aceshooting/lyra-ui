import { expect } from '@open-wc/testing';
import './streaming-text.js';
import './streaming-text-core.js';
import type { ShikiLanguageLoader, ShikiLanguageSource } from '../code-block/shiki-types.js';

for (const tag of ['lr-streaming-text', 'lr-streaming-text-core'] as const) {
  it(`${tag} combines opt-in loaders with concrete grammar priority and preserves unset forwarding`, async () => {
    const el = document.createElement(tag);
    expect(el.languageLoaders).equal(undefined);
    const grammar = { name: 'example', scopeName: 'source.example' };
    const languages = { example: grammar };
    const loader = async () => grammar;
    let inspections = 0;
    let getterReads = 0;
    const loaders = new Proxy({ example: loader, extra: loader }, {
      ownKeys(target) { inspections++; return Reflect.ownKeys(target); },
    });
    Object.defineProperty(loaders, 'accessor', { enumerable: true, get() { getterReads++; return loader; } });
    el.contentMode = 'markdown'; el.languages = languages; document.body.append(el);
    const markdown = () => el.shadowRoot!.querySelector(tag === 'lr-streaming-text' ? 'lr-markdown' : 'lr-markdown-core') as HTMLElement & {
      languages?: Readonly<Record<string, ShikiLanguageSource>>;
      languageLoaders?: Readonly<Record<string, ShikiLanguageLoader>>;
    };
    try {
      await el.updateComplete;
      expect(markdown().languages).equal(languages);
      el.languageLoaders = loaders;
      await el.updateComplete;
      const forwarded = () => tag === 'lr-streaming-text' ? markdown().languageLoaders : markdown().languages;
      const combined = forwarded();
      expect(markdown().languages?.['example']).equal(grammar);
      expect(combined?.['extra']).equal(loader);
      if (tag === 'lr-streaming-text') expect(markdown().languages).equal(languages);
      expect(el.languages).equal(languages);
      el.content = 'Updated text'; await el.updateComplete;
      expect(forwarded()).equal(combined);
      expect(inspections).at.most(1);
      expect(getterReads).equal(0);
      el.languageLoaders = { replacement: loader }; await el.updateComplete;
      expect(forwarded()?.['extra']).equal(undefined);
      expect(forwarded()?.['replacement']).equal(loader);
      el.languageLoaders = undefined; await el.updateComplete;
      expect(markdown().languages).equal(languages);
    } finally { el.remove(); }
  });
}
