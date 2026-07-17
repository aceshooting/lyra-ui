import { expect } from '@open-wc/testing';
import { Announcer } from './announcer.js';
import { announceSearchResult } from './viewer-search.js';

function localizeStub(key: string, _fallback: string | undefined, values?: Record<string, string | number>): string {
  const templates: Record<string, string> = {
    viewerSearchNoMatches: 'No matches',
    viewerSearchMatchCount: '{count} match',
    viewerSearchMatchCountPlural: '{count} matches',
    viewerSearchActiveMatch: 'Match {current} of {total}',
  };
  let text = templates[key] ?? key;
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
    announceSearchResult(localizeStub, announcer, 0, -1);
  });

  it('announces a singular match-count phrase before any navigation', (done) => {
    const announcer = new Announcer({
      throttleMs: 1,
      onFlush: (text) => {
        expect(text).to.equal('1 match');
        done();
      },
    });
    announceSearchResult(localizeStub, announcer, 1, -1);
  });

  it('announces a plural match-count phrase before any navigation', (done) => {
    const announcer = new Announcer({
      throttleMs: 1,
      onFlush: (text) => {
        expect(text).to.equal('3 matches');
        done();
      },
    });
    announceSearchResult(localizeStub, announcer, 3, -1);
  });

  it('announces the active-match position once navigation has started', (done) => {
    const announcer = new Announcer({
      throttleMs: 1,
      onFlush: (text) => {
        expect(text).to.equal('Match 2 of 5');
        done();
      },
    });
    announceSearchResult(localizeStub, announcer, 5, 1);
  });
});
