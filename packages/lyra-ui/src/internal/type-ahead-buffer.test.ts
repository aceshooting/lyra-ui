import { expect } from '@open-wc/testing';
import { TypeAheadBuffer } from './type-ahead-buffer.js';

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
});
