import { expect } from '@open-wc/testing';
import { createHaystackMemo, foldSearchText, prepareNeedle } from './search-haystack.js';

describe('search haystacks', () => {
  it('folds once per identity and locale across needle changes', () => {
    let calls = 0;
    const memo = createHaystackMemo<string>((entry, locale) => { calls++; return foldSearchText(entry, locale); });
    const entries = ['Café', 'I'];
    const first = memo(entries, 'en');
    expect(first.filter(text => text.includes(prepareNeedle('CAFE', 'en')))).to.deep.equal(['cafe']);
    expect(memo(entries, 'en')).to.equal(first);
    expect(calls).to.equal(2);
    expect(memo(entries, 'tr')[1]).to.equal('ı');
    expect(calls).to.equal(4);
    expect(memo([...entries], 'tr')).not.to.equal(first);
  });
  it('normalizes accents, whitespace and malformed locale input', () => {
    expect(prepareNeedle('  ÉCOLE  ', 'en')).to.equal('ecole');
    expect(foldSearchText('İ', 'tr')).to.equal('i');
    expect(foldSearchText('ABC', 'not_a_locale@')).to.equal('abc');
  });
});
