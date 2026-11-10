import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import {
  IncrementalTextQuoteScope,
  createTextQuoteIndex,
  resolveTextQuote,
  scopeFromElement,
} from './text-quote.js';

const fragments = fc.array(fc.constantFrom(
  'a', 'é', 'e\u0301', 'e\u00ad\u0301', 'a\u0315\u0300', '\u0344', '\u1100\u1161\u11a8',
  '😀', '👩‍💻', '\ud83d', '\udc69', '日', '\u00ad', ' ', '\n', '\t', '\u00a0', '<em>',
), { maxLength: 20 });

describe('text quote Unicode and DOM partition properties', () => {
  it('finds the same complete quote after arbitrary UTF-16 splits across inline elements', () => {
    fc.assert(fc.property(fragments, fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 8 }), (parts, widths) => {
      const raw = `Start|${parts.join('')}|End`;
      const whole = document.createElement('div');
      whole.textContent = raw;
      const split = document.createElement('div');
      let cursor = 0, index = 0;
      while (cursor < raw.length) {
        const width = widths[index++ % widths.length]!;
        const span = document.createElement('span');
        span.textContent = raw.slice(cursor, cursor + width);
        split.append(span, document.createComment('inline boundary'));
        cursor += width;
      }
      const original = scopeFromElement(whole);
      const partitioned = scopeFromElement(split);
      expect(partitioned.text).to.equal(original.text);
      expect(partitioned.truncated).to.equal(false);
      const range = resolveTextQuote(partitioned, { quote: original.text });
      expect(range?.toString()).to.equal(raw);
      expect(resolveTextQuote(partitioned, { quote: raw })?.toString()).to.equal(raw);
      expect(range?.startContainer.ownerDocument === split.ownerDocument).to.equal(true);
      expect(split.querySelectorAll('em').length).to.equal(0);
    }), propertyRuns());
  });

  it('keeps incremental normalization and cached searches equivalent to a fresh corpus after every append', () => {
    fc.assert(fc.property(fragments, parts => {
      const root = document.createElement('div');
      root.textContent = 'Start|';
      const builder = new IncrementalTextQuoteScope(root);
      const index = createTextQuoteIndex(builder.update());
      try {
        for (const text of [...parts, '|End']) {
          const span = document.createElement('span');
          span.textContent = text;
          root.append(span);
          const current = builder.update();
          const fresh = scopeFromElement(root);
          expect(current.text).to.equal(fresh.text);
          index.rebindScope(current);
          for (const query of ['Start|', 'é', '각', '😀', '|End']) {
            expect([...index.search(query)]).to.deep.equal([...createTextQuoteIndex(fresh).search(query)]);
          }
        }
        const complete = builder.update();
        const range = resolveTextQuote(complete, { quote: complete.text });
        expect(range?.toString()).to.equal(root.textContent);
      } finally { builder.disconnect(); }
    }), propertyRuns());
  });
});
