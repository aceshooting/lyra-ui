import { expect } from '@open-wc/testing';
import { Announcer } from './announcer.js';
import { announceSearchResult } from './viewer-search.js';

/**
 * Mirrors `resolveLyraString()` closely enough to prove which key
 * `announceSearchResult()` reaches for: pluralized entries are CLDR-category
 * objects reduced through `Intl.PluralRules` before interpolation. The locale
 * is pinned to English here because the templates below are the English ones.
 */
function localizeStub(key: string, _fallback: string | undefined, values?: Record<string, string | number>): string {
  const templates: Record<string, string | Record<string, string>> = {
    viewerSearchNoMatches: 'No matches',
    viewerSearchMatchCount: { one: '{count} match', other: '{count} matches' },
    viewerSearchActiveMatch: 'Match {current} of {total}',
  };
  const message = templates[key] ?? key;
  const count = values?.['pluralCount'] ?? values?.['count'];
  let text: string;
  if (typeof message === 'string') {
    text = message;
  } else if (typeof count === 'number') {
    text = message[new Intl.PluralRules('en').select(count)] ?? message['other']!;
  } else {
    text = message['other']!;
  }
  for (const [k, v] of Object.entries(values ?? {})) text = text.replace(`{${k}}`, String(v));
  return text;
}

describe('announceSearchResult', () => {
  it('announces "No matches" when matchCount is 0', (done) => {
    const announcer = new Announcer({
      throttleMs: 1,
      onFlush: (text) => {
        expect(text).to.equal('No matches');
        done();
      },
    });
    announceSearchResult(localizeStub, announcer, 'en', 0, -1);
  });

  it('announces a singular match-count phrase before any navigation', (done) => {
    const announcer = new Announcer({
      throttleMs: 1,
      onFlush: (text) => {
        expect(text).to.equal('1 match');
        done();
      },
    });
    announceSearchResult(localizeStub, announcer, 'en', 1, -1);
  });

  it('announces a plural match-count phrase before any navigation', (done) => {
    const announcer = new Announcer({
      throttleMs: 1,
      onFlush: (text) => {
        expect(text).to.equal('3 matches');
        done();
      },
    });
    announceSearchResult(localizeStub, announcer, 'en', 3, -1);
  });

  it('announces the active-match position once navigation has started', (done) => {
    const announcer = new Announcer({
      throttleMs: 1,
      onFlush: (text) => {
        expect(text).to.equal('Match 2 of 5');
        done();
      },
    });
    announceSearchResult(localizeStub, announcer, 'en', 5, 1);
  });

  it('formats every interpolated search number in the effective locale', (done) => {
    const locale = 'ar-EG';
    const numberFormat = new Intl.NumberFormat(locale);
    const announcer = new Announcer({
      throttleMs: 1,
      onFlush: (text) => {
        expect(text).to.equal(
          `Match ${numberFormat.format(2)} of ${numberFormat.format(1234)}`,
        );
        done();
      },
    });
    announceSearchResult(localizeStub, announcer, locale, 1234, 1);
  });
});
