import { expect } from '@open-wc/testing';
import { loadMarkdownDeps, type MarkedModule } from './markdown-loader.js';
import { createMarkdownRenderContext, parseMarkdownDocument, normalizeMarkdownLeadingTabs, type ParseMarkdownOptions, type MarkdownHeadingItem } from './markdown-shared.js';
import { MarkdownProgressiveSession, markdownHtmlBalanced, markdownProgressiveEligible } from './markdown-progressive.js';
import type { MarkdownCodeBlockRecord } from './markdown-code-header.js';

let marked: MarkedModule;
before(async () => { marked = (await loadMarkdownDeps()).marked!; });

function options(content = ''): ParseMarkdownOptions {
  return { marked, content, gfm: true, linkTarget: null, headingOffset: 0,
    escapeHtmlOption: false, trustedHtmlOption: false, highlightCodeOption: false,
    getCachedHighlight: () => undefined, failedHighlightKeys: new Set(),
    headingAnchorsOption: true, mathOption: false, cachedKatex: null,
    pendingKeys: [], headingTreeOut: [] };
}
function session(): MarkdownProgressiveSession {
  return new MarkdownProgressiveSession({
    parser: createMarkdownRenderContext(options()).instance, gfm: true, tabSize: 4,
    render: (source, rawContent, links, state, slugger) => {
      const headings: MarkdownHeadingItem[] = [], codeBlocks: MarkdownCodeBlockRecord[] = [];
      const result = createMarkdownRenderContext({ ...options(source), rawContent, slugger,
        headingTreeOut: headings, codeBlocksOut: codeBlocks }).render(source, { links, state });
      return { ...result, rawHtml: result.html, headings, codeBlocks, pendingKeys: [] };
    },
  });
}
function drain(value: MarkdownProgressiveSession): void {
  for (let frames = 0; frames < 250; frames++) {
    value.step();
    if (!value.pending) return;
  }
  throw new Error('Progressive work did not settle within its bounded frame count.');
}

const corpus = [
  '# Heading\n\nParagraph with **bold**, `code`, and a [link](/guide).\n\n## Heading\n\nEnd.',
  'Heading\n=======\n\n---\n\nParagraph\n-------\n\nFinal.\n',
  '- tight\n- two\n\n- loose\n\n  paragraph\n\nDone.\n',
  '> quoted\ncontinued\n\n> next\n\nDone.\n',
  '| left | right |\n| :--- | ---: |\n| one | two |\n\nDone.\n',
  '- [x] completed\n- [ ] waiting\n\nDone.\n\n1. [x] ordered\n2. ordinary\n',
  '```js\nconst x = 1;\n\n```~\n\nEnd.\n\n~~~\nbody\n~~~\n',
  'See [label][ref].\n\n# Same\n\n[ref]: /guide "Title"\n\n# Same\n\nDone.\n',
  '[ref]: /guide "A\n\nlong title"\n\nSee [ref].\n\nDone.\n',
  '[ref]: /guide\n\'A\n  \nlong title\'\n\nSee [ref].\n\nDone.\n',
  '# [label]\n\n# label\n\n[label]: /guide\n\n# label\n\nEnd.\n',
  '```make\n\tbuild\n```\n\n\tindented\n\nEnd.\n',
  '<div>\n\ninside\n\n</div>\n\nDone.\n',
  '<pre>\n\n<x>\n</pre>\n\nDone.\n',
  '# CRLF\r\n\r\nA paragraph.\r\n\r\nDone.\r\n',
];

describe('progressive Markdown boundaries and final parity', () => {
  for (const [index, source] of corpus.entries()) for (const chunk of [1, 7, 64]) {
    it(`matches a complete parse for corpus ${index}, chunks of ${chunk}`, () => {
      const value = session();
      for (let end = chunk; end < source.length; end += chunk) {
        value.update(source.slice(0, end));
        drain(value);
        expect(value.failed, `failed at source offset ${end}`).to.equal(false);
      }
      value.update(source);
      value.step(true, true);
      const expected = parseMarkdownDocument(options(normalizeMarkdownLeadingTabs(source, 4))).html;
      expect(value.blocks.map((block) => block.html).join('')).to.equal(expected);
      expect(value.tail).to.equal(null);
    });
  }

  it('keeps a list mutable until a following top-level token arrives', () => {
    const value = session();
    value.update('- one\n\n'); drain(value);
    expect(value.blocks.length).to.equal(0);
    value.update('- one\n\n- two\n\nNext'); drain(value);
    expect(value.blocks.length).to.equal(1);
    expect(value.blocks[0]?.html).to.contain(`<p part='paragraph'>one</p>`);
    expect(value.tail?.text).to.equal('Next');
  });

  it('recomputes references without changing unrelated settled groups', () => {
    const value = session();
    value.update('# Stable\n\n'); drain(value);
    const first = value.blocks[0];
    value.update('# Stable\n\nSee [reference].\n\n'); drain(value);
    value.update('# Stable\n\nSee [reference].\n\n[reference]: /guide\n\nNext'); drain(value);
    expect(value.blocks[0] === first).to.equal(true);
    expect(value.blocks.map((block) => block.html).join('')).to.contain(`href='/guide'`);
  });

  it('bounds repeated lexing of a long open fence and commits its closer immediately', () => {
    const value = session();
    let source = '```text\n';
    for (let index = 0; index < 300; index++) {
      source += 'a'.repeat(100) + '\n'; value.update(source); drain(value);
    }
    expect(value.blocks.length).to.equal(0);
    expect(value.stats.lexedUnits).to.be.lessThan(source.length * 6);
    value.update(source + '```\n'); drain(value);
    expect(value.blocks.length).to.equal(1);
  });

  it('defers repeated reference recomputation after eight map changes and resolves everything at EOF', () => {
    const value = session();
    let source = Array.from({ length: 12 }, (_, index) => `[ref${index}]`).join(' ') + '\n\n';
    value.update(source); drain(value);
    let recomputesAfterEight = 0;
    for (let index = 0; index < 12; index++) {
      source += `[ref${index}]: /v${index}\n\n`;
      value.update(source); drain(value);
      if (index === 7) recomputesAfterEight = value.stats.recomputes;
    }
    expect(value.stats.recomputes).to.equal(recomputesAfterEight);
    expect(value.blocks.map((block) => block.html).join('')).not.to.contain(`href='/v11'`);
    value.step(true, true);
    expect(value.blocks.map((block) => block.html).join('')).to.equal(parseMarkdownDocument(options(normalizeMarkdownLeadingTabs(source, 4))).html);
  });

  it('removes references deleted by a source edit without reparsing unrelated headings', () => {
    const value = session();
    const prefix = '# Stable\n\nSee [ref].\n\n';
    value.update('# Stable\n\n'); drain(value);
    const stable = value.blocks[0];
    value.update(prefix); drain(value);
    value.update(prefix + '[ref]: /guide\n\nNext'); drain(value);
    expect(value.blocks.map((block) => block.html).join('')).to.contain(`href='/guide'`);
    value.update(prefix + 'Replacement'); drain(value);
    expect(value.blocks[0] === stable).to.equal(true);
    expect(value.blocks.map((block) => block.html).join('')).not.to.contain(`href='/guide'`);
  });

  it('caps each catch-up frame and continues its remaining plan', () => {
    const value = session();
    const source = Array.from({ length: 200 }, (_, index) => `# ${index} ${'x'.repeat(1000)}\n\n`).join('');
    value.update(source); value.step();
    expect(value.stats.groupRenders).to.be.at.most(32);
    expect(value.stats.committedUnits).to.be.at.most(65_536);
    expect(value.pending).to.equal(true);
    value.update(source + 'tail'); drain(value);
    expect(value.end).to.equal(source.length);
    expect(value.tail?.text).to.equal('tail');
  });

  it('repairs an edited suffix and withdraws EOF-only groups on resume', () => {
    const value = session();
    value.update('# Stable\n\n'); drain(value);
    const stable = value.blocks[0];
    value.update('# Stable\n\nold tail'); value.step(true, true);
    expect(value.blocks.at(-1)?.eofOnly).to.equal(true);
    value.resume();
    value.update('# Stable\n\nnew tail'); drain(value);
    expect(value.blocks[0] === stable).to.equal(true);
    expect(value.tail?.text).to.equal('new tail');
    value.step(true, true);
    expect(value.blocks.map((block) => block.html).join('')).to.equal(parseMarkdownDocument(options(normalizeMarkdownLeadingTabs(value.source, 4))).html);
  });
});

it('holds incomplete HTML including raw-text contexts and quoted angle brackets', () => {
  for (const source of ['<div><p>text</div>', '<style>a > b {}</style><div>', '<!-- open', '<plaintext>text', '<svg><path>']) {
    expect(markdownHtmlBalanced(source), source).to.equal(false);
  }
  for (const source of ['<div title=">">text</div>', '<!-- <div> --><br>', '<svg><path /></svg>', '<textarea><tag></textarea>']) {
    expect(markdownHtmlBalanced(source), source).to.equal(true);
  }
});

it('admits default and inline renderer configuration but rejects async and block tokenizer extensions', () => {
  const parser = createMarkdownRenderContext(options()).instance;
  expect(markdownProgressiveEligible(parser, true)).to.equal(true);
  parser.defaults['async'] = true;
  expect(markdownProgressiveEligible(parser, true)).to.equal(false);
  parser.defaults['async'] = false;
  parser.defaults['extensions'] = { block: [() => undefined] };
  expect(markdownProgressiveEligible(parser, true)).to.equal(false);
});
