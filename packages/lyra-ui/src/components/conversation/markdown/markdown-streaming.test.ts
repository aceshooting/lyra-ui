import { expect } from '@open-wc/testing';
import type { LyraMarkedParser } from './markdown-loader.js';
import { loadMarkdownDeps } from './markdown-loader.js';
import { MarkdownStreamingBuffer, markdownOpenFence, type MarkdownBlockToken } from './markdown-streaming.js';

async function getLexer(): Promise<(source: string) => readonly MarkdownBlockToken[]> {
  const deps = await loadMarkdownDeps();
  if (!deps.marked) throw new Error('The marked dev peer must be installed for these tests.');
  const parser = new deps.marked.Marked() as LyraMarkedParser & {
    lexer?: (source: string, options?: { gfm?: boolean }) => MarkdownBlockToken[];
  };
  if (typeof parser.lexer !== 'function') throw new Error('The marked lexer API is required.');
  return (source) => parser.lexer!(source, { gfm: true });
}

describe('MarkdownStreamingBuffer', () => {
  it('commits only a complete prefix and scans the unresolved tail as content grows', async () => {
    const lex = await getLexer();
    const buffer = new MarkdownStreamingBuffer();
    const first = buffer.update('# Title\n\nA **partial', lex);
    expect(first.settledBlocks.join('')).to.equal('# Title\n\n');
    expect(first.tail).to.equal('A **partial');

    const source = '# Title\n\nA **partial paragraph**\n\n- one\n';
    const next = buffer.update(source, lex);
    expect(next.newSettledBlocks.join('')).to.equal('A **partial paragraph**\n\n');
    expect(next.settledBlocks.join('')).to.equal('# Title\n\nA **partial paragraph**\n\n');
    expect(next.tail).to.equal('- one\n');
  });

  it('keeps loose and nested list continuation in the mutable tail', async () => {
    const lex = await getLexer();
    const buffer = new MarkdownStreamingBuffer();
    const first = '- first\n\n  - nested\n';
    expect(buffer.update(first, lex).settledBlocks).to.deep.equal([]);
    const continued = '- first\n\n  - nested\n\n- second\n';
    expect(buffer.update(continued, lex).settledBlocks).to.deep.equal([]);
    const closed = buffer.update(`${continued}\n# Next\n`, lex);
    expect(closed.settledBlocks.join('')).to.equal(continued + '\n');
    expect(closed.tail).to.equal('# Next\n');
  });

  it('keeps a quote and a GFM table intact until the following block proves they are closed', async () => {
    const lex = await getLexer();
    const buffer = new MarkdownStreamingBuffer();
    const quoteAndTable = '> quoted\n> continuation\n\n| A | B |\n| - | - |\n| one | two |\n';
    const partial = buffer.update(quoteAndTable, lex);
    expect(partial.settledBlocks.join('')).to.equal('> quoted\n> continuation\n\n');
    expect(partial.tail).to.equal('| A | B |\n| - | - |\n| one | two |\n');
    const closed = buffer.update(`${quoteAndTable}\nAfter\n`, lex);
    expect(closed.settledBlocks.join('')).to.equal(quoteAndTable + '\n');
    expect(closed.tail).to.equal('After\n');
  });

  it('keeps an unterminated tilde or backtick fence live and recognizes its closing marker', async () => {
    const lex = await getLexer();
    for (const [open, close, language] of [
      ['~~~~javascript\n', '~~~~\n', 'javascript'],
      ['````ts\n', '````\n', 'ts'],
    ]) {
      const buffer = new MarkdownStreamingBuffer();
      const partial = `${open}const answer = 42;\n`;
      expect(buffer.update(partial, lex).settledBlocks).to.deep.equal([]);
      expect(markdownOpenFence(partial)).to.deep.equal({
        language,
        code: 'const answer = 42;\n',
      });
      const completed = buffer.update(`${partial}${close}\nAfter\n`, lex);
      expect(completed.settledBlocks.join('')).to.include(`${partial}${close}`);
      expect(completed.tail).to.equal('After\n');
      expect(markdownOpenFence(`${partial}${close}`)).to.equal(null);
    }
  });

  it('preserves the original source offsets for CRLF and indented tab input', async () => {
    const lex = await getLexer();
    const buffer = new MarkdownStreamingBuffer();
    const source = '# Heading\r\n\r\n\tindented code\r\n\r\nNext paragraph';
    const first = buffer.update(source, lex);
    const canonical = source.replace(/\r\n?/g, '\n');
    expect(canonical.startsWith(first.settledBlocks.join(''))).to.equal(true);
    expect(first.settledBlocks.join('')).to.include('# Heading\n');
    const replaced = buffer.update('replacement source', lex);
    expect(replaced.reset).to.equal(true);
    expect(replaced.settledBlocks).to.deep.equal([]);
    expect(replaced.tail).to.equal('replacement source');
  });

  it('waits for a reference definition to settle before parsing its earlier link', async () => {
    const lex = await getLexer();
    const buffer = new MarkdownStreamingBuffer();
    const prefix = 'See [guide][guide].\n\n[guide]: https://example.com/path';
    expect(buffer.update(prefix, lex).settledBlocks).to.deep.equal([]);
    const completed = buffer.update(`${prefix} "Guide"\n\nNext paragraph\n`, lex);
    expect(completed.definitions).to.deep.equal(['[guide]: https://example.com/path "Guide"']);
    expect(completed.settledBlocks.join('')).to.include('See [guide][guide].');
  });

  it('does not keep bracket syntax inside fenced code waiting for a reference definition', async () => {
    const lex = await getLexer();
    const buffer = new MarkdownStreamingBuffer();
    const code = '```ts\nconst value = items[index];\n```\n';
    const snapshot = buffer.update(`${code}\nAfter\n`, lex);
    expect(snapshot.settledBlocks.join('')).to.include(code);
    expect(snapshot.tail).to.equal('After\n');
  });

  it('does not mistake a GFM task checkbox for a shortcut reference link', async () => {
    const lex = await getLexer();
    const buffer = new MarkdownStreamingBuffer();
    const tasks = '- [x] Completed\n\n';
    const snapshot = buffer.update(`${tasks}# Next\n`, lex);
    expect(snapshot.settledBlocks.join('')).to.include(tasks);
    expect(snapshot.tail).to.equal('# Next\n');
  });

  it('waits for a newline after the closing fence marker before committing the fence', async () => {
    const lex = await getLexer();
    const buffer = new MarkdownStreamingBuffer();
    const closed = '```ts\nconst answer = 42;\n```';
    expect(buffer.update(closed, lex).settledBlocks).to.deep.equal([]);
    const completed = buffer.update(`${closed}\n\nNext\n`, lex);
    expect(completed.settledBlocks.join('')).to.include(`${closed}\n\n`);
    expect(completed.tail).to.equal('Next\n');
  });
});
