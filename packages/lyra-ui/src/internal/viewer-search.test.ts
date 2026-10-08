import { expect } from '@open-wc/testing';
import { Announcer } from './announcer.js';
import { advanceViewerSearchIndex, announceSearchResult, sameViewerSearchDetail, ViewerSearchState, viewerSearchDetail } from './viewer-search.js';

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

describe('viewer search state', () => {
  it('keeps canonical detail fields and wraps the retained match cursor', () => {
    const initial = viewerSearchDetail('term', 3, false, 0);
    expect(initial).to.deep.equal({ query: 'term', matchCount: 3, matchCountExact: false, activeIndex: 0 });
    expect(advanceViewerSearchIndex(2, 3, 1)).to.equal(0);
    expect(advanceViewerSearchIndex(0, 3, -1)).to.equal(2);
    expect(advanceViewerSearchIndex(-1, 0, 1)).to.equal(-1);
    expect(sameViewerSearchDetail(initial, viewerSearchDetail('term', 3, false, 0))).to.equal(true);
    expect(sameViewerSearchDetail(initial, viewerSearchDetail('term', 3, true, 0))).to.equal(false);
  });
});

describe('ViewerSearchState', () => {
  const make = () => {
    const events: unknown[] = [];
    let changes = 0;
    const state = new ViewerSearchState<number[]>(() => [], (detail) => events.push(detail), () => changes++);
    return { state, events, changes: () => changes };
  };

  it('publishes a result with the first match active and emits the canonical detail', () => {
    const { state, events } = make();
    state.query = 'a';
    state.publish([4, 9], false);
    expect(state.activeIndex).to.equal(0);
    expect(events).to.deep.equal([{ query: 'a', matchCount: 2, matchCountExact: false, activeIndex: 0 }]);
  });

  it('publishes an empty result with no active match', () => {
    const { state, events } = make();
    state.query = 'zz';
    state.publish();
    expect(events).to.deep.equal([{ query: 'zz', matchCount: 0, matchCountExact: true, activeIndex: -1 }]);
  });

  it('steps with wrap-around, emitting only when there are matches', () => {
    const { state, events } = make();
    expect(state.step(1)).to.equal(false);
    state.publish([1, 2, 3]);
    expect(state.step(-1)).to.equal(true);
    expect(state.activeIndex).to.equal(2);
    expect(state.step(1)).to.equal(true);
    expect(state.activeIndex).to.equal(0);
    expect(events).to.have.lengthOf(3);
  });

  it('tracks dirtiness, resets silently and clears with an event', () => {
    const { state, events, changes } = make();
    expect(state.dirty).to.equal(false);
    state.query = 'q';
    state.publish([1], false);
    expect(state.dirty).to.equal(true);
    state.reset();
    expect(state.dirty).to.equal(false);
    expect(events).to.have.lengthOf(1);
    state.query = 'q';
    state.clear();
    expect(events.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
    expect(changes()).to.be.greaterThan(2);
  });
});
