import { aTimeout, expect } from '@open-wc/testing';
import { loadMarkdownDeps } from './markdown-loader.js';
import type { MarkedModule } from './markdown-loader.js';
import {
  addFailedHighlightKey,
  applyMarkdownFragmentAnchor,
  createMarkdownParser,
  FAILED_HIGHLIGHT_MAX,
  getCachedHighlight,
  HIGHLIGHT_CACHE_MAX,
  HIGHLIGHT_CACHE_MAX_BYTES,
  hitTestHighlightRanges,
  internalLinkHrefFrom,
  markdownHighlightKey,
  MarkdownParserController,
  parseMarkdownDocument,
  processPendingHighlights,
  renderMarkdownDocument,
  tokenizeMarkdownHighlight,
  watchMarkdownDarkTheme,
  setCachedHighlight,
  type PendingHighlight,
} from './markdown-shared.js';

it('applies the resolved palette immediately when starting the shared theme watch', () => {
  const host = document.body.appendChild(document.createElement('div'));
  host.style.color = 'rgb(255, 255, 255)';
  host.style.backgroundColor = 'rgb(0, 0, 0)';
  const applied: boolean[] = [];
  const cleanup = watchMarkdownDarkTheme(host, (dark) => applied.push(dark));
  try {
    expect(applied).to.deep.equal([true]);
  } finally {
    cleanup();
    host.remove();
  }
});

describe('Markdown parser admission', () => {
  it('rejects absent and malformed optional-peer module shapes', () => {
    expect(createMarkdownParser(undefined)).to.equal(undefined);
    expect(createMarkdownParser(null as unknown as MarkedModule)).to.equal(undefined);
    expect(createMarkdownParser({} as MarkedModule)).to.equal(undefined);
    expect(createMarkdownParser((() => undefined) as unknown as MarkedModule)).to.equal(undefined);
  });

  it('keeps an unresolved parser controller empty', () => {
    const controller = new MarkdownParserController();
    expect(controller.get(undefined)).to.equal(undefined);
  });
});

describe('Markdown sanitizer boundary', () => {
  it('fails closed when a capability-valid sanitizer returns non-markup', async () => {
    const deps = await loadMarkdownDeps();
    const outcome = renderMarkdownDocument({
      tag: 'lr-markdown',
      deps: {
        marked: deps.marked,
        DOMPurify: { sanitize: () => null },
      },
      htmlMode: 'sanitize',
      math: false,
      parse: () => ({ html: '<strong>safe source</strong>', hadMathFallback: false }),
      onParsed: () => undefined,
      isKatexConfirmedMissing: () => false,
    });

    expect(outcome.status).to.equal('fallback');
    if (outcome.status === 'fallback') {
      expect(outcome.error instanceof TypeError).to.equal(true);
    }
  });
});

describe('Markdown highlight resource bounds', () => {
  it('admits a stable first 100 active blocks so a 101-block document settles after caching', async () => {
    const marked = (await loadMarkdownDeps()).marked!;
    const cache = new Map<string, string>();
    const content = Array.from(
      { length: HIGHLIGHT_CACHE_MAX + 1 },
      (_, index) => `\`\`\`lang${index}\nvalue ${index}\n\`\`\``,
    ).join('\n\n');

    const parse = (): PendingHighlight[] => {
      const pendingKeys: PendingHighlight[] = [];
      parseMarkdownDocument({
        marked,
        content,
        gfm: true,
        linkTarget: null,
        headingOffset: 0,
        escapeHtmlOption: false,
        trustedHtmlOption: false,
        highlightCodeOption: true,
        getCachedHighlight: (key) => getCachedHighlight(cache, key),
        failedHighlightKeys: new Set(),
        headingAnchorsOption: false,
        mathOption: false,
        cachedKatex: null,
        pendingKeys,
        headingTreeOut: [],
      });
      return pendingKeys;
    };

    const first = parse();
    expect(first).to.have.lengthOf(HIGHLIGHT_CACHE_MAX);
    for (const pending of first) {
      expect(setCachedHighlight(cache, pending.key, `<pre>${pending.lang}</pre>`)).to.be.true;
    }
    expect(parse()).to.have.lengthOf(0);
    expect(parse()).to.have.lengthOf(0);
  });

  it('uses bounded digests instead of retaining raw source in cache and failure keys', () => {
    const source = `private-${'x'.repeat(10_000)}`;
    const key = markdownHighlightKey('ts', source);
    expect(key).to.not.contain(source);
    expect(key.length).to.be.lessThan(80);

    const failed = new Set<string>();
    for (let index = 0; index < FAILED_HIGHLIGHT_MAX + 20; index++) {
      addFailedHighlightKey(failed, `key-${index}`);
    }
    expect(failed.size).to.equal(FAILED_HIGHLIGHT_MAX);
    expect(failed.has('key-0')).to.be.false;
    expect(failed.has(`key-${FAILED_HIGHLIGHT_MAX + 19}`)).to.be.true;

    const retainedOrder = [...failed];
    addFailedHighlightKey(failed, retainedOrder[0]!);
    expect([...failed]).to.deep.equal(retainedOrder);
  });

  it('rejects oversized entries and keeps the total successful-cache byte budget bounded', () => {
    const cache = new Map<string, string>();
    expect(setCachedHighlight(cache, 'oversized', 'x'.repeat(300_000))).to.be.false;
    expect(cache.size).to.equal(0);

    for (let index = 0; index < 8; index++) {
      expect(setCachedHighlight(cache, `key-${index}`, 'x'.repeat(200_000))).to.be.true;
    }
    const retainedBytes = [...cache].reduce((total, [key, html]) => total + (key.length + html.length) * 2, 0);
    expect(retainedBytes).to.be.at.most(HIGHLIGHT_CACHE_MAX_BYTES);
    expect(cache.size).to.be.lessThan(8);
  });

  it('tolerates a Map subclass whose oldest value disappears between iteration and eviction', () => {
    class DisappearingReadMap extends Map<string, string> {
      override get(key: string): string | undefined {
        return key === 'stale' ? undefined : super.get(key);
      }
    }
    const cache = new DisappearingReadMap([['stale', '<pre>old</pre>']]);

    expect(setCachedHighlight(cache, 'replacement', '<pre>safe</pre>', 1)).to.be.true;
    expect([...cache]).to.deep.equal([['replacement', '<pre>safe</pre>']]);
  });

  it('deduplicates identical work and runs at most four tokenizers concurrently', async () => {
    const pending = Array.from({ length: 20 }, (_, index) => ({
      key: `key-${index % 10}`,
      lang: 'ts',
      code: `value ${index % 10}`,
    }));
    const seen = new Set<string>();
    let active = 0;
    let maximumActive = 0;
    await processPendingHighlights(pending, async (item) => {
      seen.add(item.key);
      active++;
      maximumActive = Math.max(maximumActive, active);
      await aTimeout(0);
      active--;
    });
    expect(seen.size).to.equal(10);
    expect(maximumActive).to.be.at.most(4);
  });
});

describe('Markdown rendering edge guards', () => {
  it('discards malformed and non-palette-only highlight styles', () => {
    const highlighted = tokenizeMarkdownHighlight(
      {
        codeToHtml: () =>
          '<pre style="not-a-declaration;position:fixed"><code style="background:url(https://example.test/x)">x</code></pre>',
      } as never,
      { key: 'plain', lang: 'text', code: 'x' },
    );

    expect(highlighted).to.equal('<pre><code>x</code></pre>\n');
  });

  it('returns false when heading metadata has no rendered fragment target', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>No headings rendered</p>';
    expect(applyMarkdownFragmentAnchor(
      root,
      { kind: 'fragment', id: 'missing-heading' },
      [{ id: 'missing-heading', label: 'Missing heading', level: 2 }],
    )).to.be.false;
  });

  it('bounds highlight hit testing before scanning an unbounded rectangle source', () => {
    let inspected = 0;
    const rects = {
      *[Symbol.iterator](): IterableIterator<DOMRect> {
        for (let index = 0; index < 2_000; index++) {
          inspected += 1;
          yield { left: 10, right: 20, top: 10, bottom: 20 } as DOMRect;
        }
      },
    } as unknown as DOMRectList;
    const range = {
      getClientRects: () => rects,
    } as unknown as Range;

    expect(hitTestHighlightRanges([{ id: 'far-away', range }], 0, 0)).to.equal(null);
    expect(inspected).to.equal(1_001);
  });

  it('treats an anchor without an href attribute as a non-internal link', () => {
    const anchor = document.createElement('a');
    const event = { composedPath: () => [anchor] } as unknown as MouseEvent;
    expect(internalLinkHrefFrom(event, '/docs/')).to.equal(null);
  });

  it('skips a hostile composed-path value before a later native anchor', () => {
    const hostile = new Proxy({}, {
      has() {
        throw new Error('hostile composed-path probe');
      },
    });
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/docs/real');
    const event = { composedPath: () => [hostile, anchor] } as unknown as MouseEvent;

    expect(internalLinkHrefFrom(event, '/docs/')).to.equal('/docs/real');
  });

  it('skips a structural anchor lookalike before a later native anchor', () => {
    const lookalike = {
      nodeType: 1,
      localName: 'a',
      getAttribute: () => '/docs/forged',
    };
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/docs/real');
    const event = { composedPath: () => [lookalike, anchor] } as unknown as MouseEvent;

    expect(internalLinkHrefFrom(event, '/docs/')).to.equal('/docs/real');
  });

  it('skips forged realm metadata before a later native anchor', () => {
    const forgedElementConstructor = function (): void {};
    Object.defineProperties(forgedElementConstructor.prototype, {
      getAttribute: { value: () => '/docs/forged' },
      localName: { get: () => 'a' },
    });
    const forged = {
      nodeType: 1,
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      ownerDocument: { defaultView: { Element: forgedElementConstructor } },
    };
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/docs/real');
    const event = { composedPath: () => [forged, anchor] } as unknown as MouseEvent;

    expect(internalLinkHrefFrom(event, '/docs/')).to.equal('/docs/real');
  });

  it('keeps an iframe-created anchor accepted before and after adoption despite an own ownerDocument shadow', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    try {
      const anchor = iframe.contentDocument!.createElement('a');
      anchor.setAttribute('href', '/docs/foreign');
      const beforeAdoption = { composedPath: () => [anchor] } as unknown as MouseEvent;

      expect(internalLinkHrefFrom(beforeAdoption, '/docs/')).to.equal('/docs/foreign');

      document.adoptNode(anchor);
      const forgedElementConstructor = function (): void {};
      Object.defineProperties(forgedElementConstructor.prototype, {
        getAttribute: { value: () => '/docs/forged' },
        localName: { get: () => 'a' },
      });
      Object.defineProperty(anchor, 'ownerDocument', {
        configurable: true,
        value: { defaultView: { Element: forgedElementConstructor } },
      });
      const afterAdoption = { composedPath: () => [anchor] } as unknown as MouseEvent;

      expect(internalLinkHrefFrom(afterAdoption, '/docs/')).to.equal('/docs/foreign');
    } finally {
      iframe.remove();
    }
  });
});

describe('parseMarkdownDocument renderer overrides emit well-formed, matched-quote HTML', () => {
  it('produces well-formed, independently addressable elements for every renderer override', async () => {
    const marked = (await loadMarkdownDeps()).marked!;
    const content = [
      '# Heading One',
      '',
      'Paragraph text with `inline code` span.',
      '',
      '> Blockquote text here',
      '',
      '```text',
      'fenced code body',
      '```',
      '',
      '| Col A | Col B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '[Link text](https://example.com/page "Link title")',
      '',
      '![Alt text](https://example.com/pic.png "Image title")',
      '',
      'Inline math $x^2$ done.',
    ].join('\n');

    const { html } = parseMarkdownDocument({
      marked,
      content,
      gfm: true,
      linkTarget: '_blank',
      headingOffset: 0,
      escapeHtmlOption: false,
      trustedHtmlOption: false,
      highlightCodeOption: false,
      getCachedHighlight: () => undefined,
      failedHighlightKeys: new Set(),
      headingAnchorsOption: false,
      mathOption: true,
      cachedKatex: {
        renderToString: (tex: string) => `<math><mi>${tex}</mi></math>`,
      },
      pendingKeys: [],
      headingTreeOut: [],
    });

    // A real browser HTML parser, not a string-content check: the historical bug (mismatched
    // open/close attribute-quote characters) makes the parser swallow subsequent tag boundaries
    // into a broken attribute value, so a corrupted document shows up here as missing/merged
    // elements rather than as a substring difference.
    const container = document.createElement('div');
    container.innerHTML = html;

    const heading = container.querySelector('[part="heading"]');
    expect(heading, 'heading element').to.exist;
    expect(heading!.tagName).to.equal('H1');
    expect(heading!.textContent).to.equal('Heading One');

    const paragraphs = container.querySelectorAll('[part="paragraph"]');
    expect(paragraphs.length).to.be.at.least(3);

    const codespan = container.querySelector('[part="inline-code"]');
    expect(codespan, 'inline code element').to.exist;
    expect(codespan!.textContent).to.equal('inline code');

    const blockquote = container.querySelector('[part="blockquote"]');
    expect(blockquote, 'blockquote element').to.exist;
    expect(blockquote!.textContent).to.contain('Blockquote text here');

    const codeBlock = container.querySelector('[part="code-block"]');
    expect(codeBlock, 'code block element').to.exist;
    expect(codeBlock!.tagName).to.equal('PRE');
    expect(codeBlock!.getAttribute('tabindex')).to.equal('0');
    expect(codeBlock!.querySelector('code')!.textContent).to.equal('fenced code body\n');

    const table = container.querySelector('[part="table"]');
    expect(table, 'table element').to.exist;
    expect(table!.querySelector('thead th')!.textContent).to.equal('Col A');
    expect(table!.querySelectorAll('tbody td')[0]!.textContent).to.equal('1');

    const link = container.querySelector('[part="link"]');
    expect(link, 'link element').to.exist;
    expect(link!.getAttribute('href')).to.equal('https://example.com/page');
    expect(link!.getAttribute('title')).to.equal('Link title');
    expect(link!.getAttribute('target')).to.equal('_blank');
    expect(link!.getAttribute('rel')).to.equal('noopener noreferrer');
    expect(link!.textContent).to.equal('Link text');

    const image = container.querySelector('[part="img"]');
    expect(image, 'image element').to.exist;
    expect(image!.getAttribute('src')).to.equal('https://example.com/pic.png');
    expect(image!.getAttribute('alt')).to.equal('Alt text');
    expect(image!.getAttribute('title')).to.equal('Image title');

    const math = container.querySelector('[part="math"]');
    expect(math, 'math element').to.exist;
    expect(math!.getAttribute('data-display')).to.equal('inline');

    // No renderer-emitted attribute soup should have leaked into text content anywhere in the tree.
    expect(container.textContent).to.not.contain('part=');
  });

  it('uses only each task item\'s own primary inline text as an escaped checkbox label', async () => {
    const marked = (await loadMarkdownDeps()).marked!;
    const { html } = parseMarkdownDocument({
      marked,
      content: '- [x] **Own "primary"** [linked text](/docs/link) and `code`\n  - [ ] Nested task text',
      gfm: true,
      linkTarget: null,
      headingOffset: 0,
      escapeHtmlOption: false,
      trustedHtmlOption: false,
      highlightCodeOption: false,
      getCachedHighlight: () => undefined,
      failedHighlightKeys: new Set(),
      headingAnchorsOption: false,
      mathOption: false,
      cachedKatex: null,
      pendingKeys: [],
      headingTreeOut: [],
    });
    expect(html).to.contain("aria-label='Own &quot;primary&quot; linked text and code'");
    const container = document.createElement('div');
    container.innerHTML = html;
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(inputs.length).to.equal(2);
    expect(inputs[0]!.getAttribute('aria-label')).to.equal('Own "primary" linked text and code');
    expect(inputs[0]!.getAttribute('aria-label')).to.not.contain('Nested task text');
    expect(inputs[1]!.getAttribute('aria-label')).to.equal('Nested task text');
  });
});

describe('parseMarkdownDocument link/image scheme allowlist', () => {
  const parse = (content: string, marked: MarkedModule, trustedHtmlOption: boolean): string => {
    const { html } = parseMarkdownDocument({
      marked,
      content,
      gfm: true,
      linkTarget: null,
      headingOffset: 0,
      escapeHtmlOption: false,
      trustedHtmlOption,
      highlightCodeOption: false,
      getCachedHighlight: () => undefined,
      failedHighlightKeys: new Set(),
      headingAnchorsOption: false,
      mathOption: false,
      cachedKatex: null,
      pendingKeys: [],
      headingTreeOut: [],
    });
    return html;
  };

  it('drops a javascript: markdown-native link href (not trusted) instead of emitting it', async () => {
    const marked = (await loadMarkdownDeps()).marked!;
    const html = parse('[click me](javascript:alert(1))', marked, false);
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(
      container.querySelector('a') === null,
      'no anchor should be emitted for a rejected scheme',
    ).to.be.true;
    expect(container.textContent).to.contain('click me');
  });

  it('drops a javascript: markdown-native image src (not trusted) instead of emitting it', async () => {
    const marked = (await loadMarkdownDeps()).marked!;
    const html = parse('![alt text](javascript:alert(1))', marked, false);
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(
      container.querySelector('img') === null,
      'no img should be emitted for a rejected scheme',
    ).to.be.true;
    expect(container.textContent).to.contain('alt text');
  });

  it('still allows an ordinary https: link/image and a data: image (not trusted)', async () => {
    const marked = (await loadMarkdownDeps()).marked!;
    const html = parse(
      '[docs](https://example.com/docs)\n\n![pixel](data:image/png;base64,AAAA)',
      marked,
      false,
    );
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('a')!.getAttribute('href')).to.equal('https://example.com/docs');
    expect(container.querySelector('img')!.getAttribute('src')).to.equal('data:image/png;base64,AAAA');
  });

  it('bypasses the allowlist entirely when trustedHtmlOption is set, as documented', async () => {
    const marked = (await loadMarkdownDeps()).marked!;
    const html = parse('[click me](javascript:alert(1))', marked, true);
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('a')!.getAttribute('href')).to.equal('javascript:alert(1)');
  });
});
