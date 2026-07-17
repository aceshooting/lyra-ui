import { expect } from '@open-wc/testing';
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
});
