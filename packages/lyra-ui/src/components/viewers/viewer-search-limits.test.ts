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

  it('bounds validation-only fields without locale-folding or retaining a partial value', () => {
    const budget = new ViewerSearchWorkBudget(2);
    expect(budget.consume('abc')).to.be.false;
    expect(budget.complete).to.be.false;
    expect(budget.exhausted).to.be.true;
  });
});
