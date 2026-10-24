import { expect } from '@open-wc/testing';
import { loadMarkdownDeps, type MarkedModule } from './markdown-loader.js';
import { createMarkdownRenderContext, parseMarkdownDocument, type ParseMarkdownOptions, type MarkdownHeadingItem } from './markdown-shared.js';
import { MarkdownProgressiveSession, markdownHtmlBalanced, markdownProgressiveEligible, type MarkdownProgressiveOptions } from './markdown-progressive.js';
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

it('holds an unclosed raw-text element, an unterminated tag, and tolerates stray angle brackets', () => {
  expect(markdownHtmlBalanced('<script>alert(1)')).to.equal(false);
  expect(markdownHtmlBalanced('<style>a > b {}')).to.equal(false);
  expect(markdownHtmlBalanced('<div class="x"')).to.equal(false);
  expect(markdownHtmlBalanced('1 < 2 <')).to.equal(true);
  expect(markdownHtmlBalanced('<script>alert(1)</script><p>done</p>')).to.equal(true);
});

describe('markdownProgressiveEligible rejects parsers it cannot render incrementally', () => {
  const fresh = () => createMarkdownRenderContext(options()).instance;

  it('rejects a parser that lacks the lexer, parser, or token walker capability', () => {
    for (const capability of ['Lexer', 'parser', 'walkTokens'] as const) {
      const parser = fresh();
      Object.assign(parser, { [capability]: undefined });
      expect(markdownProgressiveEligible(parser, true), capability).to.equal(false);
    }
  });

  it('rejects customized tokenizer or hooks defaults', () => {
    const scalar = fresh();
    scalar.defaults['tokenizer'] = 'custom';
    expect(markdownProgressiveEligible(scalar, true), 'a non-object tokenizer').to.equal(false);

    const overriding = fresh();
    overriding.defaults['tokenizer'] = { custom: () => undefined };
    expect(markdownProgressiveEligible(overriding, true), 'a tokenizer with overriding functions').to.equal(false);

    const foreignHooks = fresh();
    foreignHooks.defaults['hooks'] = {};
    expect(markdownProgressiveEligible(foreignHooks, true), 'hooks that are not the parser\'s own').to.equal(false);
  });

  it('rejects a parser whose lexer cannot be constructed', () => {
    const parser = fresh();
    Object.assign(parser, {
      Lexer: class {
        constructor() {
          throw new Error('lexer unavailable');
        }
      },
    });
    expect(markdownProgressiveEligible(parser, true)).to.equal(false);
  });
});

describe('MarkdownProgressiveSession failure and boundary states', () => {
  function sessionWith(render: MarkdownProgressiveOptions['render']): MarkdownProgressiveSession {
    return new MarkdownProgressiveSession({ parser: createMarkdownRenderContext(options()).instance, gfm: true, tabSize: 4, render });
  }

  it('resumes an empty session at the start of the document', () => {
    const value = session();
    value.resume();
    expect(value.end).to.equal(0);
    expect(value.blocks).to.have.lengthOf(0);
    expect(value.pending).to.equal(false);
  });

  it('freezes when a group render fails and then ignores further steps', () => {
    const value = sessionWith(() => {
      throw new Error('render failed');
    });
    value.update('# Title\n\nBody\n\n');
    value.step();

    expect(value.failed).to.equal(true);
    expect(value.blocks).to.have.lengthOf(0);
    const frames = value.stats.frames;
    value.step();
    expect(value.stats.frames).to.equal(frames);
    expect(value.pending).to.equal(false);
  });
});

describe('MarkdownProgressiveSession state transitions', () => {
  function cannedRender(fallsBackToMath: (source: string) => boolean): MarkdownProgressiveOptions['render'] {
    return (source) => ({
      html: `<p>${source.length}</p>`,
      rawHtml: `<p>${source.length}</p>`,
      state: { inLink: false, inRawBlock: false },
      hasRawHtml: false,
      hadMathFallback: fallsBackToMath(source),
      headings: [],
      codeBlocks: [],
      pendingKeys: [],
    });
  }
  const cheapSession = (render: MarkdownProgressiveOptions['render']): MarkdownProgressiveSession =>
    new MarkdownProgressiveSession({ parser: createMarkdownRenderContext(options()).instance, gfm: true, tabSize: 4, render });

  it('re-merges the definitions of retained groups after an edit that is not an append', () => {
    const settled = '[a]: /one\n\nSee [a].\n\n';
    const value = session();
    value.update(`${settled}First tail`);
    drain(value);
    expect(value.blocks.length).to.be.greaterThan(0);

    value.update(`${settled}Second tail`);
    drain(value);
    value.step(true, true);

    expect(value.blocks.map((block) => block.html).join('')).to.equal(parseMarkdownDocument(options(`${settled}Second tail`)).html);
  });

  it('skips a recomputation aimed at a group that an edit already discarded', () => {
    const first = 'a'.repeat(2100);
    const second = 'b'.repeat(2100);
    const value = cheapSession(cannedRender((source) => source.includes('marker')));
    value.update(`${first}\n\n${second}\n\nlast marker\n\n`);
    drain(value);
    expect(value.blocks).to.have.lengthOf(3);

    value.invalidateMath();
    value.update(`${first}\n\nreplacement\n\n`);
    drain(value);

    expect(value.failed).to.equal(false);
    expect(value.blocks[0]!.source).to.equal(`${first}\n\n`);
    expect(value.blocks.at(-1)!.source).to.include('replacement');
  });

  it('reports no live tail when only blank space follows the last settled group', () => {
    const value = session();
    value.update('Hello\n\n   ');
    drain(value);

    expect(value.blocks.length).to.be.greaterThan(0);
    expect(value.tail).to.equal(null);
  });
});
