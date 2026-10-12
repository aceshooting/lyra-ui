import { expect } from '@open-wc/testing';
import { loadMarkdownDeps, type MarkedModule } from './markdown-loader.js';
import { createMarkdownRenderContext, parseMarkdownDocument, type ParseMarkdownOptions, type MarkdownHeadingItem } from './markdown-shared.js';
import { MarkdownProgressiveSession, markdownHtmlBalanced } from './markdown-progressive.js';
import type { MarkdownCodeBlockRecord } from './markdown-code-header.js';

let marked: MarkedModule;
before(async () => { marked = (await loadMarkdownDeps()).marked!; });

function options(content = ''): ParseMarkdownOptions {
  return {
    marked, content, gfm: true, linkTarget: null, headingOffset: 0,
    escapeHtmlOption: false, trustedHtmlOption: false, highlightCodeOption: false,
    getCachedHighlight: () => undefined, failedHighlightKeys: new Set(),
    headingAnchorsOption: true, mathOption: false, cachedKatex: null,
    pendingKeys: [], headingTreeOut: [],
  };
}

function session(): MarkdownProgressiveSession {
  return new MarkdownProgressiveSession({
    parser: createMarkdownRenderContext(options()).instance,
    gfm: true,
    tabSize: 4,
    render: (source, rawContent, links, state, slugger) => {
      const headings: MarkdownHeadingItem[] = [];
      const codeBlocks: MarkdownCodeBlockRecord[] = [];
      const result = createMarkdownRenderContext({
        ...options(source), rawContent, slugger, headingTreeOut: headings, codeBlocksOut: codeBlocks,
      }).render(source, { links, state });
      return { ...result, rawHtml: result.html, headings, codeBlocks, pendingKeys: [] };
    },
  });
}

function drain(value: MarkdownProgressiveSession): void {
  for (let frame = 0; frame < 250; frame += 1) {
    value.step();
    if (!value.pending) return;
  }
  throw new Error('Progressive Markdown did not settle within the bounded frame count.');
}

it('recognizes complete declarations and processing instructions while holding an open declaration', () => {
  expect(markdownHtmlBalanced('<!DOCTYPE html><p>Ready</p>')).to.equal(true);
  expect(markdownHtmlBalanced('<?process value?><p>Ready</p>')).to.equal(true);
  expect(markdownHtmlBalanced('<!DOCTYPE html')).to.equal(false);
  // The tokenizer ignores a stray close when there is no matching open element.
  expect(markdownHtmlBalanced('<!DOCTYPE html><p>Ready</p></orphan>')).to.equal(true);
});

it('withdraws an EOF-only reference definition on resume and renders the replacement target', () => {
  const value = session();
  const settled = '# Stable\n\nSee [ref].\n\n';
  value.update(settled);
  drain(value);
  expect(value.blocks[0]?.headings.map((item) => item.label)).to.deep.equal(['Stable']);

  const provisional = `${settled}[ref]: /old-target\n\nold tail`;
  value.update(provisional);
  value.step(true, true);
  expect(value.blocks.at(-1)?.eofOnly).to.equal(true);
  expect(value.blocks.map((block) => block.html).join('')).to.contain("href='/old-target'");

  value.resume();
  const replacement = `${settled}[ref]: /new-target\n\nnew tail`;
  value.update(replacement);
  value.step(true, true);

  const rendered = value.blocks.map((block) => block.html).join('');
  expect(rendered).to.contain("href='/new-target'");
  expect(rendered).not.to.contain("href='/old-target'");
  expect(rendered).to.equal(parseMarkdownDocument(options(replacement)).html);
});
