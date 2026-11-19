import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../test/property-options.js';
import { escapeHtml } from '../escape-html.js';
import { splitLines } from '../text-lines.js';
import type { ShikiHighlighter } from './core.js';
import { tokenizeToLines } from './tokenize.js';

/** Shiki's classic structure: one escaped line span per `\r?\n`-separated line inside `<pre><code>`. */
const classic: ShikiHighlighter = {
  codeToHtml: (code) => `<pre class="shiki" tabindex="0"><code>${code.split(/\r?\n/).map((line) =>
    `<span class="line"><span style="color:#000">${escapeHtml(line)}</span></span>`).join('\n')}</code></pre>`,
  getLoadedLanguages: () => ['x'],
  loadLanguage: () => Promise.resolve(),
};

const text = fc.array(fc.oneof(fc.string(), fc.constantFrom('\n', '\r\n', '\r', '<', '&', '</span>', '\t', '"')), { maxLength: 12 })
  .map((parts) => parts.join(''));

describe('tokenizeToLines properties', () => {
  it('returns one entry per source line, each holding exactly that line markup', () => {
    fc.assert(fc.property(text, (source) => {
      const lines = tokenizeToLines(classic, source, 'x');
      const expected = splitLines(source);
      expect(lines?.length).to.equal(expected.length);
      // A lone carriage return stays inside Shiki's line while splitLines() breaks on it.
      if (/\r(?!\n)/.test(source)) return;
      expected.forEach((line, index) => {
        expect(lines![index]).to.equal(`<span style="color:#000">${escapeHtml(line)}</span>`);
      });
    }), propertyRuns());
  });
});
