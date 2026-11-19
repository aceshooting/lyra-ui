import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { isMarkdownFenceCloser, markdownFenceClosePattern, matchMarkdownFenceLine, parseMarkdownFenceOpener } from './markdown-fence.js';

it('agrees on top-level closers in preserved and normalized source', () => {
  const marker = fc.constantFrom('`', '~');
  const length = fc.integer({ min: 3, max: 16 });
  const suffix = fc.constantFrom('', ' ', '\t', ' \t ', '\u00a0', ' language', ' more`');
  fc.assert(fc.property(marker, length, marker, length, suffix, (openChar, openLength, closeChar, closeLength, trailing) => {
    const opener = openChar.repeat(openLength) + ' language';
    const closer = closeChar.repeat(closeLength) + trailing;
    const opening = parseMarkdownFenceOpener(`${opener}\ncode`)!;
    const candidate = matchMarkdownFenceLine(closer);
    const horizontalSpace = ['', ' ', '\t', ' \t '].includes(trailing);
    const closes = openChar === closeChar && closeLength >= openLength && horizontalSpace;
    expect(opening.end).to.equal(opener.length + 1);
    expect(candidate !== null && isMarkdownFenceCloser(opening, candidate)).to.equal(closes);
    expect(markdownFenceClosePattern(opening).test(`code\n${closer}\n`)).to.equal(closes);
    expect(parseMarkdownFenceOpener(opener)).to.equal(null);
  }), propertyRuns());
});
