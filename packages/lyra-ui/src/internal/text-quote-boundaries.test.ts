import { expect } from '@open-wc/testing';
import {
  IncrementalTextQuoteScope,
  boundedSelectionText,
  buildQuoteAnchor,
  createTextQuoteIndex,
  rangeFromTextQuoteMatch,
  rangesFromTextQuoteMatches,
  resolveTextQuote,
  scopeFromElement,
  scopeFromItems,
} from './text-quote.js';

describe('text quote public boundary contracts', () => {
  it('matches copied quote text containing a soft hyphen inside a combining sequence', () => {
    const root = document.createElement('div');
    root.textContent = 'cafe\u00ad\u0301';
    const scope = scopeFromElement(root);
    expect(scope.text).to.equal('café');
    expect(resolveTextQuote(scope, { quote: root.textContent })?.toString()).to.equal(root.textContent);
    const selection = document.createRange();
    selection.selectNodeContents(root);
    expect(buildQuoteAnchor(selection, scope)).to.deep.include({ kind: 'text-quote', quote: 'café' });
  });

  it('preserves an emoji sequence split between UTF-16 surrogate halves', () => {
    const raw = 'Start|👩‍💻|End';
    const root = document.createElement('div');
    for (const unit of raw.split('')) {
      const span = document.createElement('span');
      span.textContent = unit;
      root.append(span, document.createComment('inline boundary'));
    }
    expect(root.textContent).to.equal(raw);
    const scope = scopeFromElement(root);
    expect([...scope.text].map(value => value.codePointAt(0))).to.deep.equal([...raw].map(value => value.codePointAt(0)));
    expect(resolveTextQuote(scope, { quote: raw })?.toString()).to.equal(raw);
  });

  it('refreshes a cached emoji search as streaming text completes surrogate pairs', () => {
    const root = document.createElement('div');
    root.textContent = 'Start|';
    const builder = new IncrementalTextQuoteScope(root);
    const index = createTextQuoteIndex(builder.update());
    try {
      expect(index.search('👩‍💻').length).to.equal(0);
      for (const unit of '👩‍💻'.split('')) {
        root.append(document.createTextNode(unit));
        const scope = builder.update();
        expect(scope.text).to.equal(root.textContent);
        index.rebindScope(scope);
      }
      const match = index.search('👩‍💻').at(0);
      expect(match).to.deep.equal({ start: 6, end: 11 });
      if (!match) throw new Error('Expected the completed emoji to be searchable');
      expect(rangeFromTextQuoteMatch(builder.update(), match)?.toString()).to.equal('👩‍💻');
    } finally { builder.disconnect(); }
  });

  for (const segmenter of ['native', 'fallback'] as const) {
    it(`collapses whitespace before an expanding grapheme with the ${segmenter} segmenter`, () => {
      const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')!;
      if (segmenter === 'fallback') Object.defineProperty(Intl, 'Segmenter', { ...descriptor, value: undefined });
      try {
        const root = document.createElement('div');
        const raw = 'Start|\u00a0 \u0344|End';
        const normalized = 'Start| \u0308\u0301|End';
        root.textContent = raw;
        for (const limits of [undefined, { maxCorpusCodeUnits: normalized.length }]) {
          const scope = scopeFromElement(root, limits);
          expect(scope.text).to.equal(normalized);
          expect(scope.truncated).to.equal(false);
          const range = resolveTextQuote(scope, { quote: normalized });
          expect(range?.toString()).to.equal(raw);
          expect(range?.startOffset).to.equal(0);
          expect(range?.endOffset).to.equal(raw.length);
          expect(resolveTextQuote(scope, { quote: '\u0308\u0301' })?.toString()).to.equal(' \u0344');
        }
      } finally { Object.defineProperty(Intl, 'Segmenter', descriptor); }
    });
  }

  it('applies the query ceiling after NFC expands a combining character', () => {
    const root = document.createElement('div');
    root.textContent = '\u0344';
    const scope = scopeFromElement(root);
    expect(scope.text).to.equal('\u0308\u0301');
    const limited = createTextQuoteIndex(scope, 'en', { maxQueryCodeUnits: 1 });
    const matches = limited.search('\u0344');
    expect(matches.length).to.equal(0);
    expect(matches.scanComplete).to.equal(false);
    expect(limited.resolve({ quote: '\u0344' })).to.equal(null);
    expect(createTextQuoteIndex(scope, 'en', { maxQueryCodeUnits: 2 }).resolve({ quote: '\u0344' }))
      .to.deep.equal({ start: 0, end: 2 });
  });

  for (const context of ['prefix', 'suffix'] as const) {
    it(`rejects a cached contextual match when the ${context} whitespace exhausts the budget`, () => {
      const root = document.createElement('div');
      root.textContent = 'before target after';
      const index = createTextQuoteIndex(scopeFromElement(root), 'en');
      const anchor = context === 'prefix'
        ? { quote: 'target', prefix: 'before' }
        : { quote: 'target', suffix: 'after' };
      expect(index.resolve(anchor)?.start).to.equal(7);
      const scans = index.scanCount;
      const length = context === 'prefix' ? 6 : 5;
      expect(index.resolve(anchor, index.createWorkBudget(length))).to.equal(null);
      expect(index.resolve(anchor, index.createWorkBudget(length + 1))?.start).to.equal(7);
      expect(index.scanCount, 'both attempts reuse the occurrence and folded corpus caches').to.equal(scans);
    });
  }

  it('refuses to choose an early contextual candidate after cached context scoring runs out of work', () => {
    const root = document.createElement('div');
    root.textContent = 'A target B target';
    const index = createTextQuoteIndex(scopeFromElement(root), 'en');
    const anchor = { quote: 'target', prefix: 'B' };
    expect(index.resolve(anchor)?.start).to.equal(11);
    const scans = index.scanCount;
    expect(index.resolve(anchor, index.createWorkBudget(2))).to.equal(null);
    expect(index.resolve(anchor, index.createWorkBudget(4))?.start).to.equal(11);
    expect(index.scanCount).to.equal(scans);
  });

  it('rescans an incomplete occurrence cache after an incremental append', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>target target </p>';
    const builder = new IncrementalTextQuoteScope(root);
    try {
      const index = createTextQuoteIndex(builder.update(), 'en', { maxMatches: 1 });
      const previous = index.search('target');
      expect(previous.length).to.equal(1);
      expect(previous.scanComplete).to.equal(false);
      root.insertAdjacentHTML('beforeend', '<p>target</p>');
      expect(index.rebindScope(builder.update())).to.equal(true);
      const scans = index.scanCount;
      const next = index.search('target');
      expect(index.scanCount).to.equal(scans + 1);
      expect(next.at(0)).to.deep.equal({ start: 0, end: 6 });
      expect(next.scanComplete).to.equal(false);
      expect(next.matchCountExact).to.equal(false);
    } finally {
      builder.disconnect();
    }
  });

  it('handles a comment-only retained prefix before text arrives', () => {
    const root = document.createElement('div');
    root.append(document.createComment('render boundary'));
    const builder = new IncrementalTextQuoteScope(root);
    try {
      expect(builder.update().text).to.equal('');
      root.append(document.createTextNode('e'), document.createTextNode('\u0301'));
      const scope = builder.update();
      expect(scope.text).to.equal('é');
      expect(resolveTextQuote(scope, { quote: 'é' })?.toString()).to.equal('e\u0301');
      expect(scope.text).to.equal(scopeFromElement(root).text);
    } finally {
      builder.disconnect();
    }
  });

  it('uses an ownerless document for incremental scopes and their materialized ranges', () => {
    const owner = document.implementation.createHTMLDocument('detached quote');
    const root = owner.createElement('div');
    root.textContent = 'first ';
    owner.body.append(root);
    expect(owner.defaultView === null).to.equal(true);
    const builder = new IncrementalTextQuoteScope(root);
    try {
      const initial = builder.update();
      root.append(owner.createTextNode('second'));
      const scope = builder.update();
      expect(scope.text).to.equal('first second');
      const range = resolveTextQuote(scope, { quote: 'second' });
      expect(range?.toString()).to.equal('second');
      expect(range?.startContainer.ownerDocument === owner).to.equal(true);
      expect(resolveTextQuote(initial, { quote: 'first' })).to.equal(null);
    } finally {
      builder.disconnect();
    }
  });

  it('expands a selection starting inside a reordered grapheme to the complete quote', () => {
    const root = document.createElement('div');
    root.textContent = 'a\u0315\u0300z';
    const scope = scopeFromElement(root);
    const range = document.createRange();
    range.setStart(root.firstChild!, 1);
    range.setEnd(root.firstChild!, 2);
    const anchor = buildQuoteAnchor(range, scope);
    expect(anchor.kind).to.equal('text-quote');
    if (anchor.kind !== 'text-quote') throw new Error('Expected a text quote anchor');
    expect(anchor.quote).to.equal('à\u0315');
    expect(anchor.suffix).to.equal('z');
    expect(resolveTextQuote(scope, anchor)?.toString()).to.equal('a\u0315\u0300');
  });

  it('preserves batch positions for absent matches between real item-layer matches', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span>one</span><span>two</span>';
    const items = [...root.children].map((element) => ({ text: element.textContent!, element }));
    const scope = scopeFromItems(items);
    const ranges = rangesFromTextQuoteMatches(scope, [null, { start: 0, end: 3 }, undefined, { start: 4, end: 7 }]);
    expect(ranges.map((range) => range?.toString() ?? null)).to.deep.equal([null, 'one', null, 'two']);
    expect(rangeFromTextQuoteMatch(scope, { start: 3, end: 4 })).to.equal(null);
  });

  it('bounds a native single-text-node selection before normalization', () => {
    const text = document.createTextNode('skip e\u0301\u00ad\t end');
    const range = document.createRange();
    range.setStart(text, 5);
    range.setEnd(text, text.length);
    expect(boundedSelectionText(range, 0)).to.equal('');
    expect(boundedSelectionText(range, -1)).to.equal('');
    expect(boundedSelectionText(range, 2)).to.equal('é');
    expect(boundedSelectionText(range)).to.equal('é end');
  });
});
