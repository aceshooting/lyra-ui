import { expect } from '@open-wc/testing';
import { loadShikiLanguage } from './full.js';
import type { ShikiHighlighter } from './core.js';

it('loads a normalized bundled language without a custom language map', async () => {
  const loaded: unknown[] = [];
  const highlighter: ShikiHighlighter = {
    codeToHtml: () => '',
    getLoadedLanguages: () => [],
    async loadLanguage(language) { loaded.push(language); },
  };
  expect(await loadShikiLanguage(highlighter, ' .JSON ')).to.equal(true);
  expect(loaded).to.deep.equal(['json']);
});
