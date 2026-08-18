import { expect } from '@open-wc/testing';
import type { TextQuoteScope } from './text-quote.js';
import {
  TEXT_QUOTE_LIMITS,
  TEXT_SELECTION_RECT_LIMIT,
  boundedSelectionRects,
  boundedSelectionText,
  createTextQuoteIndex,
  emptyTextQuoteMatches,
  findTextQuoteMatches,
  normalizeQuoteText,
  scopeFromElement,
  scopeFromItems,
  resolveTextQuote,
  rangeFromTextQuoteMatch,
  rangesFromTextQuoteMatches,
  findTextQuoteRanges,
  buildQuoteAnchor,
} from './text-quote.js';

describe('bounded text quote indexing', () => {
  it('bounds a multi-megabyte text node without retaining one JavaScript number per character', () => {
    const root = document.createElement('div');
    root.textContent = 'a'.repeat(TEXT_QUOTE_LIMITS.maxCorpusCodeUnits + 1);
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      expect(scope.text).to.have.lengthOf(TEXT_QUOTE_LIMITS.maxCorpusCodeUnits);
      expect(scope.truncated).to.be.true;
      expect(scope.segments).to.have.lengthOf(1);
      expect(scope.segments[0]!.rawOffsetRuns).to.be.instanceOf(Uint32Array);
      expect(scope.segments[0]!.rawOffsetRuns).to.have.lengthOf(0);
    } finally {
      root.remove();
    }
  });

  it('clamps hostile limit and work-budget overrides to the hard ceilings', () => {
    const root = document.createElement('div');
    root.textContent = 'a'.repeat(TEXT_QUOTE_LIMITS.maxCorpusCodeUnits + 1);
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root, {
        maxCorpusCodeUnits: Infinity,
        maxNodes: Number.MAX_SAFE_INTEGER,
        maxNormalizationWorkCodeUnits: Infinity,
      });
      expect(scope.text).to.have.lengthOf(TEXT_QUOTE_LIMITS.maxCorpusCodeUnits);
      expect(scope.truncated).to.be.true;
      const index = createTextQuoteIndex(scope);
      expect(index.createWorkBudget(Infinity).remainingCodeUnits).to.equal(
        TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits,
      );
      expect(index.createWorkBudget(Number.NaN).remainingCodeUnits).to.equal(
        TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits,
      );
    } finally {
      root.remove();
    }
  });

  it('stores only sparse raw-offset discontinuities and still maps exact DOM boundaries', () => {
    const root = document.createElement('div');
    root.textContent = `${'a'.repeat(20_000)}\u00ad   needle`;
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const segment = scope.segments[0]!;
      expect(segment.rawOffsetRuns.length).to.be.lessThan(10);
      const range = resolveTextQuote(scope, { quote: 'needle' });
      expect(range?.toString()).to.equal('needle');
      expect(range?.startOffset).to.equal(20_004);
    } finally {
      root.remove();
    }
  });

  it('marks a scope as truncated when the text-node ceiling omits later content', () => {
    const root = document.createElement('div');
    root.append('first', 'second', 'third');
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root, { maxNodes: 2 });
      expect(scope.text).to.equal('firstsecond');
      expect(scope.truncated).to.be.true;
    } finally {
      root.remove();
    }
  });

  it('bounds element-only traversal before a late text node', () => {
    const root = document.createElement('div');
    for (let index = 0; index < 50; index++) root.appendChild(document.createElement('span'));
    root.append('late text');
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root, { maxTraversalNodes: 10 });
      expect(scope.text).to.equal('');
      expect(scope.truncated).to.be.true;
    } finally {
      root.remove();
    }
  });

  it('collapses whitespace once across DOM-node and synthetic item boundaries', () => {
    const root = document.createElement('div');
    root.append(document.createTextNode('foo '), document.createTextNode(' bar'));
    const itemRoot = document.createElement('div');
    const first = document.createElement('span');
    const second = document.createElement('span');
    first.textContent = 'foo ';
    second.textContent = ' bar';
    itemRoot.append(first, second);
    document.body.append(root, itemRoot);
    try {
      const domScope = scopeFromElement(root);
      const itemScope = scopeFromItems([
        { text: 'foo ', element: first },
        { text: ' bar', element: second },
      ]);
      expect(domScope.text).to.equal('foo bar');
      expect(itemScope.text).to.equal('foo bar');
      expect(resolveTextQuote(domScope, { quote: 'foo bar' })?.toString()).to.equal('foo  bar');
      expect(resolveTextQuote(itemScope, { quote: 'foo bar' })?.toString()).to.equal('foo  bar');
    } finally {
      root.remove();
      itemRoot.remove();
    }
  });

  it('bounds child inspection for malformed item elements with no direct text child', () => {
    const element = document.createElement('span');
    for (let index = 0; index < 100; index++) element.appendChild(document.createElement('i'));
    const scope = scopeFromItems([{ text: 'hidden', element }], { maxTraversalNodes: 5 });
    expect(scope.text).to.equal('');
    expect(scope.truncated).to.be.true;
  });

  it('packs matches and distinguishes an exact cap boundary from a lower bound', () => {
    const exactRoot = document.createElement('div');
    exactRoot.textContent = 'x x x';
    const truncatedRoot = document.createElement('div');
    truncatedRoot.textContent = 'x x x x';
    document.body.append(exactRoot, truncatedRoot);
    try {
      const limits = { maxMatches: 3 };
      const exact = findTextQuoteMatches(scopeFromElement(exactRoot), 'x', 'en', limits);
      const truncated = findTextQuoteMatches(scopeFromElement(truncatedRoot), 'x', 'en', limits);
      expect(exact.packedOffsets).to.be.instanceOf(Uint32Array);
      expect(exact.length).to.equal(3);
      expect(exact.matchCountExact).to.be.true;
      expect(truncated.length).to.equal(3);
      expect(truncated.matchCountExact).to.be.false;
    } finally {
      exactRoot.remove();
      truncatedRoot.remove();
    }
  });

  it('fails closed with a lower-bound result when query or work ceilings are exceeded', () => {
    const root = document.createElement('div');
    root.textContent = 'find this text';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const oversized = findTextQuoteMatches(scope, 'find', 'en', { maxQueryCodeUnits: 3 });
      expect(oversized.length).to.equal(0);
      expect(oversized.matchCountExact).to.be.false;

      const index = createTextQuoteIndex(scope, 'en');
      const starved = index.search('find', index.createWorkBudget(scope.text.length - 1));
      expect(starved.length).to.equal(0);
      expect(starved.matchCountExact).to.be.false;
    } finally {
      root.remove();
    }
  });

  it('reuses one occurrence scan for identical queries while bounding distinct-query work', () => {
    const root = document.createElement('div');
    root.textContent = `${'alpha '.repeat(2_000)}omega`;
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const index = createTextQuoteIndex(scope, 'en');
      const budget = index.createWorkBudget(scope.text.length * 2);
      expect(index.search('alpha', budget).length).to.equal(2_000);
      const scansAfterFirst = index.scanCount;
      expect(index.search('alpha', budget).length).to.equal(2_000);
      expect(index.scanCount).to.equal(scansAfterFirst);
      expect(index.search('omega', budget).length).to.equal(0);
      expect(index.scanCount).to.equal(scansAfterFirst);
    } finally {
      root.remove();
    }
  });

  it('stores length-changing case-fold offsets in a packed typed array', () => {
    const root = document.createElement('div');
    root.textContent = `${'\u0130'.repeat(10_000)} target`;
    document.body.appendChild(root);
    try {
      const index = createTextQuoteIndex(scopeFromElement(root), 'en');
      index.search('target');
      const folded = (index as unknown as {
        foldedScope?: { expansions: unknown };
      }).foldedScope;
      expect(folded?.expansions).to.be.instanceOf(Uint32Array);
    } finally {
      root.remove();
    }
  });

  it('fails closed when context disambiguation cannot finish inside its work budget', () => {
    const root = document.createElement('div');
    root.textContent = 'first target second target';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const index = createTextQuoteIndex(scope, 'en');
      const budget = index.createWorkBudget(scope.text.length);
      expect(index.resolve({ quote: 'target', prefix: 'second ' }, budget)).to.equal(null);
    } finally {
      root.remove();
    }
  });

  it('fails closed when a match ceiling omits context-disambiguation candidates', () => {
    const root = document.createElement('div');
    root.textContent = 'first target second target';
    document.body.appendChild(root);
    try {
      const index = createTextQuoteIndex(scopeFromElement(root), 'en', { maxMatches: 1 });
      expect(index.resolve({ quote: 'target', prefix: 'second ' })).to.equal(null);
    } finally {
      root.remove();
    }
  });

  it('bounds selection text and rect copies without materializing Range.toString()', () => {
    const node = document.createTextNode('x'.repeat(TEXT_QUOTE_LIMITS.maxQueryCodeUnits + 100));
    const range = document.createRange();
    range.selectNodeContents(node);
    Object.defineProperty(range, 'toString', {
      configurable: true,
      value: () => { throw new Error('must not materialize the whole selection'); },
    });
    expect(boundedSelectionText(range)).to.have.lengthOf(TEXT_QUOTE_LIMITS.maxQueryCodeUnits);

    const rect = new DOMRect(0, 0, 1, 1);
    const rectRange = {
      getClientRects: () => Array.from({ length: TEXT_SELECTION_RECT_LIMIT + 100 }, () => rect),
    } as unknown as Range;
    expect(boundedSelectionRects(rectRange)).to.have.lengthOf(TEXT_SELECTION_RECT_LIMIT);
    expect(boundedSelectionRects(rectRange, Infinity)).to.have.lengthOf(TEXT_SELECTION_RECT_LIMIT);
    const copiedRects = boundedSelectionRects(rectRange, 1);
    const [copiedRect] = copiedRects;
    expect(copiedRect).not.to.equal(rect);
    expect(copiedRect).to.deep.equal({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      top: 0,
      right: 1,
      bottom: 1,
      left: 0,
    });
    expect(Object.isFrozen(copiedRects)).to.be.true;
    expect(Object.isFrozen(copiedRect)).to.be.true;
    rect.x = 99;
    expect(copiedRect.x).to.equal(0);
  });

  it('keeps text gathered before a hostile Range#intersectsNode throws mid-walk', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span>abc</span><span>def</span>';
    document.body.appendChild(root);
    try {
      const range = document.createRange();
      range.selectNodeContents(root);
      const originalIntersects = range.intersectsNode.bind(range);
      let calls = 0;
      range.intersectsNode = ((node: Node) => {
        calls++;
        if (calls > 1) throw new Error('hostile intersectsNode');
        return originalIntersects(node);
      }) as typeof range.intersectsNode;
      expect(boundedSelectionText(range)).to.equal('abc');
    } finally {
      root.remove();
    }
  });
});

describe('normalizeQuoteText', () => {
  it('collapses whitespace runs (including NBSP) to a single space and trims', () => {
    expect(normalizeQuoteText('  hello   world  again  ')).to.equal('hello world again');
  });

  it('strips soft hyphens', () => {
    expect(normalizeQuoteText('super­conductor')).to.equal('superconductor');
  });

  it('NFC-normalizes decomposed accented characters', () => {
    const decomposed = 'cafe\u0301';
    expect(normalizeQuoteText(decomposed)).to.equal('café');
  });
});

describe('scopeFromElement + resolveTextQuote', () => {
  function makeContent(html: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  it('resolves a quote spanning an <em> element boundary', () => {
    const root = makeContent('<p>Revenue grew <em>12%</em> year over year, driven by demand.</p>');
    try {
      const scope = scopeFromElement(root);
      const range = resolveTextQuote(scope, { quote: 'grew 12% year' });
      expect(range).to.exist;
      expect(normalizeQuoteText(range!.toString())).to.equal('grew 12% year');
    } finally {
      root.remove();
    }
  });

  it('disambiguates among three identical quotes using prefix/suffix context', () => {
    const root = makeContent('<p>A: revenue. B: revenue. C: revenue.</p>');
    try {
      const scope = scopeFromElement(root);
      const range = resolveTextQuote(scope, { quote: 'revenue', prefix: 'B: ', suffix: '. C' });
      expect(range).to.exist;
      // The match must be the second occurrence -- verify by checking what immediately precedes it
      // in the scope's own normalized text via the resolved range's start container/offset.
      const before = scope.text.slice(0, scope.text.indexOf('revenue', scope.text.indexOf('B: ')));
      expect(before.endsWith('B: ')).to.be.true;
      expect(range!.toString()).to.equal('revenue');
    } finally {
      root.remove();
    }
  });

  it('retries case-insensitively when no case-sensitive match exists', () => {
    const root = makeContent('<p>The REPORT concludes strongly.</p>');
    try {
      const scope = scopeFromElement(root);
      const range = resolveTextQuote(scope, { quote: 'report concludes' });
      expect(range).to.exist;
      expect(range!.toString().toLowerCase()).to.equal('report concludes');
    } finally {
      root.remove();
    }
  });

  it('returns null when the quote is not present', () => {
    const root = makeContent('<p>Nothing relevant here.</p>');
    try {
      const scope = scopeFromElement(root);
      expect(resolveTextQuote(scope, { quote: 'revenue grew 12%' })).to.be.null;
    } finally {
      root.remove();
    }
  });

  it('skips script/style/template/noscript content when building the scope', () => {
    const root = makeContent('<p>Visible text.</p><script>var secret = "revenue grew 12%";</script>');
    try {
      const scope = scopeFromElement(root);
      expect(scope.text).to.not.include('secret');
      expect(scope.text).to.include('Visible text.');
    } finally {
      root.remove();
    }
  });

  it('round-trips buildQuoteAnchor -> resolveTextQuote on a markdown-rendered fixture', () => {
    const root = makeContent('<p>Overall <strong>revenue grew 12%</strong> year over year, driven by demand.</p>');
    try {
      const scope = scopeFromElement(root);
      const strong = root.querySelector('strong')!;
      const originalRange = document.createRange();
      originalRange.selectNodeContents(strong);
      const anchor = buildQuoteAnchor(originalRange, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.equal('revenue grew 12%');
      expect(anchor.prefix).to.equal('Overall');
      expect(anchor.suffix?.startsWith('year over year')).to.be.true;

      const resolved = resolveTextQuote(scope, anchor);
      expect(resolved).to.exist;
      expect(normalizeQuoteText(resolved!.toString())).to.equal('revenue grew 12%');
    } finally {
      root.remove();
    }
  });

  it('strips a soft hyphen appearing inside DOM text content when building the scope', () => {
    const root = makeContent('<p>super­conductor works.</p>');
    try {
      const scope = scopeFromElement(root);
      expect(scope.text).to.include('superconductor');
      expect(scope.text).to.not.include('­');
    } finally {
      root.remove();
    }
  });

  it('NFC-normalizes a text node where composition changes length and maps back to raw', () => {
    const decomposed = 'café'; // "e" + combining acute accent -- 5 UTF-16 units
    const root = makeContent(`<p>${decomposed} society</p>`);
    try {
      const scope = scopeFromElement(root);
      expect(scope.text).to.equal('café society');
      expect(resolveTextQuote(scope, { quote: 'café' })?.toString()).to.equal(decomposed);
      const range = resolveTextQuote(scope, { quote: 'society' });
      expect(range).to.exist;
    } finally {
      root.remove();
    }
  });

  it('maps same-length canonical reordering back to the complete raw grapheme', () => {
    const raw = 'q\u0315\u0300x';
    const root = makeContent(`<p>${raw}</p>`);
    try {
      const scope = scopeFromElement(root);
      expect(scope.text).to.equal('q\u0300\u0315x');
      const range = resolveTextQuote(scope, { quote: 'q\u0300' });
      expect(range !== null).to.be.true;
      expect(range!.toString()).to.equal('q\u0315\u0300');
    } finally {
      root.remove();
    }
  });

  it('skips a text node whose content collapses entirely to nothing', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('Hello '));
    root.appendChild(document.createTextNode('­­')); // entirely soft hyphens -> empty segment
    root.appendChild(document.createTextNode('World'));
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      expect(scope.text).to.equal('Hello World');
      expect(scope.segments).to.have.length(2);
    } finally {
      root.remove();
    }
  });

  it('returns null immediately for an empty (whitespace-only) query', () => {
    const root = makeContent('<p>Some content here.</p>');
    try {
      const scope = scopeFromElement(root);
      expect(resolveTextQuote(scope, { quote: '   ' })).to.be.null;
    } finally {
      root.remove();
    }
  });

  it('does not boost score when a supplied prefix does not match the text preceding a candidate', () => {
    const root = makeContent('<p>Alpha: revenue grew steadily.</p>');
    try {
      const scope = scopeFromElement(root);
      const range = resolveTextQuote(scope, { quote: 'revenue grew', prefix: 'Wrong prefix' });
      expect(range).to.exist;
      expect(range!.toString()).to.equal('revenue grew');
    } finally {
      root.remove();
    }
  });

  it('disambiguates using only a suffix when no prefix is supplied', () => {
    const root = makeContent('<p>Revenue grew. Revenue shrank.</p>');
    try {
      const scope = scopeFromElement(root);
      const range = resolveTextQuote(scope, { quote: 'Revenue', suffix: 'shrank' });
      expect(range).to.exist;
      expect(range!.toString()).to.equal('Revenue');
      // Must be the SECOND occurrence -- the one immediately followed by "shrank".
      const secondIndex = root.textContent!.lastIndexOf('Revenue');
      expect(range!.startOffset).to.equal(secondIndex);
    } finally {
      root.remove();
    }
  });
});

describe('locale-aware search ranges', () => {
  it('normalizes and maps canonical clusters split across adjacent text nodes', () => {
    const root = document.createElement('div');
    const base = document.createTextNode('e');
    const mark = document.createTextNode('\u0301');
    root.append(base, mark);
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      expect(scope.text).to.equal('é');
      const range = resolveTextQuote(scope, { quote: 'é' });
      expect(range?.startContainer).to.equal(base);
      expect(range?.startOffset).to.equal(0);
      expect(range?.endContainer).to.equal(mark);
      expect(range?.endOffset).to.equal(1);
    } finally {
      root.remove();
    }
  });

  it('normalizes a canonical cluster split across adjacent item spans without a synthetic space', () => {
    const root = document.createElement('div');
    const base = document.createElement('span');
    const mark = document.createElement('span');
    base.textContent = 'e';
    mark.textContent = '\u0301';
    root.append(base, mark);
    document.body.appendChild(root);
    try {
      const scope = scopeFromItems([
        { text: 'e', element: base },
        { text: '\u0301', element: mark },
      ]);
      expect(scope.text).to.equal('é');
      expect(resolveTextQuote(scope, { quote: 'é' })?.toString()).to.equal('e\u0301');
    } finally {
      root.remove();
    }
  });

  it('normalizes a Hangul syllable split across adjacent item spans without a synthetic space', () => {
    const root = document.createElement('div');
    const leadingConsonant = document.createElement('span');
    const vowel = document.createElement('span');
    leadingConsonant.textContent = '\u1100';
    vowel.textContent = '\u1161';
    root.append(leadingConsonant, vowel);
    document.body.appendChild(root);
    try {
      const scope = scopeFromItems([
        { text: '\u1100', element: leadingConsonant },
        { text: '\u1161', element: vowel },
      ]);
      expect(scope.text).to.equal('가');
      expect(resolveTextQuote(scope, { quote: '가' })?.toString()).to.equal('\u1100\u1161');
    } finally {
      root.remove();
    }
  });

  it('uses the requested locale for Turkish case folding', () => {
    const root = document.createElement('div');
    root.textContent = 'İzmir';
    document.body.appendChild(root);
    try {
      const ranges = findTextQuoteRanges(scopeFromElement(root), 'izmir', 'tr');
      expect(ranges).to.have.length(1);
      expect(ranges[0]!.toString()).to.equal('İzmir');
    } finally {
      root.remove();
    }
  });

  it('maps a match back to the right DOM offsets when case folding expands an earlier character', () => {
    const root = document.createElement('div');
    root.textContent = 'İ Foo';
    document.body.appendChild(root);
    try {
      const ranges = findTextQuoteRanges(scopeFromElement(root), 'foo', 'en');
      expect(ranges).to.have.length(1);
      expect(ranges[0]!.toString()).to.equal('Foo');
    } finally {
      root.remove();
    }
  });

  it('rejects a raw-bounded query whose locale fold expands beyond the query ceiling', () => {
    const root = document.createElement('div');
    root.textContent = 'anything';
    document.body.appendChild(root);
    try {
      const matches = createTextQuoteIndex(scopeFromElement(root), 'en')
        .search('\u0130'.repeat(TEXT_QUOTE_LIMITS.maxQueryCodeUnits));
      expect(matches).to.have.lengthOf(0);
      expect(matches.matchCountExact).to.be.false;
      expect(matches.scanComplete).to.be.false;
    } finally {
      root.remove();
    }
  });

  it('preserves contextual Greek and Lithuanian whole-string case folding', () => {
    const root = document.createElement('div');
    root.textContent = 'ΟΣ I\u0301';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const greekRanges = findTextQuoteRanges(scope, 'ος', 'el');
      expect(greekRanges).to.have.length(1);
      expect(greekRanges[0]!.toString()).to.equal('ΟΣ');
      expect(resolveTextQuote(scope, { quote: 'ος' }, 'el')?.toString()).to.equal('ΟΣ');

      const lithuanianRanges = findTextQuoteRanges(scope, 'i\u0307\u0301', 'lt');
      expect(lithuanianRanges).to.have.length(1);
      expect(lithuanianRanges[0]!.toString()).to.equal('I\u0301');
      expect(resolveTextQuote(scope, { quote: 'i\u0307\u0301' }, 'lt')?.toString()).to.equal('I\u0301');
    } finally {
      root.remove();
    }
  });

  it('treats Greek medial and final sigma as equivalent for substring queries', () => {
    const root = document.createElement('div');
    root.textContent = 'ΟΣ';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      for (const query of ['Σ', 'σ', 'ς']) {
        const ranges = findTextQuoteRanges(scope, query, 'el');
        expect(ranges, query).to.have.length(1);
        expect(ranges[0]!.toString()).to.equal('Σ');
      }
    } finally {
      root.remove();
    }
  });

  it('avoids grapheme offset maps for same-length folds and exact anchors without context', () => {
    const OriginalSegmenter = Intl.Segmenter;
    let constructions = 0;
    class CountingSegmenter extends OriginalSegmenter {
      constructor(...args: ConstructorParameters<typeof Intl.Segmenter>) {
        constructions += 1;
        super(...args);
      }
    }
    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: CountingSegmenter,
    });
    const root = document.createElement('div');
    root.textContent = `${'A'.repeat(10_000)} Needle`;
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      expect(findTextQuoteRanges(scope, 'needle', 'en')).to.have.length(1);
      expect(resolveTextQuote(scope, { quote: 'Needle' }, 'en')?.toString()).to.equal('Needle');
      expect(constructions).to.equal(0);
    } finally {
      root.remove();
      Object.defineProperty(Intl, 'Segmenter', {
        configurable: true,
        value: OriginalSegmenter,
      });
    }
  });

  it('scores prefix context in folded offsets when earlier casing expands', () => {
    const root = document.createElement('div');
    root.textContent = 'Aİ FOO Xİ FOO';
    document.body.appendChild(root);
    try {
      const range = resolveTextQuote(
        scopeFromElement(root),
        { quote: 'foo', prefix: ' xi\u0307 ' },
        'en',
      );
      expect(range !== null).to.be.true;
      expect(range!.startOffset).to.equal(10);
    } finally {
      root.remove();
    }
  });
});

describe('resolveTextQuote defensive edge cases against hand-built scopes', () => {
  it('fails closed when a hand-built match ends in an unmapped segment gap', () => {
    // A hand-built scope whose `text` has an unmapped character ('X' at index 2) between two
    // segments -- exactly the shape produced by `scopeFromItems`' synthetic joining space, which no
    // legitimate (trimmed) search needle can ever start or end on. Constructing it directly exercises
    // `locate`'s defensive "offset lands at this segment's own end" branch.
    const node1 = document.createTextNode('ab');
    const node2 = document.createTextNode('cd');
    const scope: TextQuoteScope = {
      text: 'abXcd',
      segments: [
        { node: node1, normalizedStart: 0, normalizedLength: 2, rawOffsetRuns: new Uint32Array() },
        { node: node2, normalizedStart: 3, normalizedLength: 2, rawOffsetRuns: new Uint32Array() },
      ],
      truncated: false,
    };
    const range = resolveTextQuote(scope, { quote: 'abX' });
    expect(range).to.be.null;
  });

  it('returns null when the scope text matches but has no segments to map the match to', () => {
    const scope: TextQuoteScope = { text: 'hello world', segments: [], truncated: false };
    expect(resolveTextQuote(scope, { quote: 'hello' })).to.be.null;
  });

  it('returns null instead of throwing for stale nodes, malformed offsets, and bad item mappings', () => {
    const root = document.createElement('div');
    root.textContent = 'needle';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const match = findTextQuoteMatches(scope, 'needle').at(0)!;
      root.firstChild!.textContent = 'a';
      expect(rangeFromTextQuoteMatch(scope, match)).to.be.null;

      root.textContent = 'needle';
      const sameLengthScope = scopeFromElement(root);
      const sameLengthMatch = findTextQuoteMatches(sameLengthScope, 'needle').at(0)!;
      (root.firstChild as Text).data = 'xxxxxx';
      expect(rangeFromTextQuoteMatch(sameLengthScope, sameLengthMatch)).to.be.null;

      root.textContent = 'needle';
      const detachedScope = scopeFromElement(root);
      const detachedMatch = findTextQuoteMatches(detachedScope, 'needle').at(0)!;
      const detached = root.firstChild!;
      detached.remove();
      expect(rangeFromTextQuoteMatch(detachedScope, detachedMatch)).to.be.null;

      root.append(detached);
      const reparentedScope = scopeFromElement(root);
      const reparentedMatch = findTextQuoteMatches(reparentedScope, 'needle').at(0)!;
      const elsewhere = document.createElement('div');
      document.body.append(elsewhere);
      elsewhere.append(detached);
      expect(rangeFromTextQuoteMatch(reparentedScope, reparentedMatch)).to.be.null;
      elsewhere.remove();

      root.replaceChildren(
        document.createTextNode('ab'),
        document.createTextNode('cd'),
        document.createTextNode('ef'),
      );
      const multiNodeScope = scopeFromElement(root);
      const multiNodeMatch = findTextQuoteMatches(multiNodeScope, 'abcdef').at(0)!;
      (root.childNodes[1] as Text).data = 'XX';
      expect(rangeFromTextQuoteMatch(multiNodeScope, multiNodeMatch)).to.be.null;

      root.innerHTML = '<span>a</span><span>b</span><span>c</span>';
      const ancestorScope = scopeFromElement(root);
      const ancestorMatch = findTextQuoteMatches(ancestorScope, 'abc').at(0)!;
      const inserted = document.createElement('span');
      inserted.textContent = 'X';
      root.insertBefore(inserted, root.lastElementChild);
      expect(rangeFromTextQuoteMatch(ancestorScope, ancestorMatch)).to.be.null;

      root.innerHTML = '<span>prefix</span><span>needle</span>';
      const prefixScope = scopeFromElement(root);
      const prefixMatch = findTextQuoteMatches(prefixScope, 'needle').at(0)!;
      root.firstElementChild!.textContent = 'expanded prefix';
      expect(rangeFromTextQuoteMatch(prefixScope, prefixMatch)).to.be.null;

      root.innerHTML = '<span>needle</span>';
      const boundaryScope = scopeFromElement(root);
      const boundaryMatch = findTextQuoteMatches(boundaryScope, 'needle').at(0)!;
      const prepended = document.createElement('p');
      prepended.textContent = 'x';
      root.prepend(prepended);
      expect(rangeFromTextQuoteMatch(boundaryScope, boundaryMatch)).to.be.null;

      root.innerHTML = '<p>needle</p>';
      const suffixScope = scopeFromElement(root);
      const suffixMatch = findTextQuoteMatches(suffixScope, 'needle').at(0)!;
      const appended = document.createElement('span');
      appended.textContent = 'new searchable text';
      root.append(appended);
      expect(rangeFromTextQuoteMatch(suffixScope, suffixMatch)).to.be.null;

      expect(rangeFromTextQuoteMatch(scope, { start: 99, end: 100 })).to.be.null;

      const span = document.createElement('span');
      span.textContent = 'x';
      const badItems = scopeFromItems([{ text: 'much longer', element: span }]);
      expect(badItems.truncated).to.be.true;
      expect(findTextQuoteMatches(badItems, 'longer')).to.have.length(0);
      expect(rangeFromTextQuoteMatch(badItems, undefined as never)).to.be.null;
    } finally {
      root.remove();
    }
  });

  it('materializes a bounded match batch after one fail-closed provenance validation', () => {
    const root = document.createElement('div');
    root.textContent = 'needle needle';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const matches = [...findTextQuoteMatches(scope, 'needle')];
      const ranges = rangesFromTextQuoteMatches(scope, matches);
      expect(ranges.map((range) => range?.toString())).to.deep.equal(['needle', 'needle']);

      const first = root.firstChild as Text;
      const hostile = {
        get start(): number {
          first.data = 'xxxxxx needle';
          return 0;
        },
        end: 6,
      };
      const rejected = rangesFromTextQuoteMatches(scope, [hostile, matches[1]]);
      expect(rejected).to.deep.equal([null, null]);
    } finally {
      root.remove();
    }
  });

  it('fails closed on a hand-built zero-length segment', () => {
    // Generated scopes skip empty segments. This hand-built one exercises locate()'s defensive
    // no-last-character fallback when a caller supplies inconsistent segment metadata.
    const node = document.createTextNode('X');
    const scope: TextQuoteScope = {
      text: 'Y',
      segments: [{ node, normalizedStart: 0, normalizedLength: 0, rawOffsetRuns: new Uint32Array() }],
      truncated: false,
    };
    const range = resolveTextQuote(scope, { quote: 'Y' });
    expect(range).to.be.null;
  });
});

describe('buildQuoteAnchor deep boundaries', () => {
  it('resolves deeply nested element boundaries without recursive descent', () => {
    const root = document.createElement('div');
    let parent: Element = root;
    for (let depth = 0; depth < 5_000; depth++) {
      const child = document.createElement('span');
      parent.appendChild(child);
      parent = child;
    }
    const node = document.createTextNode('needle');
    parent.appendChild(node);
    document.body.appendChild(root);
    try {
      const scope: TextQuoteScope = {
        text: 'needle',
        segments: [{
          node,
          normalizedStart: 0,
          normalizedLength: 6,
          rawOffsetRuns: new Uint32Array(),
          rawClusterRuns: new Uint32Array(),
          rawLength: 6,
        }],
        truncated: false,
      };
      const range = document.createRange();
      range.selectNodeContents(root);
      expect(buildQuoteAnchor(range, scope)).to.deep.include({ kind: 'text-quote', quote: 'needle' });
    } finally {
      root.remove();
    }
  });

  it('fails closed without overflowing the stack beyond the traversal ceiling', () => {
    const root = document.createElement('div');
    let parent: Element = root;
    for (let depth = 0; depth <= TEXT_QUOTE_LIMITS.maxTraversalNodes; depth++) {
      const child = document.createElement('span');
      parent.appendChild(child);
      parent = child;
    }
    const node = document.createTextNode('needle');
    parent.appendChild(node);
    const range = document.createRange();
    range.selectNodeContents(root);
    const scope: TextQuoteScope = { text: '', segments: [], truncated: true };
    let anchor: ReturnType<typeof buildQuoteAnchor>;
    expect(() => { anchor = buildQuoteAnchor(range, scope); }).to.not.throw();
    expect(anchor!).to.deep.equal({ kind: 'text-quote', quote: '' });
  });

  it('caps a selected quote before materializing it', () => {
    const root = document.createElement('div');
    root.textContent = 'q'.repeat(TEXT_QUOTE_LIMITS.maxQueryCodeUnits + 1_000);
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const range = document.createRange();
      range.selectNodeContents(root);
      const anchor = buildQuoteAnchor(range, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.have.length(TEXT_QUOTE_LIMITS.maxQueryCodeUnits);
    } finally {
      root.remove();
    }
  });
});

describe('scopeFromItems + resolveTextQuote (simulated pdf text-layer items)', () => {
  it('keeps a large flat sibling scope mappable within the aggregate traversal ceiling', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      const items: Array<{ text: string; element: Element }> = [];
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 4_096; index++) {
        const span = document.createElement('span');
        span.textContent = `item${index}`;
        fragment.appendChild(span);
        items.push({ text: span.textContent, element: span });
      }
      container.appendChild(fragment);
      const scope = scopeFromItems(items);
      expect(scope.truncated).to.be.false;
      expect(resolveTextQuote(scope, { quote: 'item4095' })?.toString()).to.equal('item4095');
    } finally {
      container.remove();
    }
  });

  it('round-trips across multiple per-word span items', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      const words = ['Revenue', 'grew', '12%', 'year', 'over', 'year.'];
      const items = words.map((word) => {
        const span = document.createElement('span');
        span.textContent = word;
        container.appendChild(span);
        return { text: word, element: span };
      });
      const scope = scopeFromItems(items);
      expect(scope.text).to.equal('Revenue grew 12% year over year.');

      const range = resolveTextQuote(scope, { quote: 'grew 12% year' });
      expect(range).to.exist;
      // Each word lives in its own sibling <span> with no DOM text node between them, so a Range
      // spanning several items stringifies as their raw text content with no inter-word space --
      // unlike `scope.text`, which synthesizes that space for searching. Confirm the match covers
      // exactly the three words by comparing against that same un-spaced concatenation.
      expect(range!.toString()).to.equal('grew12%year');

      const anchor = buildQuoteAnchor(range!, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.equal('grew 12% year');
      const resolvedAgain = resolveTextQuote(scope, anchor as { quote: string; prefix?: string; suffix?: string });
      expect(resolvedAgain).to.exist;
      expect(resolvedAgain!.toString()).to.equal('grew12%year');
    } finally {
      container.remove();
    }
  });

  it('keeps nested text nodes in one peer text run contiguous when joinBefore is false', () => {
    const container = document.createElement('span');
    const first = document.createElement('b');
    const second = document.createElement('i');
    first.textContent = 'hel';
    second.textContent = 'lo';
    container.append(first, second);
    document.body.appendChild(container);
    try {
      const scope = scopeFromItems([
        { text: 'hel', element: first, node: first.firstChild as Text },
        { text: 'lo', element: second, node: second.firstChild as Text, joinBefore: false },
      ]);
      expect(scope.text).to.equal('hello');
      expect(resolveTextQuote(scope, { quote: 'hello' })?.toString()).to.equal('hello');
    } finally {
      container.remove();
    }
  });

  it('skips items whose element has no text node', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      const empty = document.createElement('span');
      container.appendChild(empty);
      const scope = scopeFromItems([{ text: 'ignored', element: empty }]);
      expect(scope.text).to.equal('');
      expect(scope.segments).to.have.length(0);
      expect(scope.truncated).to.be.true;
    } finally {
      container.remove();
    }
  });

  it('fails closed at an item whose authoritative text differs from its DOM node', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      const makeSpan = (content: string) => {
        const span = document.createElement('span');
        span.textContent = content;
        container.appendChild(span);
        return span;
      };
      const items = [
        { text: 'Hello', element: makeSpan('Hello') },
        // The item's authoritative `text` collapses to empty even though its element has real content.
        { text: '­­', element: makeSpan('x') },
        { text: 'World', element: makeSpan('World') },
      ];
      const scope = scopeFromItems(items);
      expect(scope.text).to.equal('Hello');
      expect(scope.segments).to.have.length(1);
      expect(scope.truncated).to.be.true;
      expect(resolveTextQuote(scope, { quote: 'Hello World' })).to.be.null;
    } finally {
      container.remove();
    }
  });
});

describe('buildQuoteAnchor boundary resolution edge cases', () => {
  function makeContent(html: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  it('resolves start/end boundaries whose container element requires descending into nested elements', () => {
    const root = makeContent('<p>Intro <span><em>bold</em> tail</span></p>');
    try {
      const scope = scopeFromElement(root);
      // `p`'s children are [textNode "Intro ", <span>]; starting at offset 1 makes the boundary
      // container the <span> element itself, forcing `firstTextNodeDeep`/`lastTextNodeDeep` to
      // descend through <em> to find the actual start/end text nodes.
      const p = root.querySelector('p')!;
      const range = document.createRange();
      range.setStart(p, 1);
      range.setEnd(p, 2);
      const anchor = buildQuoteAnchor(range, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.equal('bold tail');
    } finally {
      root.remove();
    }
  });

  it('maps a start boundary positioned past a trailing soft hyphen to the segment end', () => {
    const root = makeContent('<p>super­<em>conductor</em></p>');
    try {
      const scope = scopeFromElement(root);
      const p = root.querySelector('p')!;
      const leadTextNode = p.firstChild as Text;
      const range = document.createRange();
      range.setStart(leadTextNode, leadTextNode.data.length); // past the trailing soft hyphen
      range.setEnd(p, p.childNodes.length);
      const anchor = buildQuoteAnchor(range, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.equal('conductor');
    } finally {
      root.remove();
    }
  });

  it('falls back to range.toString() when the range boundaries live outside the scoped content', () => {
    const outside = document.createElement('div');
    outside.textContent = 'Unrelated content here';
    document.body.appendChild(outside);
    const root = makeContent('<p>Some scoped text.</p>');
    try {
      const scope = scopeFromElement(root);
      const range = document.createRange();
      range.selectNodeContents(outside);
      const anchor = buildQuoteAnchor(range, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.equal('Unrelated content here');
      expect(anchor.prefix).to.be.undefined;
      expect(anchor.suffix).to.be.undefined;
    } finally {
      root.remove();
      outside.remove();
    }
  });

  it('returns a null boundary when a container offset points past its last child', () => {
    const root = makeContent('<p>Some text</p><div id="empty"></div>');
    try {
      const scope = scopeFromElement(root);
      const emptyDiv = root.querySelector('#empty')!;
      const range = document.createRange();
      range.setStart(emptyDiv, 0);
      range.setEnd(emptyDiv, 0);
      const anchor = buildQuoteAnchor(range, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.equal('');
      expect(anchor.prefix).to.be.undefined;
      expect(anchor.suffix).to.be.undefined;
    } finally {
      root.remove();
    }
  });

  it('returns a null boundary when an offset child has no text descendants at all', () => {
    const root = makeContent('<p>Lead in <span></span></p>');
    try {
      const scope = scopeFromElement(root);
      const p = root.querySelector('p')!;
      const range = document.createRange();
      range.setStart(p, 1);
      range.setEnd(p, 2);
      const anchor = buildQuoteAnchor(range, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.equal('');
    } finally {
      root.remove();
    }
  });

  it('falls back to range.toString() for a collapsed (zero-length) range inside the scope', () => {
    const root = makeContent('<p>Some scoped text here.</p>');
    try {
      const scope = scopeFromElement(root);
      const textNode = root.querySelector('p')!.firstChild as Text;
      const range = document.createRange();
      range.setStart(textNode, 5);
      range.setEnd(textNode, 5);
      const anchor = buildQuoteAnchor(range, scope);
      expect(anchor.kind).to.equal('text-quote');
      if (anchor.kind !== 'text-quote') throw new Error('unreachable');
      expect(anchor.quote).to.equal('');
    } finally {
      root.remove();
    }
  });
});

describe('segmenter and case-fold defensive fallbacks', () => {
  it('falls back to the default-locale segmenter when Intl.Segmenter throws a RangeError for the requested locale', () => {
    const OriginalSegmenter = Intl.Segmenter;
    class ThrowingSegmenter extends OriginalSegmenter {
      constructor(...args: ConstructorParameters<typeof OriginalSegmenter>) {
        if (args[0] === 'xx') throw new RangeError('synthetic: locale unsupported by this fake segmenter');
        super(...args);
      }
    }
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: ThrowingSegmenter });
    const root = document.createElement('div');
    root.textContent = 'İ Foo';
    document.body.appendChild(root);
    try {
      const ranges = findTextQuoteRanges(scopeFromElement(root), 'foo', 'xx');
      expect(ranges).to.have.length(1);
      expect(ranges[0]!.toString()).to.equal('Foo');
    } finally {
      root.remove();
      Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: OriginalSegmenter });
    }
  });

  it('propagates a non-RangeError thrown while constructing a segmenter', () => {
    const OriginalSegmenter = Intl.Segmenter;
    class ThrowingSegmenter extends OriginalSegmenter {
      constructor(...args: ConstructorParameters<typeof OriginalSegmenter>) {
        if (args[0] === 'yy') throw new TypeError('synthetic: unexpected segmenter failure');
        super(...args);
      }
    }
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: ThrowingSegmenter });
    const root = document.createElement('div');
    root.textContent = 'İ Foo';
    document.body.appendChild(root);
    try {
      expect(() => findTextQuoteRanges(scopeFromElement(root), 'foo', 'yy')).to.throw(TypeError);
    } finally {
      root.remove();
      Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: OriginalSegmenter });
    }
  });

  it('falls back to per-character iteration when Intl.Segmenter is unavailable', () => {
    const OriginalSegmenter = Intl.Segmenter;
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
    const root = document.createElement('div');
    root.textContent = 'İ Foo';
    const hangulRoot = document.createElement('div');
    const leadingConsonant = document.createElement('span');
    const vowel = document.createElement('span');
    leadingConsonant.textContent = '\u1100';
    vowel.textContent = '\u1161';
    hangulRoot.append(leadingConsonant, vowel);
    document.body.appendChild(root);
    document.body.appendChild(hangulRoot);
    try {
      const ranges = findTextQuoteRanges(scopeFromElement(root), 'foo', 'en');
      expect(ranges).to.have.length(1);
      expect(ranges[0]!.toString()).to.equal('Foo');
      const hangulScope = scopeFromItems([
        { text: '\u1100', element: leadingConsonant },
        { text: '\u1161', element: vowel },
      ]);
      expect(hangulScope.text).to.equal('가');
      expect(resolveTextQuote(hangulScope, { quote: '가' })?.toString()).to.equal('\u1100\u1161');
    } finally {
      root.remove();
      hangulRoot.remove();
      Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: OriginalSegmenter });
    }
  });

  it('uses whole-string contextual folding when per-segment folding would not reproduce it', () => {
    // Every real length-changing contextual case-fold rule (e.g. Lithuanian's dot-above
    // insertion) triggers on a combining mark that Unicode's own grapheme-cluster rules always
    // keep attached to its base character -- so isolated per-grapheme folding already agrees
    // with whole-string folding in practice (see the locale tests above). To exercise the
    // `isolatedTotal !== text.length` fallback in `foldText` -- and the raw<->folded offset
    // converters it feeds -- simulate a synthetic locale ('zz') whose lowering of 'A' depends on
    // the FOLLOWING character, something no real Intl implementation does across separate
    // base-character graphemes, but which the code must still handle correctly.
    const original = String.prototype.toLocaleLowerCase;
    String.prototype.toLocaleLowerCase = function (
      this: string,
      ...args: Parameters<typeof original>
    ): string {
      if (args[0] !== 'zz') return original.apply(this, args);
      const s = this.toString();
      let out = '';
      for (let i = 0; i < s.length; i++) {
        out += s[i] === 'A' && s[i + 1] === 'B' ? 'aX' : s[i]!.toLowerCase();
      }
      return out;
    };
    const root = document.createElement('div');
    root.textContent = 'ABC';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      // No prefix (exercises the "no supplied prefix" ternary arm alongside the fallback fold).
      const a = resolveTextQuote(scope, { quote: 'A', suffix: 'BC' }, 'zz');
      // Offset lands inside the single recorded expansion.
      const b = resolveTextQuote(scope, { quote: 'B', prefix: 'A' }, 'zz');
      // Offset lands past the single recorded expansion (adjustment accumulation).
      const c = resolveTextQuote(scope, { quote: 'C', prefix: 'AB' }, 'zz');
      expect(a?.toString()).to.equal('A');
      expect(b?.toString()).to.equal('B');
      expect(c?.toString()).to.equal('C');
    } finally {
      root.remove();
      String.prototype.toLocaleLowerCase = original;
    }
  });
});

describe('TextQuoteIndex.rebindScope', () => {
  it('rejects a scope whose text or truncation state differs and leaves the current scope in place', () => {
    const root = document.createElement('div');
    root.textContent = 'alpha beta';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const index = createTextQuoteIndex(scope, 'en');

      const differentText: TextQuoteScope = { text: 'alpha gamma', segments: [], truncated: false };
      expect(index.rebindScope(differentText)).to.equal(false);
      expect(index.scope).to.equal(scope);

      const differentTruncated: TextQuoteScope = { text: scope.text, segments: [], truncated: true };
      expect(index.rebindScope(differentTruncated)).to.equal(false);
      expect(index.scope).to.equal(scope);
    } finally {
      root.remove();
    }
  });

  it('rebinds to a structurally repainted but textually identical scope and keeps the occurrence cache', () => {
    const root = document.createElement('div');
    root.textContent = 'alpha beta alpha';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const index = createTextQuoteIndex(scope, 'en');
      expect(index.search('alpha').length).to.equal(2);
      const scansAfterFirst = index.scanCount;

      const repainted = scopeFromElement(root);
      expect(index.rebindScope(repainted)).to.equal(true);
      expect(index.scope).to.equal(repainted);
      expect(index.search('alpha').length).to.equal(2);
      expect(index.scanCount).to.equal(scansAfterFirst);
    } finally {
      root.remove();
    }
  });
});

describe('TextQuoteIndex occurrence cache limits', () => {
  it('never caches when maxCacheEntries is 0, forcing a rescan on every repeated query', () => {
    const root = document.createElement('div');
    root.textContent = 'needle needle';
    document.body.appendChild(root);
    try {
      const index = createTextQuoteIndex(scopeFromElement(root), 'en', { maxCacheEntries: 0 });
      index.search('needle');
      const scansAfterFirst = index.scanCount;
      index.search('needle');
      expect(index.scanCount).to.equal(scansAfterFirst + 1);
    } finally {
      root.remove();
    }
  });

  it('evicts the oldest cached occurrence list once maxCacheEntries is exceeded', () => {
    const root = document.createElement('div');
    root.textContent = 'alpha beta gamma';
    document.body.appendChild(root);
    try {
      const index = createTextQuoteIndex(scopeFromElement(root), 'en', { maxCacheEntries: 2 });
      index.search('alpha');
      index.search('beta');
      const scansAfterTwo = index.scanCount;

      index.search('gamma'); // inserts a 3rd entry, evicting the oldest ('alpha')
      expect(index.scanCount).to.equal(scansAfterTwo + 1);

      index.search('beta'); // still cached
      expect(index.scanCount).to.equal(scansAfterTwo + 1);

      index.search('alpha'); // evicted earlier -- must rescan
      expect(index.scanCount).to.equal(scansAfterTwo + 2);
    } finally {
      root.remove();
    }
  });
});

describe('TextQuoteMatches edge cases', () => {
  it('emptyTextQuoteMatches returns an exact, empty, allocation-light result', () => {
    const matches = emptyTextQuoteMatches();
    expect(matches.length).to.equal(0);
    expect(matches.matchCountExact).to.be.true;
    expect(matches.scanComplete).to.be.true;
    expect([...matches]).to.deep.equal([]);
    expect(matches.at(0)).to.be.undefined;
  });

  it('at() returns undefined for a non-integer, negative, or out-of-bounds index', () => {
    const root = document.createElement('div');
    root.textContent = 'x x x';
    document.body.appendChild(root);
    try {
      const matches = findTextQuoteMatches(scopeFromElement(root), 'x', 'en');
      expect(matches.length).to.equal(3);
      expect(matches.at(1.5)).to.be.undefined;
      expect(matches.at(-1)).to.be.undefined;
      expect(matches.at(3)).to.be.undefined;
      expect(matches.at(0)).to.not.be.undefined;
    } finally {
      root.remove();
    }
  });

  it('returns an exact empty result for an empty or whitespace-only search() query', () => {
    const root = document.createElement('div');
    root.textContent = 'alpha beta';
    document.body.appendChild(root);
    try {
      const empty = findTextQuoteMatches(scopeFromElement(root), '   ', 'en');
      expect(empty.length).to.equal(0);
      expect(empty.matchCountExact).to.be.true;
      expect(empty.scanComplete).to.be.true;
    } finally {
      root.remove();
    }
  });

  it('returns an exact empty result when the query is longer than the whole corpus', () => {
    const root = document.createElement('div');
    root.textContent = 'short';
    document.body.appendChild(root);
    try {
      const matches = findTextQuoteMatches(
        scopeFromElement(root),
        'this needle is definitely longer than the corpus',
        'en',
      );
      expect(matches.length).to.equal(0);
      expect(matches.matchCountExact).to.be.true;
      expect(matches.scanComplete).to.be.true;
    } finally {
      root.remove();
    }
  });
});

describe('resolvedLimits clamping', () => {
  it('clamps a negative maxQueryCodeUnits override to 0, rejecting even a single-character query', () => {
    const root = document.createElement('div');
    root.textContent = 'x x x x x';
    document.body.appendChild(root);
    try {
      const matches = findTextQuoteMatches(scopeFromElement(root), 'x', 'en', { maxQueryCodeUnits: -5 });
      expect(matches.length).to.equal(0);
      expect(matches.matchCountExact).to.be.false;
    } finally {
      root.remove();
    }
  });

  it('clamps a negative maxMatches override to 0, retaining no occurrences as a lower bound', () => {
    const root = document.createElement('div');
    root.textContent = 'x x x x x';
    document.body.appendChild(root);
    try {
      const matches = findTextQuoteMatches(scopeFromElement(root), 'x', 'en', { maxMatches: -5 });
      expect(matches.length).to.equal(0);
      expect(matches.matchCountExact).to.be.false;
    } finally {
      root.remove();
    }
  });
});

describe('TextQuoteIndex.resolve context ceilings', () => {
  it('returns null when the supplied prefix or suffix exceeds the query ceiling', () => {
    const root = document.createElement('div');
    root.textContent = 'find this text';
    document.body.appendChild(root);
    try {
      const index = createTextQuoteIndex(scopeFromElement(root), 'en');
      const oversizedPrefix = 'p'.repeat(TEXT_QUOTE_LIMITS.maxQueryCodeUnits + 1);
      expect(index.resolve({ quote: 'find', prefix: oversizedPrefix })).to.equal(null);
      const oversizedSuffix = 's'.repeat(TEXT_QUOTE_LIMITS.maxQueryCodeUnits + 1);
      expect(index.resolve({ quote: 'find', suffix: oversizedSuffix })).to.equal(null);
    } finally {
      root.remove();
    }
  });
});

describe('defensive edge cases for range-materialization helpers', () => {
  it('findTextQuoteRanges returns no ranges once the scope structure has gone stale', () => {
    const root = document.createElement('div');
    root.textContent = 'needle';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      (root.firstChild as Text).data = 'changed';
      expect(findTextQuoteRanges(scope, 'needle', 'en')).to.deep.equal([]);
    } finally {
      root.remove();
    }
  });

  it('rangesFromTextQuoteMatches returns [] when the matches length accessor throws or is not a valid length', () => {
    const root = document.createElement('div');
    root.textContent = 'needle';
    document.body.appendChild(root);
    try {
      const scope = scopeFromElement(root);
      const throwingLength = {
        get length(): number {
          throw new Error('hostile length getter');
        },
      } as unknown as readonly ({ start: number; end: number } | null)[];
      expect(rangesFromTextQuoteMatches(scope, throwingLength)).to.deep.equal([]);

      const nanLength = { length: Number.NaN } as unknown as readonly ({ start: number; end: number } | null)[];
      expect(rangesFromTextQuoteMatches(scope, nanLength)).to.deep.equal([]);

      const negativeLength = { length: -1 } as unknown as readonly ({ start: number; end: number } | null)[];
      expect(rangesFromTextQuoteMatches(scope, negativeLength)).to.deep.equal([]);
    } finally {
      root.remove();
    }
  });
});
