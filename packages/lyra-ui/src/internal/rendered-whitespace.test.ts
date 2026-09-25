import { expect } from '@open-wc/testing';
import { html, render, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { inMarkdownCodeBlock, renderedTemplateWhitespace } from '../../test/rendered-whitespace.js';

const PRE_WRAP = 'white-space: pre-wrap; font-family: monospace; line-height: 20px';

describe('renderedTemplateWhitespace', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  /** Renders into a fresh container, so each fixture gets its own Lit root part. */
  function mount(template: TemplateResult): HTMLDivElement {
    const container = document.createElement('div');
    host.appendChild(container);
    render(template, container);
    return container;
  }

  // The plain-text fallback shape that shipped before the flush template, verbatim.
  // prettier-ignore
  const indentedFallback = (content: string): TemplateResult => html`
      <div part="content" style=${PRE_WRAP}>
        ${content}
      </div>
    `;

  describe('reports', () => {
    it('both runs of an indented fallback with content, and the leading run when it is empty', () => {
      expect(renderedTemplateWhitespace(mount(indentedFallback('Hello')))).to.deep.equal([
        '"\\n        " in div[part="content"]',
        '"\\n      " in div[part="content"]',
      ]);
      expect(renderedTemplateWhitespace(mount(indentedFallback('')))).to.deep.equal([
        '"\\n        " in div[part="content"]',
      ]);
    });

    it('a leading break under pre-line', () => {
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<p style="white-space: pre-line"><b>x</b>
        tail</p>`));
      expect(found).to.deep.equal(['"\\n        tail" in p']);
    });

    it('the closing run of an indented root template in a nested shadow root that inherits pre-wrap', () => {
      const outer = mount(html`<div style=${PRE_WRAP}><span id="inner"></span></div>`);
      const inner = outer.querySelector('#inner')!;
      const root = inner.attachShadow({ mode: 'open' });
      // prettier-ignore
      render(html`
        <b part="label">Label</b>
      `, root);
      expect(renderedTemplateWhitespace(outer)).to.deep.equal(['"\\n      " in span']);
    });

    it('static label text that mixes words with indentation as the first child', () => {
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<div part="row" style=${PRE_WRAP}>
  Label: <b>${'value'}</b></div>`));
      expect(found).to.deep.equal(['"\\n  Label: " in div[part="row"]']);
    });

    it('a run under white-space-collapse: preserve-breaks where the longhand is supported', function () {
      if (!CSS.supports('white-space-collapse', 'preserve-breaks')) return this.skip();
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<div style="white-space-collapse: preserve-breaks"><b>x</b>
        <i>y</i></div>`));
      expect(found).to.deep.equal(['"\\n        " in div']);
    });

    it('an indentation run after an authored template comment', () => {
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<div style=${PRE_WRAP}><!-- note -->
        <b>x</b></div>`));
      expect(found).to.deep.equal(['"\\n        " in div']);
    });
  });

  describe('does not report', () => {
    it('flush shapes', () => {
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<div part="content" style=${PRE_WRAP}
        >${'Hello'}</div
      ><div style=${PRE_WRAP}>${'a'}<b>b</b></div>`));
      expect(found).to.deep.equal([]);
    });

    it('bound values that start or end with a newline', () => {
      expect(renderedTemplateWhitespace(mount(html`<div style=${PRE_WRAP}>${'\nHello'}</div>`))).to.deep.equal([]);
      expect(renderedTemplateWhitespace(mount(html`<div style=${PRE_WRAP}>${'Hello\n'}</div>`))).to.deep.equal([]);
    });

    it('an iterable of strings that start and end with a newline', () => {
      const segments = ['\nfirst\n', html`<span>${'\ncode\n'}</span>`, '\nlast\n'];
      expect(renderedTemplateWhitespace(mount(html`<div style=${PRE_WRAP}>${segments}</div>`))).to.deep.equal([]);
    });

    it('Markdown code-block text with the inMarkdownCodeBlock predicate, and reports it without', () => {
      const markup =
        '<pre part="code-block"><code>const x = 1;\n</code></pre>' +
        '<pre part="code-block"><code><span class="line">a</span>\n<span class="line">b</span></code></pre>';
      const root = mount(html`<div part="content">${unsafeHTML(markup)}</div>`);
      expect(renderedTemplateWhitespace(root, { allow: inMarkdownCodeBlock })).to.deep.equal([]);
      expect(renderedTemplateWhitespace(root)).to.deep.equal(['"const x = 1;\\n" in code', '"\\n" in code']);
    });

    it('the newline joins a grid container drops', () => {
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<div style="display: grid; ${PRE_WRAP}"><span>a</span>
<span>b</span>
</div>`));
      expect(found).to.deep.equal([]);
    });

    it('whitespace-only runs a flex container drops', () => {
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<div style="display: flex; ${PRE_WRAP}">
        <span>a</span>
        <span>b</span>
      </div>`));
      expect(found).to.deep.equal([]);
    });

    it('hidden subtrees', () => {
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<div hidden style=${PRE_WRAP}>
        <b>x</b>
      </div>`));
      expect(found).to.deep.equal([]);
    });

    it('whitespace under white-space: normal', () => {
      // prettier-ignore
      const found = renderedTemplateWhitespace(mount(html`<div>
        <b>x</b>
      </div>`));
      expect(found).to.deep.equal([]);
    });

    it('nodes the allow predicate accepts', () => {
      const root = mount(indentedFallback('Hello'));
      expect(renderedTemplateWhitespace(root, { allow: () => true })).to.deep.equal([]);
    });
  });
});
