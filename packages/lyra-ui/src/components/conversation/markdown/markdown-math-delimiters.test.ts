import { expect } from '@open-wc/testing';
import { loadMarkdownDeps } from './markdown-loader.js';
import { parseMarkdownDocument } from './markdown-shared.js';

async function renderInline(content: string): Promise<{ math: string[]; text: string }> {
  const marked = (await loadMarkdownDeps()).marked!;
  const { html } = parseMarkdownDocument({
    marked,
    content,
    gfm: true,
    linkTarget: null,
    headingOffset: 0,
    escapeHtmlOption: false,
    trustedHtmlOption: false,
    highlightCodeOption: false,
    getCachedHighlight: () => undefined,
    failedHighlightKeys: new Set(),
    headingAnchorsOption: false,
    mathOption: true,
    cachedKatex: {
      renderToString: (tex: string) => `<math><mi>${tex}</mi></math>`,
    },
    pendingKeys: [],
    headingTreeOut: [],
  });
  const container = document.createElement('div');
  container.innerHTML = html;
  return {
    math: Array.from(container.querySelectorAll('[part="math"]'), (node) => node.textContent ?? ''),
    text: container.textContent ?? '',
  };
}

describe('inline math delimiters', () => {
  it('leaves two currency amounts on one line as prose', async () => {
    const result = await renderInline('It costs $500,000 and $200 more.');
    expect(result.math).to.deep.equal([]);
    expect(result.text).to.contain('It costs $500,000 and $200 more.');
  });

  it('does not close a span on a dollar sign followed by a digit', async () => {
    const result = await renderInline('Pay $5 now or $10 later.');
    expect(result.math).to.deep.equal([]);
    expect(result.text).to.contain('Pay $5 now or $10 later.');
  });

  it('does not close a span on a dollar sign preceded by whitespace', async () => {
    const result = await renderInline('From $x to $ y.');
    expect(result.math).to.deep.equal([]);
  });

  it('does not open a span on a dollar sign followed by whitespace', async () => {
    const result = await renderInline('A $ x$ sign.');
    expect(result.math).to.deep.equal([]);
  });

  it('still recognizes ordinary inline math', async () => {
    const result = await renderInline('Area $x^2$ and $a$ plus $b$.');
    expect(result.math).to.deep.equal(['x^2', 'a', 'b']);
  });

  it('keeps an escaped dollar sign inside a span', async () => {
    const result = await renderInline('Price $\\$5$ exactly.');
    expect(result.math).to.deep.equal(['$5']);
  });

  it('still recognizes display math', async () => {
    const result = await renderInline('$$E = mc^2$$');
    expect(result.math).to.deep.equal(['E = mc^2']);
  });
});
