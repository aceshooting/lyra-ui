import { expect } from '@open-wc/testing';
import { buildQuoteAnchor, scopeFromElement } from './text-quote.js';

describe('selection context under cumulative boundary work', () => {
  for (const crowdedSide of ['before', 'after'] as const) {
    it(`keeps the selected quote when ${crowdedSide} runs exhaust element-boundary mapping`, () => {
      const root = document.createElement('div');
      let parent = root;
      for (let depth = 0; depth < 32; depth++) {
        const nested = document.createElement('div');
        parent.append(nested);
        parent = nested;
      }
      const runs = document.createDocumentFragment();
      for (let index = 0; index < 1_000; index++) {
        const span = document.createElement('span');
        span.textContent = 'x ';
        runs.append(span);
      }
      const selected = document.createElement('span');
      selected.textContent = 'needle';
      if (crowdedSide === 'before') parent.append(runs, selected, ' after');
      else parent.append('before ', selected, runs);

      const scope = scopeFromElement(root);
      expect(scope.truncated).to.equal(false);
      const textRange = document.createRange();
      textRange.selectNodeContents(selected.firstChild!);
      const directlyMapped = buildQuoteAnchor(textRange, scope);
      expect(directlyMapped.kind).to.equal('text-quote');
      if (directlyMapped.kind !== 'text-quote') throw new Error('Expected a text quote anchor');
      expect(directlyMapped.quote).to.equal('needle');
      expect(directlyMapped.prefix).to.be.a('string').and.not.equal('');
      expect(directlyMapped.suffix).to.be.a('string').and.not.equal('');

      const elementRange = document.createRange();
      elementRange.selectNodeContents(selected);
      const anchor = buildQuoteAnchor(elementRange, scope);
      expect(anchor).to.deep.equal(crowdedSide === 'before'
        ? { kind: 'text-quote', quote: 'needle', suffix: 'after' }
        : { kind: 'text-quote', quote: 'needle', prefix: 'before' });
      expect(elementRange.toString()).to.equal('needle');
      expect(selected.textContent).to.equal('needle');
    });
  }
});
