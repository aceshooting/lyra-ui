import { expect } from '@open-wc/testing';
import {
  boundedViewerSearchQuery,
  ViewerSearchWorkBudget,
  VIEWER_SEARCH_QUERY_LIMIT,
  VIEWER_SEARCH_WORK_LIMIT,
} from './viewer-search-limits.js';

describe('bounded model-viewer search work', () => {
  it('rejects an oversized query before locale folding it', () => {
    expect(boundedViewerSearchQuery('x'.repeat(VIEWER_SEARCH_QUERY_LIMIT + 1), 'en'))
      .to.deep.equal({ needle: '', accepted: false });
  });

  it('rejects a bounded raw query when locale folding expands it past the hard ceiling', () => {
    expect(boundedViewerSearchQuery('\u0130'.repeat(VIEWER_SEARCH_QUERY_LIMIT), 'en'))
      .to.deep.equal({ needle: '', accepted: false });
  });

  it('marks a partial field scan incomplete at the aggregate work ceiling', () => {
    const budget = new ViewerSearchWorkBudget();
    expect(budget.includes(`${'a'.repeat(VIEWER_SEARCH_WORK_LIMIT)}needle`, 'needle', 'en')).to.be.false;
    expect(budget.complete).to.be.false;
    expect(budget.exhausted).to.be.true;
  });

  it('charges empty fields so an empty-field collection cannot bypass the ceiling', () => {
    const budget = new ViewerSearchWorkBudget(2);
    for (let index = 0; index < 3; index++) budget.includes('', 'x', 'en');
    expect(budget.complete).to.be.false;
  });

  it('fails closed before locale-folding input whose expanded output cannot fit the work ceiling', () => {
    const budget = new ViewerSearchWorkBudget(100);
    expect(budget.includes('\u0130'.repeat(21), 'needle', 'en')).to.be.false;
    expect(budget.complete).to.be.false;
    expect(budget.exhausted).to.be.true;
  });

  it('bounds validation-only fields without locale-folding or retaining a partial value', () => {
    const budget = new ViewerSearchWorkBudget(2);
    expect(budget.consume('abc')).to.be.false;
    expect(budget.complete).to.be.false;
    expect(budget.exhausted).to.be.true;
  });

  it('falls back to the hard work ceiling for a non-finite budget and clamps a negative one to zero', () => {
    for (const limit of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const budget = new ViewerSearchWorkBudget(limit);
      expect(budget.consume('x'.repeat(VIEWER_SEARCH_WORK_LIMIT)), String(limit)).to.be.true;
      expect(budget.consume('x'), String(limit)).to.be.false;
    }
    const empty = new ViewerSearchWorkBudget(-5);
    expect(empty.canConsume('')).to.be.false;
    expect(empty.includes('needle', 'needle', 'en')).to.be.false;
    expect(empty.complete).to.be.false;
  });

  it('can reject one oversized field without spending a later sibling\'s admission budget', () => {
    const budget = new ViewerSearchWorkBudget(2);
    expect(budget.canConsume('abc')).to.be.false;
    expect(budget.consume('x')).to.be.true;
    expect(budget.consume('y')).to.be.true;
  });
});

it('prepared fields preserve matching and exactness across Unicode and work boundaries', () => {
  for (const locale of ['en', 'tr']) {
    for (const limit of [0, 1, 2, 5, 19, 100]) {
      const direct = new ViewerSearchWorkBudget(limit);
      const prepared = new ViewerSearchWorkBudget(limit);
      for (const value of ['', 'A', '\u0130I', 'abc'.repeat(10)]) {
        const expected = direct.includes(value, 'i', locale);
        const text = prepared.prepare(value, locale);
        expect(text?.includes('i') ?? false).to.equal(expected);
        expect(prepared.complete).to.equal(direct.complete);
        expect(prepared.exhausted).to.equal(direct.exhausted);
      }
    }
  }
});
