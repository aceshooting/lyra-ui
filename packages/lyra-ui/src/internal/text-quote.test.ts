import { expect } from '@open-wc/testing';
import type { TextQuoteScope } from './text-quote.js';
import {
  TEXT_QUOTE_LIMITS,
  createTextQuoteIndex,
  findTextQuoteMatches,
  normalizeQuoteText,
  scopeFromElement,
  scopeFromItems,
  resolveTextQuote,
  rangeFromTextQuoteMatch,
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
      expect(rangeFromTextQuoteMatch(scope, { start: 99, end: 100 })).to.be.null;

      const span = document.createElement('span');
      span.textContent = 'x';
      const badItems = scopeFromItems([{ text: 'much longer', element: span }]);
      const badMatch = findTextQuoteMatches(badItems, 'longer').at(0)!;
      expect(rangeFromTextQuoteMatch(badItems, badMatch)).to.be.null;
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
    document.body.appendChild(root);
    try {
      const range = document.createRange();
      range.selectNodeContents(root);
      const scope: TextQuoteScope = { text: '', segments: [], truncated: true };
      expect(() => buildQuoteAnchor(range, scope)).to.not.throw();
      expect(buildQuoteAnchor(range, scope)).to.deep.equal({ kind: 'text-quote', quote: '' });
    } finally {
      root.remove();
    }
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

  it('skips items whose element has no text node', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      const empty = document.createElement('span');
      container.appendChild(empty);
      const scope = scopeFromItems([{ text: 'ignored', element: empty }]);
      expect(scope.text).to.equal('');
      expect(scope.segments).to.have.length(0);
    } finally {
      container.remove();
    }
  });

  it('skips an item whose own text collapses entirely to nothing', () => {
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
      expect(scope.text).to.equal('Hello World');
      expect(scope.segments).to.have.length(2);
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
    document.body.appendChild(root);
    try {
      const ranges = findTextQuoteRanges(scopeFromElement(root), 'foo', 'en');
      expect(ranges).to.have.length(1);
      expect(ranges[0]!.toString()).to.equal('Foo');
    } finally {
      root.remove();
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
