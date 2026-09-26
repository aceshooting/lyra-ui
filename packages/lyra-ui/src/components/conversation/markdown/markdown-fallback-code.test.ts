import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { marked } from 'marked';
import { MarkdownFallbackCodeScanner, segmentMarkdownFallback, matchMarkdownFenceLine } from './markdown-fallback-code.js';

describe('Markdown fallback source segmentation', () => {
  const cases = [
    'Arabic prose العربية `--flag` remains.\n```ts\nconst x = 1;\n```\nNext',
    '  ~~~ c++\r\n\tcode\r\n  ~~~~\r\n',
    'a ``x ` y`` z\n\\`literal` and `real` end\n',
    '`unmatched ``pair`` then\n> ```\n- ```\n',
    '```ts`invalid\ntext\n',
  ];
  for (const source of cases) it(`preserves every source character: ${JSON.stringify(source)}`, () => {
    const scanner = new MarkdownFallbackCodeScanner();
    for (let end = 0; end <= source.length; end++) {
      const prefix = source.slice(0, end);
      const result = scanner.segments(prefix);
      expect(result?.map((segment) => segment.text).join('') ?? prefix).to.equal(prefix);
      expect(result).to.deep.equal(segmentMarkdownFallback(prefix));
      expect(scanner.segments(prefix) === result).to.equal(true);
    }
  });
  it('classifies complete fences without accepting a backtick in their info', () => {
    expect(matchMarkdownFenceLine(' \t~~~~ js')?.length).to.equal(4);
    expect(matchMarkdownFenceLine('```ts`')).to.equal(null);
    expect(matchMarkdownFenceLine('> ```')).to.equal(null);
  });
  it('keeps completed segment objects and bounds long-line classification work', () => {
    const scanner = new MarkdownFallbackCodeScanner();
    const first = scanner.segments('```\nx\n```\n');
    const source = '```\nx\n```\n' + 'long prose '.repeat(10_000);
    for (let end = 12; end < source.length; end += 31) scanner.segments(source.slice(0, end));
    const last = scanner.segments(source);
    expect(last?.[0] === first?.[0]).to.equal(true);
    expect(scanner.scannedCodeUnits).to.be.lessThan(source.length * 3);
    expect(scanner.segments('replacement')).to.equal(null);
  });
  it('bounds independent block and inline runs without losing source text', () => {
    const source = ('`x`\n```\ny\n```\n').repeat(140);
    const result = segmentMarkdownFallback(source)!;
    expect(result.filter((segment) => segment.kind === 'block').length).to.equal(128);
    expect(result.filter((segment) => segment.kind === 'inline').length).to.equal(128);
    expect(result.map((segment) => segment.text).join('')).to.equal(source);
  });
});

type Kinds = Array<[string, string]>;
const kinds = (source: string): Kinds | null =>
  segmentMarkdownFallback(source)?.map((segment) => [segment.kind, segment.text]) ?? null;

describe('Markdown fallback scanner contract', () => {
  it('returns null when there is neither a fence nor an inline pair', () => {
    expect(segmentMarkdownFallback('')).to.equal(null);
    expect(segmentMarkdownFallback('plain prose\nwith lines\n')).to.equal(null);
    expect(segmentMarkdownFallback('a `b c\n')).to.equal(null);
  });

  it('splits prose, the whole fenced run and following prose at line boundaries', () => {
    expect(kinds('P\n```js\ncode\n```\nQ')).to.deep.equal([
      ['prose', 'P\n'], ['block', '```js\ncode\n```\n'], ['prose', 'Q'],
    ]);
  });

  it('follows fence opening and closing rules', () => {
    expect(kinds('P\n```js\ncode')).to.deep.equal([['prose', 'P\n'], ['block', '```js\ncode']]);
    expect(kinds('P\n~~~\ncode\n~~~\n')).to.deep.equal([['prose', 'P\n'], ['block', '~~~\ncode\n~~~\n']]);
    expect(kinds('```\na\n````\nb')).to.deep.equal([['block', '```\na\n````\n'], ['prose', 'b']]);
    expect(kinds('```\na\n``\nb\n~~~\nc')).to.deep.equal([['block', '```\na\n``\nb\n~~~\nc']]);
    expect(kinds('```a`b\nx\n')).to.equal(null);
    expect(kinds('~~~a`b\nx\n~~~\n')).to.deep.equal([['block', '~~~a`b\nx\n~~~\n']]);
    expect(kinds('   ```\nx\n```\n')).to.deep.equal([['block', '   ```\nx\n```\n']]);
    expect(kinds('> ```\nx\n')).to.equal(null);
    expect(kinds('- ```js\nx\n')).to.equal(null);
    expect(kinds('```\r\nx\r\n```\r\nz')).to.deep.equal([['block', '```\r\nx\r\n```\r\n'], ['prose', 'z']]);
  });

  it('probes an unterminated tail line as a tentative fence', () => {
    expect(kinds('P\n```js')).to.deep.equal([['prose', 'P\n'], ['block', '```js']]);
    // A backtick in a backtick fence's info disqualifies it at once, before any newline.
    expect(kinds('P\n```a`')).to.equal(null);
    expect(kinds('P\n~~~a`b')).to.deep.equal([['prose', 'P\n'], ['block', '~~~a`b']]);
    expect(kinds('P\n``')).to.equal(null);
    const fences = '```\nx\n```\n'.repeat(128);
    expect(segmentMarkdownFallback(`${fences}\`\`\`js`)!.at(-1)).to.deep.equal({ kind: 'prose', text: '```js' });
  });

  it('caps block and inline runs independently', () => {
    const fences = '```\nx\n```\n'.repeat(128);
    const blocks = segmentMarkdownFallback(`${fences}\`\`\`\ny\n\`\`\`\n`)!;
    expect(blocks.filter((segment) => segment.kind === 'block').length).to.equal(128);
    expect(blocks.at(-1)).to.deep.equal({ kind: 'prose', text: '```\ny\n```\n' });
    const inlines = '`x`\n'.repeat(128);
    expect(segmentMarkdownFallback(`${inlines}\`z\`\n`)!.filter((segment) => segment.kind === 'inline').length).to.equal(128);
    const mixed = segmentMarkdownFallback(`${inlines}\`\`\`\nq\n\`\`\`\n`)!;
    expect(mixed.filter((segment) => segment.kind === 'block').length).to.equal(1);
  });

  it('pairs inline code spans like CommonMark within one line', () => {
    expect(kinds('use `--verbose` now\n')).to.deep.equal([['prose', 'use '], ['inline', '`--verbose`'], ['prose', ' now\n']]);
    expect(kinds('a ``a`b`` z\n')).to.deep.equal([['prose', 'a '], ['inline', '``a`b``'], ['prose', ' z\n']]);
    expect(kinds('``x `y` z\n')).to.deep.equal([['prose', '``x '], ['inline', '`y`'], ['prose', ' z\n']]);
    expect(kinds('\\`no` here `yes`\n')).to.deep.equal([['prose', '\\`no'], ['inline', '` here `'], ['prose', 'yes`\n']]);
    expect(kinds('a `b\\` c\n')).to.deep.equal([['prose', 'a '], ['inline', '`b\\`'], ['prose', ' c\n']]);
    expect(kinds('```\n`in` fence\n```\n')).to.deep.equal([['block', '```\n`in` fence\n```\n']]);
    expect(kinds('~~~ `x`\nbody `y`\n~~~\n')).to.deep.equal([['block', '~~~ `x`\nbody `y`\n~~~\n']]);
  });

  it('commits a tail span only once the closing run cannot grow', () => {
    expect(kinds('tail `a`')).to.equal(null);
    expect(kinds('tail `a` more')).to.deep.equal([['prose', 'tail '], ['inline', '`a`'], ['prose', ' more']]);
    expect(kinds('tail `a``')).to.equal(null);
    expect(kinds('``x `y` z')).to.equal(null);
  });

  it('pairs a line of unmatched openers in linear work', () => {
    const scanner = new MarkdownFallbackCodeScanner();
    const line = '` ``'.repeat(2_500) + '\n';
    scanner.segments(line);
    expect(scanner.scannedCodeUnits).to.be.at.most(line.length * 2);
  });

  it('bounds incremental work, rescans once after a non-prefix edit and keeps identities', () => {
    const scanner = new MarkdownFallbackCodeScanner();
    const unit = 'prose `x` more\n```js\nconst a = 1;\n```\n';
    let content = '';
    let chunks = 0;
    while (content.length < 100_000) {
      content += unit.slice(0, 25);
      content += unit.slice(25);
      chunks += 2;
      scanner.segments(content.slice(0, content.length - unit.length + 25));
      scanner.segments(content);
    }
    expect(scanner.scannedCodeUnits).to.be.at.most(2 * content.length + chunks * 64);
    const first = scanner.segments(content)!;
    expect(scanner.segments(content) === first).to.equal(true);
    const appended = scanner.segments(`${content}tail`)!;
    expect(appended[0] === first[0]).to.equal(true);
    const edited = `X${content.slice(1)}`;
    scanner.segments(edited);
    // A non-prefix edit resets the scanner, so the counter now measures exactly one rescan.
    const rescan = scanner.scannedCodeUnits;
    expect(rescan).to.be.at.least(edited.length);
    expect(rescan).to.be.at.most(2 * edited.length);
  });

  it('matches complete fence lines table-driven', () => {
    const table: Array<[string, { char: string; length: number; indent: number; info: string } | null]> = [
      ['   ```js', { char: '`', length: 3, indent: 3, info: 'js' }],
      ['\t~~~~', { char: '~', length: 4, indent: 1, info: '' }],
      ['```\r', { char: '`', length: 3, indent: 0, info: '' }],
      ['```   ', { char: '`', length: 3, indent: 0, info: '   ' }],
      ['~~~ `x', { char: '~', length: 3, indent: 0, info: ' `x' }],
      ['``` `x', null],
      ['``', null],
      ['text', null],
      ['> ```', null],
    ];
    for (const [line, expected] of table) expect(matchMarkdownFenceLine(line), JSON.stringify(line)).to.deep.equal(expected);
  });

  it('agrees with the one-shot segmentation for every prefix of random documents (oracle property)', () => {
    const piece = fc.constantFrom('prose ', 'عربي ', '`x`', '``a`b``', '`', '\\`', '\n', '```js\n', '```\n', '~~~\n', '    ', '> ', '- ', '\r\n');
    fc.assert(fc.property(fc.array(piece, { maxLength: 40 }), fc.array(fc.nat(8), { maxLength: 40 }), (pieces, splits) => {
      const source = pieces.join('');
      const scanner = new MarkdownFallbackCodeScanner();
      let at = 0;
      for (const step of splits) {
        at = Math.min(source.length, at + step);
        const prefix = source.slice(0, at);
        const result = scanner.segments(prefix);
        expect(result).to.deep.equal(segmentMarkdownFallback(prefix));
        expect(result?.map((segment) => segment.text).join('') ?? prefix).to.equal(prefix);
      }
      expect(scanner.segments(source)).to.deep.equal(segmentMarkdownFallback(source));
    }), { numRuns: 200 });
  });
});

describe('Markdown fallback scanner vs marked', () => {
  interface LexToken { type: string; raw: string; codeBlockStyle?: string; items?: Array<{ raw: string; tokens: LexToken[] }>; tokens?: LexToken[] }
  const lineCount = (raw: string): number => raw.replace(/\n+$/, '').split('\n').length;
  const newlines = (raw: string): number => (raw.match(/\n/g) ?? []).length;
  function markedBlocks(source: string): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    const walk = (tokens: LexToken[], line: number): void => {
      for (const token of tokens) {
        if (token.type === 'code' && token.codeBlockStyle !== 'indented') out.push([line, line + lineCount(token.raw)]);
        if (token.type === 'blockquote') walk(token.tokens ?? [], line);
        if (token.type === 'list') {
          let itemLine = line;
          for (const item of token.items ?? []) { walk(item.tokens, itemLine); itemLine += newlines(item.raw); }
        }
        line += newlines(token.raw);
      }
    };
    walk(marked.lexer(source, { gfm: true }) as unknown as LexToken[], 0);
    return out;
  }
  function scannerBlocks(source: string): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    let line = 0;
    for (const segment of segmentMarkdownFallback(source) ?? []) {
      if (segment.kind === 'block') out.push([line, line + lineCount(segment.text)]);
      line += newlines(segment.text);
    }
    return out;
  }
  const corpus = [
    'Intro\n\n```js\nconst a = 1;\n```\n\nOutro\n',
    '1. step\n\n   ```sh\n   npm i\n   ```\n2. next\n',
    '- item\n  ```\n  x\n  ```\n- other\n',
    '~~~\n```\nnested\n```\n~~~\n',
    '````md\n```js\ninner\n```\n````\ntext\n',
    'text\n\n```py\nunclosed\nstill\n',
    'One `a` two ``b`c`` three ```d``` four\n',
  ];
  for (const source of corpus) it(`finds the same fenced line ranges: ${JSON.stringify(source)}`, () => {
    expect(scannerBlocks(source)).to.deep.equal(markedBlocks(source));
  });

  it('finds the same inline spans on single-line paragraphs', () => {
    const source = 'One `a` two ``b`c`` three ```d``` four\n';
    const paragraph = (marked.lexer(source, { gfm: true }) as unknown as LexToken[]).find((token) => token.type === 'paragraph')!;
    const spans = paragraph.tokens!.filter((token) => token.type === 'codespan').map((token) => token.raw);
    expect(segmentMarkdownFallback(source)!.filter((segment) => segment.kind === 'inline').map((segment) => segment.text)).to.deep.equal(spans);
  });

  const divergences: Array<[string, string]> = [
    ['a fence inside a blockquote', '> ```\n> x\n> ```\n'],
    ['a fence on a list-marker line', '- ```js\n  x\n  ```\n'],
    ['an opener indented four columns at top level', '    ```\nx\n```\n'],
    ['a fence inside an HTML block', '<div>\n```\nx\n```\n</div>\n'],
    ['a code span that crosses a line break', 'a `b\nc` d\n'],
    ['CR-only line endings', '```\rx\r```\r'],
  ];
  for (const [label, source] of divergences) it(`documents the accepted divergence for ${label}`, () => {
    const inline = segmentMarkdownFallback(source)?.filter((segment) => segment.kind === 'inline') ?? [];
    const paragraphs = (marked.lexer(source, { gfm: true }) as unknown as LexToken[]).flatMap((token) => token.tokens ?? []);
    const codespans = paragraphs.filter((token) => token.type === 'codespan');
    expect(
      JSON.stringify([scannerBlocks(source), inline.length]) !== JSON.stringify([markedBlocks(source), codespans.length]),
    ).to.equal(true);
  });
});
