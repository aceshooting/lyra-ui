import { expect } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import { splitLines } from '../text-lines.js';
import { loadShikiHighlighterCore, SHIKI_SOURCE_MAX_CODE_UNITS, SHIKI_THEMES, type ShikiHighlighter } from './core.js';
import { highlightToHtml, tokenizeToLines } from './tokenize.js';

function fakeHighlighter(codeToHtml: ShikiHighlighter['codeToHtml']): ShikiHighlighter & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    codeToHtml(code, options) { calls.push(options); return codeToHtml(code, options); },
    getLoadedLanguages: () => ['x'],
    loadLanguage: () => Promise.resolve(),
  };
}

/** The DOMParser projection these helpers replace, kept as the reference for real Shiki markup. */
function parsedLines(highlighter: ShikiHighlighter, text: string): string[] {
  const markup = highlighter.codeToHtml(text, { lang: 'json', themes: SHIKI_THEMES });
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  const lines = Array.from(parsed.querySelectorAll('code > .line'), (line) => line.innerHTML);
  const expected = splitLines(text).length;
  while (lines.length > expected) lines.pop();
  while (lines.length < expected) lines.push('');
  return lines;
}

function serialized(markup: string): string {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return template.innerHTML;
}

describe('tokenizeToLines', () => {
  it('renders the same lines as parsing the whole highlighted document', async function () {
    this.timeout(60_000);
    const core = await loadShikiHighlighterCore({ json: jsonGrammar });
    expect(core, 'the optional shiki peer must build in this test environment').to.not.equal(null);
    try {
      for (const text of ['{"a": "<b>&c"}\n[1, 2]', '{\r\n  "k": true\r\n}', '"trailing"\n', '', 'null\r"lone"', '["é", " "]']) {
        const lines = tokenizeToLines(core!, text, 'json');
        expect(lines?.map(serialized), JSON.stringify(text)).to.deep.equal(parsedLines(core!, text));
      }
    } finally {
      (core as ShikiHighlighter & { dispose?: () => void }).dispose?.();
    }
  });

  it('falls back to plain text past the ceiling, on a throwing or non-string result, and on unknown markup', () => {
    const throwing = fakeHighlighter(() => { throw new Error('grammar failed'); });
    expect(tokenizeToLines(throwing, 'a'.repeat(SHIKI_SOURCE_MAX_CODE_UNITS + 1), 'x')).to.equal(null);
    expect(throwing.calls.length, 'the ceiling is checked before tokenizing').to.equal(0);
    expect(tokenizeToLines(throwing, 'a', 'x')).to.equal(null);
    expect(tokenizeToLines(fakeHighlighter(() => 42 as unknown as string), 'a', 'x')).to.equal(null);
    for (const markup of ['<pre>a</pre>', '<pre><code>a', '<pre><code><span class="line">a</span>\n<b>b</b></code></pre>',
      '<pre><code><span class="line highlighted">a</span></code></pre>']) {
      expect(tokenizeToLines(fakeHighlighter(() => markup), 'a\nb', 'x'), markup).to.equal(null);
    }
  });

  it('uses the owner document for nonstandard line markup and falls back when its parser is unavailable', () => {
    const peer = fakeHighlighter(() => '<pre><code><i class="line marked">first</i></code></pre>');
    expect(tokenizeToLines(peer, 'first', 'x', document)).to.deep.equal(['first']);
    expect(tokenizeToLines(peer, 'first', 'x', document.implementation.createHTMLDocument())).to.equal(null);
    const failingDocument = { defaultView: { DOMParser: class {
      parseFromString(): never { throw new Error('parser unavailable'); }
    } } } as unknown as Document;
    expect(tokenizeToLines(peer, 'first', 'x', failingDocument)).to.equal(null);
  });

  it('normalizes the line count to the source text', () => {
    const lines = (markup: string, text: string) => tokenizeToLines(fakeHighlighter(() => markup), text, 'x');
    expect(lines('<pre><code></code></pre>', 'a\nb')).to.deep.equal(['', '']);
    expect(lines('<pre class="shiki"><code tabindex="0"><span class="line" data-x="1">a</span>\n<span class="line">b</span>\n<span class="line"></span></code></pre>', 'a\nb'))
      .to.deep.equal(['a', 'b']);
    expect(lines('<pre><code><span class="line">a</span></code></pre>', 'a\r\nb\rc')).to.deep.equal(['a', '', '']);
  });
});

describe('highlightToHtml', () => {
  it('passes transformers only when supplied and returns the highlighter markup', () => {
    const highlighter = fakeHighlighter(() => '<pre></pre>');
    const transformer = { name: 'mark' };
    expect(highlightToHtml(highlighter, 'a', 'x')).to.equal('<pre></pre>');
    expect(highlightToHtml(highlighter, 'a', 'x', [transformer])).to.equal('<pre></pre>');
    expect(highlighter.calls.map((options) => Object.keys(options))).to.deep.equal([['lang', 'themes'], ['lang', 'themes', 'transformers']]);
    expect((highlighter.calls[1]!['transformers'] as unknown[])[0] === transformer).to.equal(true);
  });
});
