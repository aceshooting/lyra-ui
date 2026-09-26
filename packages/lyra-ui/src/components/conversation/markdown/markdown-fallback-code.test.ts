import { expect } from '@open-wc/testing';
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
