import { expect } from '@open-wc/testing';
import type { LyraMarkedParser } from './markdown-loader.js';
import { loadMarkdownDeps } from './markdown-loader.js';
import { markdownFenceClosePattern, parseMarkdownFenceOpener } from './markdown-fence.js';

/** The small block-token shape used from marked's optional lexer. */
interface MarkdownBlockToken {
  type?: string;
  raw: string;
  lang?: string;
}

type MarkdownBlockLexer = (source: string) => readonly MarkdownBlockToken[];

interface MarkdownStreamingSnapshot {
  /** All immutable block source accumulated in this stream generation. */
  settledBlocks: readonly string[];
  /** Blocks newly added to the immutable prefix by this update. */
  newSettledBlocks: readonly string[];
  /** The one lexer tail that remains mutable as more text arrives. */
  tail: string;
  /** Reference definitions seen in this stream, prepended when parsing isolated blocks. */
  definitions: readonly string[];
  /** True when the caller replaced an earlier source rather than appending to it. */
  reset: boolean;
}

/**
 * Keeps Markdown block lexing bounded to the unfinished tail. The caller gives this class the
 * complete source on each property update; on an append it lexes only the previous tail plus the
 * new suffix, then moves lexer-confirmed blocks into a stable prefix. Lists, tables, block quotes,
 * and fenced blocks remain indivisible because marked returns them as top-level block tokens.
 */
class MarkdownStreamingBuffer {
  private source = '';
  private tail = '';
  private readonly settled: string[] = [];
  private readonly definitions: string[] = [];

  update(source: string, lex: MarkdownBlockLexer): MarkdownStreamingSnapshot {
    // Marked normalizes CRLF and CR in token.raw. Use that same canonical source for offsets and
    // parsing so line-ending variants cannot cut the wrong UTF-16 boundary.
    source = source.replace(/\r\n?/g, '\n');
    const reset = !source.startsWith(this.source);
    if (reset) this.reset();
    const appended = source.slice(this.source.length);
    this.source = source;
    this.tail += appended;

    let tokens: readonly MarkdownBlockToken[];
    try {
      tokens = lex(this.tail);
    } catch {
      // A configured marked extension can throw during lexing. Keep the text visible and retry
      // from the current source on the next update rather than retaining a partially trusted tree.
      this.reset();
      this.source = source;
      this.tail = source;
      return this.snapshot([], true);
    }

    let settledCount = countSettledTokens(tokens);
    for (let index = 0; index < settledCount; index++) {
      const token = tokens[index];
      if (token?.type === 'def' && token.raw && !this.definitions.includes(token.raw)) {
        this.definitions.push(token.raw);
      }
    }
    for (let index = 0; index < settledCount; index++) {
      const token = tokens[index];
      if (token?.type !== 'code' && hasUnresolvedReference(token?.raw ?? '', this.definitions)) {
        settledCount = index;
        break;
      }
    }
    const added: string[] = [];
    let consumed = 0;
    for (let index = 0; index < settledCount; index++) {
      const raw = tokens[index]?.raw;
      if (typeof raw !== 'string' || raw.length === 0) continue;
      added.push(raw);
      consumed += raw.length;
    }
    const committedSource = added.join('');
    // Marked's `raw` is meant to be a source slice. Fail closed to a visible mutable tail if a
    // peer extension returns normalized or synthetic token text that cannot safely index the
    // caller's canonical UTF-16 source.
    if (committedSource && !this.tail.startsWith(committedSource)) {
      return this.snapshot([], reset);
    }
    if (consumed > 0) {
      this.settled.push(...added);
      this.tail = this.tail.slice(consumed);
    }
    return this.snapshot(added, reset);
  }

  /** Commits the final tail when streaming ends, allowing the ordinary full parse to take over. */
  finish(): string[] {
    const tail = this.tail;
    if (tail) this.settled.push(tail);
    this.tail = '';
    return [...this.settled];
  }

  reset(): void {
    this.source = '';
    this.tail = '';
    this.settled.length = 0;
    this.definitions.length = 0;
  }

  private snapshot(added: string[], reset: boolean): MarkdownStreamingSnapshot {
    return {
      settledBlocks: [...this.settled],
      newSettledBlocks: added,
      tail: this.tail,
      definitions: [...this.definitions],
      reset,
    };
  }
}

function hasUnresolvedReference(raw: string, definitions: readonly string[]): boolean {
  const available = new Set<string>();
  for (const definition of definitions) {
    const match = /^ {0,3}\[([^\]]+)\]:/m.exec(definition);
    if (match?.[1]) available.add(normalizeReferenceLabel(match[1]));
  }
  const withoutTaskMarkers = raw.replace(/^[ \t]*(?:[-*+]\s+|\d+[.)]\s+)\[[ xX]\][ \t]+/gm, '');
  const withoutInlineCode = withoutTaskMarkers.replace(/(`+)[^`\n]*\1/g, '');
  const references = [
    /!?\[([^\]]+)\]\[([^\]]*)\]/g,
    /!?\[([^\]]+)\](?!\s*[[(])/g,
  ];
  for (const reference of references) for (const match of withoutInlineCode.matchAll(reference)) {
    const label = normalizeReferenceLabel(match[2] || match[1] || '');
    if (label && !available.has(label)) return true;
  }
  return false;
}

function normalizeReferenceLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function countSettledTokens(tokens: readonly MarkdownBlockToken[]): number {
  let lastSubstantive = tokens.length - 1;
  while (lastSubstantive >= 0 && tokens[lastSubstantive]?.type === 'space') lastSubstantive--;
  if (lastSubstantive < 0) return 0;
  const trailingTokens = tokens.slice(lastSubstantive);
  if (
    trailingTokens[0]?.type === 'code' &&
    isClosedFence(trailingTokens.map((token) => token.raw).join(''))
  ) {
    return tokens.length;
  }
  if (lastSubstantive === 0) {
    // A closed fenced block cannot be extended by appended source, so it is safe to commit even
    // while it remains the lexer's last token. An unterminated fence stays in the live tail.
    return isClosedFence(tokens[0]?.raw ?? '') ? 1 : 0;
  }
  const last = tokens[lastSubstantive];
  // Trailing blank lines do not close an extensible list: another list item can follow the blank
  // line and still belong to the same loose list. Keep that token and the separator together.
  const settled = lastSubstantive;
  // A closed final fence is also immutable; otherwise keep the final token alive so paragraph and
  // list continuation remain ordinary Markdown while the stream is in flight.
  return isClosedFence(last?.raw ?? '') ? settled + 1 : settled;
}

function isClosedFence(source: string): boolean {
  const opening = parseMarkdownFenceOpener(source);
  return Boolean(opening && markdownFenceClosePattern(opening).test(source.slice(opening.end, source.lastIndexOf('\n') + 1)));
}

/** Returns an unfinished fenced block's displayable language and code, if the tail is one. */
function markdownOpenFence(source: string): { language: string; code: string } | null {
  const opening = parseMarkdownFenceOpener(source);
  if (!opening || isClosedFence(source)) return null;
  const language = opening.info.trim().split(/\s+/, 1)[0] ?? '';
  return { language, code: source.slice(opening.end) };
}

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

describe('MarkdownStreamingBuffer with unusual peer tokens', () => {
  it('settles nothing from an empty or space-only lex and keeps the text in the live tail', async () => {
    const lex = await getLexer();
    const blank = new MarkdownStreamingBuffer().update('\n\n', lex);
    expect(blank.settledBlocks).to.deep.equal([]);
    expect(blank.tail).to.equal('\n\n');

    const empty = new MarkdownStreamingBuffer().update('', () => []);
    expect(empty.settledBlocks).to.deep.equal([]);
    expect(empty.tail).to.equal('');
  });

  it('skips tokens that carry no source text instead of committing phantom blocks', () => {
    const buffer = new MarkdownStreamingBuffer();
    const spaced = buffer.update('One\n\nTwo', () => [
      { type: 'space', raw: '' },
      { type: 'paragraph', raw: 'One\n\n' },
      { type: 'paragraph', raw: 'Two' },
    ]);
    expect(spaced.newSettledBlocks).to.deep.equal(['One\n\n']);
    expect(spaced.tail).to.equal('Two');

    const malformed = new MarkdownStreamingBuffer().update('Alpha\n\nBeta', () => [
      { type: 'paragraph' } as unknown as MarkdownBlockToken,
      { type: 'paragraph', raw: 'Alpha\n\n' },
      { type: 'paragraph', raw: 'Beta' },
    ]);
    expect(malformed.newSettledBlocks).to.deep.equal(['Alpha\n\n']);
    expect(malformed.tail).to.equal('Beta');
  });

  it('keeps a lone token without source text live instead of settling it', () => {
    const snapshot = new MarkdownStreamingBuffer().update('Only text', () => [
      { type: 'paragraph' } as unknown as MarkdownBlockToken,
    ]);
    expect(snapshot.settledBlocks).to.deep.equal([]);
    expect(snapshot.tail).to.equal('Only text');

    const trailing = new MarkdownStreamingBuffer().update('Alpha\n\nBeta', () => [
      { type: 'paragraph', raw: 'Alpha\n\n' },
      { type: 'paragraph' } as unknown as MarkdownBlockToken,
    ]);
    expect(trailing.newSettledBlocks).to.deep.equal(['Alpha\n\n']);
    expect(trailing.tail).to.equal('Beta');
  });

  it('settles a closed fence even when the peer reports it under another token type', () => {
    const fence = '```text\nbody\n```\n';
    const alone = new MarkdownStreamingBuffer().update(fence, () => [{ type: 'html', raw: fence }]);
    expect(alone.settledBlocks).to.deep.equal([fence]);
    expect(alone.tail).to.equal('');

    const afterProse = new MarkdownStreamingBuffer().update(`Intro\n\n${fence}`, () => [
      { type: 'paragraph', raw: 'Intro\n\n' },
      { type: 'html', raw: fence },
    ]);
    expect(afterProse.settledBlocks).to.deep.equal(['Intro\n\n', fence]);
    expect(afterProse.tail).to.equal('');
  });
});

it('does not treat backticks inside a backtick fence info string as an opener', () => {
  expect(markdownOpenFence('\x60\x60\x60ts\x60\nsource')).to.equal(null);
  expect(markdownOpenFence('~~~sh\x60\nsource')).to.deep.equal({ language: 'sh\x60', code: 'source' });
});

describe('Markdown stream recovery', () => {
  it('preserves complete source after a lexer extension fails and retries it on the next append', () => {
    const buffer = new MarkdownStreamingBuffer();
    const first = buffer.update('first\n\npartial', () => [
      { type: 'paragraph', raw: 'first\n\n' },
      { type: 'paragraph', raw: 'partial' },
    ]);
    expect(first.settledBlocks).to.deep.equal(['first\n\n']);
    const failed = buffer.update('first\n\npartial text', () => {
      throw new Error('extension unavailable');
    });
    expect(failed.reset).to.equal(true);
    expect(failed.settledBlocks).to.deep.equal([]);
    expect(failed.tail).to.equal('first\n\npartial text');
    let retried = '';
    const recovered = buffer.update('first\n\npartial text!', source => {
      retried = source;
      return [{ type: 'paragraph', raw: 'first\n\n' }, { type: 'paragraph', raw: 'partial text!' }];
    });
    expect(retried).to.equal('first\n\npartial text!');
    expect(recovered.settledBlocks).to.deep.equal(['first\n\n']);
    expect(buffer.finish()).to.deep.equal(['first\n\n', 'partial text!']);
    expect(buffer.finish()).to.deep.equal(['first\n\n', 'partial text!']);
  });

  it('keeps the original text mutable when an extension manufactures a different source slice', () => {
    const buffer = new MarkdownStreamingBuffer();
    const source = 'original\n\ntail';
    const snapshot = buffer.update(source, () => [
      { type: 'paragraph', raw: 'manufactured\n\n' },
      { type: 'paragraph', raw: 'tail' },
    ]);
    expect(snapshot.settledBlocks).to.deep.equal([]);
    expect(snapshot.tail).to.equal(source);
    expect(buffer.finish()).to.deep.equal([source]);
  });

  it('settles a closed fence together with trailing whitespace without waiting for another block', () => {
    const buffer = new MarkdownStreamingBuffer();
    const fence = '```ts\nconst value = 1;\n```\n';
    const snapshot = buffer.update(fence + '\n', () => [
      { type: 'code', raw: fence }, { type: 'space', raw: '\n' },
    ]);
    expect(snapshot.settledBlocks).to.deep.equal([fence, '\n']);
    expect(snapshot.tail).to.equal('');
  });
});
