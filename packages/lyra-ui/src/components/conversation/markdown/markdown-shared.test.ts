import { aTimeout, expect } from '@open-wc/testing';
import { loadMarkdownDeps } from './markdown-loader.js';
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
