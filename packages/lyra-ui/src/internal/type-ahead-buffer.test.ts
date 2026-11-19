import { expect } from '@open-wc/testing';
import { TypeAheadBuffer, type TypeAheadMemo } from './type-ahead-buffer.js';
import { foldSearchText } from './search-haystack.js';

describe('type-ahead buffer', () => {
  it('matches from after the active row and skips unavailable matches', () => {
    const host = document.createElement('div');
    const buffer = new TypeAheadBuffer(host);
    const rows = [
      { label: 'Alpha', disabled: false },
      { label: 'Beta', disabled: true },
      { label: 'Bravo', disabled: false },
    ];
    buffer.add('b', 'en');
    expect(buffer.match(rows, 0, row => row.label, 'en', row => !row.disabled)).to.equal(2);
    expect(buffer.match(rows, 2, row => row.label, 'en', row => !row.disabled)).to.equal(2);
    buffer.clear();
    expect(buffer.match(rows, 0, row => row.label, 'en')).to.equal(null);
  });

  it('ignores modified and composing key events', () => {
    const buffer = new TypeAheadBuffer(document.createElement('div'));
    expect(buffer.accepts(new KeyboardEvent('keydown', { key: 'a' }))).to.equal(true);
    expect(buffer.accepts(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))).to.equal(false);
    expect(buffer.accepts(new KeyboardEvent('keydown', { key: 'a', isComposing: true }))).to.equal(false);
  });

  it('folds each label once per label and locale when given a memo', () => {
    const buffer = new TypeAheadBuffer(document.createElement('div'));
    const rows = [{ label: 'Alpha' }, { label: 'Bravo' }];
    let reads = 0;
    const label = (row: { label: string }): string => {
      reads++;
      return row.label;
    };
    const memo: TypeAheadMemo = new WeakMap();
    buffer.add('b', 'en');
    expect(buffer.match(rows, -1, label, 'en', () => true, memo)).to.equal(1);
    const first = memo.get(rows[1]!)!;
    expect(first.folded).to.equal('bravo');
    expect(buffer.match(rows, -1, label, 'en', () => true, memo)).to.equal(1);
    expect(memo.get(rows[1]!)).to.equal(first);
    rows[1]!.label = 'Bison';
    expect(buffer.match(rows, -1, label, 'en', () => true, memo)).to.equal(1);
    expect(memo.get(rows[1]!)).to.not.equal(first);
    expect(memo.get(rows[1]!)!.folded).to.equal('bison');
    expect(reads).to.be.greaterThan(0);
  });

  it('folds with the locale (Turkish dotted capital I) and refolds on a locale change', () => {
    const buffer = new TypeAheadBuffer(document.createElement('div'));
    const rows = [{ label: 'Işık' }];
    const memo: TypeAheadMemo = new WeakMap();
    buffer.add('ı', 'en');
    expect(buffer.match(rows, -1, r => r.label, 'en', () => true, memo)).to.equal(null);
    buffer.clear();
    buffer.add('ı', 'tr');
    expect(buffer.match(rows, -1, r => r.label, 'tr', () => true, memo)).to.equal(0);
  });

  it('matches primitive items without a memo entry', () => {
    const buffer = new TypeAheadBuffer(document.createElement('div'));
    buffer.add('b', 'en');
    expect(buffer.match(['a', 'b'], -1, x => x, 'en', () => true, new WeakMap())).to.equal(1);
  });
  it('applies a custom fold to keys and memoized labels', () => {
    const buffer = new TypeAheadBuffer(document.createElement('div'), foldSearchText);
    const rows = [{ label: 'Alpha' }, { label: 'École' }];
    const memo: TypeAheadMemo = new WeakMap();
    buffer.add('E', 'fr');
    expect(buffer.text).to.equal('e');
    expect(buffer.match(rows, -1, r => r.label, 'fr', () => true, memo)).to.equal(1);
    expect(memo.get(rows[1]!)!.folded).to.equal('ecole');
    buffer.clear();
    buffer.add('é', 'fr');
    expect(buffer.match(rows, -1, r => r.label, 'fr')).to.equal(1);
  });
});
