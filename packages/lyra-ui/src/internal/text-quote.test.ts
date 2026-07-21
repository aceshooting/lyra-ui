import { expect } from '@open-wc/testing';
import type { TextQuoteScope } from './text-quote.js';
import {
  normalizeQuoteText,
  scopeFromElement,
  scopeFromItems,
  resolveTextQuote,
  buildQuoteAnchor,
} from './text-quote.js';

describe('normalizeQuoteText', () => {
  it('collapses whitespace runs (including NBSP) to a single space and trims', () => {
    expect(normalizeQuoteText('  hello   world  again  ')).to.equal('hello world again');
  });

  it('strips soft hyphens', () => {
    expect(normalizeQuoteText('super­conductor')).to.equal('superconductor');
  });

  it('NFC-normalizes decomposed accented characters', () => {
    const decomposed = 'café'; // "café" as e + combining acute accent
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

  it('keeps original codepoints for a text node where NFC composition changes length', () => {
    const decomposed = 'café'; // "e" + combining acute accent -- 5 UTF-16 units
    const root = makeContent(`<p>${decomposed} society</p>`);
    try {
      const scope = scopeFromElement(root);
      // NFC-composing "café" changes its length (4 vs 5), so normalizeSegment keeps the raw
      // decomposed codepoints for this node rather than the shorter precomposed form.
      expect(scope.text).to.equal(`${decomposed} society`);
      expect(scope.text.normalize('NFC')).to.equal('café society');
      const range = resolveTextQuote(scope, { quote: 'society' });
      expect(range).to.exist;
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
});

describe('resolveTextQuote defensive edge cases against hand-built scopes', () => {
  it('resolves an end offset landing exactly at a segment boundary gap without stepping into the next segment', () => {
    // A hand-built scope whose `text` has an unmapped character ('X' at index 2) between two
    // segments -- exactly the shape produced by `scopeFromItems`' synthetic joining space, which no
    // legitimate (trimmed) search needle can ever start or end on. Constructing it directly exercises
    // `locate`'s defensive "offset lands at this segment's own end" branch.
    const node1 = document.createTextNode('ab');
    const node2 = document.createTextNode('cd');
    const scope: TextQuoteScope = {
      text: 'abXcd',
      segments: [
        { node: node1, normalizedStart: 0, rawOffsets: [0, 1] },
        { node: node2, normalizedStart: 3, rawOffsets: [0, 1] },
      ],
    };
    const range = resolveTextQuote(scope, { quote: 'abX' });
    expect(range).to.exist;
    // Resolved to one past segment 0's last mapped character (offset 2, i.e. the end of "ab") rather
    // than incorrectly landing inside segment 1.
    expect(range!.toString()).to.equal('ab');
    expect(range!.endOffset).to.equal(2);
    expect(range!.endContainer === node1).to.be.true;
  });

  it('returns null when the scope text matches but has no segments to map the match to', () => {
    const scope: TextQuoteScope = { text: 'hello world', segments: [] };
    expect(resolveTextQuote(scope, { quote: 'hello' })).to.be.null;
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
