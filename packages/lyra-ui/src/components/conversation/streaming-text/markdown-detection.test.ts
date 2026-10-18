import { expect } from '@open-wc/testing';
import { IncrementalMarkdownDetector, looksLikeMarkdown } from './markdown-detection.js';
it('matches existing detection at every boundary, including long unresolved delimiters and replacements', () => {
  const corpus = ['# heading', '   ###### title', '    # ordinary', '123456789012345. item', '>\nquote',
    '**' + 'long '.repeat(1000) + '**', '[' + 'long '.repeat(1000) + '](url)', '`' + 'x'.repeat(10000) + '`',
    '_x_', '_x_a', '__x_', 'a_x_', '_x_!', '``x`', '```', '* a', '---', '#\n\nheading', 'x\r# title'];
  let seed = 7;
  const alphabet = 'a _*`[]()\n\r#>123.\t';
  for (let sample = 0; sample < 100; sample++) {
    let value = '';
    for (let index = 0; index < 80; index++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; value += alphabet[seed % alphabet.length]; }
    corpus.push(value);
  }
  for (const source of corpus) {
    const detector = new IncrementalMarkdownDetector();
    for (let end = 0; end <= source.length; end++) {
      const prefix = source.slice(0, end);
      expect(detector.update(prefix), JSON.stringify(prefix.slice(-80))).equal(looksLikeMarkdown(prefix));
    }
    expect(detector.update('ordinary replacement')).equal(false);
    expect(detector.update('_x_')).equal(true);
    expect(detector.update('_x_a')).equal(false);
    expect(detector.scannedCodeUnits).at.most(source.length + 40);
  }
});
