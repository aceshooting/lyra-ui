import { aTimeout, expect } from '@open-wc/testing';
import { loadMarkdownDeps } from './markdown-loader.js';
import type { MarkedModule } from './markdown-loader.js';
import {
  addFailedHighlightKey,
  FAILED_HIGHLIGHT_MAX,
  getCachedHighlight,
  HIGHLIGHT_CACHE_MAX,
  HIGHLIGHT_CACHE_MAX_BYTES,
  markdownHighlightKey,
  parseMarkdownDocument,
  processPendingHighlights,
  setCachedHighlight,
  type PendingHighlight,
} from './markdown-shared.js';

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
