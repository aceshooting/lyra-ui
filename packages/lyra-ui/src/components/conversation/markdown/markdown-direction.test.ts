import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';
import { loadMarkdownDeps } from './markdown-loader.js';
import { renderedTemplateWhitespace, inMarkdownCodeBlock } from '../../../../test/rendered-whitespace.js';

describe('Markdown code direction', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} isolates streaming code while preserving source and prose direction`, async () => {
      const host = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      const source = 'العربية `--flag` prose\n```js\nconst x = 1;\n```\n';
      el.content = source;
      el.streaming = true;
      host.append(el);
      await el.updateComplete;
      const root = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
      expect(root.textContent).to.equal(source);
      expect(getComputedStyle(root).direction).to.equal('rtl');
      for (const part of root.querySelectorAll<HTMLElement>('.fallback-code, .fallback-inline-code')) {
        expect(getComputedStyle(part).direction).to.equal('ltr');
        expect(getComputedStyle(part).unicodeBidi).to.equal('isolate');
      }
      expect(root.querySelectorAll('.fallback-code, .fallback-inline-code').length).to.equal(2);
      expect(renderedTemplateWhitespace(el.shadowRoot!, { allow: inMarkdownCodeBlock })).to.deep.equal([]);
    });
    it(`${name} honors explicit direction and gives authored prose pre elements first-strong direction`, async () => {
      await loadMarkdownDeps();
      const host = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = '<pre part="code-block" dir="rtl"><code>نص</code></pre>\n\n<pre>نص عربي</pre>\n\n`--flag`';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre')));
      const pre = el.shadowRoot!.querySelectorAll<HTMLElement>('pre');
      expect(getComputedStyle(pre[0]!).direction).to.equal('rtl');
      expect(getComputedStyle(pre[0]!.querySelector('code')!).direction).to.equal('rtl');
      expect(getComputedStyle(pre[1]!).unicodeBidi).to.equal('plaintext');
      expect(getComputedStyle(el.shadowRoot!.querySelector('[part="inline-code"]')!).direction).to.equal('ltr');
    });
  }
});
