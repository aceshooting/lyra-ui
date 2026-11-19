import { expect, fixture, html } from '@open-wc/testing';
import * as quote from './text-quote.js';
import {
  TEXT_SELECTION_RECT_LIMIT,
  boundedSelectionRects,
  boundedSelectionText,
  normalizeQuoteText,
} from './text-selection.js';

describe('text-selection', () => {
  it('is the implementation text-quote re-exports', () => {
    expect(quote.boundedSelectionText === boundedSelectionText).to.equal(true);
    expect(quote.boundedSelectionRects === boundedSelectionRects).to.equal(true);
    expect(quote.normalizeQuoteText === normalizeQuoteText).to.equal(true);
    expect(quote.TEXT_SELECTION_RECT_LIMIT).to.equal(TEXT_SELECTION_RECT_LIMIT);
  });

  it('reads normalized, bounded text across elements and copies finite rects', async () => {
    const root = await fixture<HTMLDivElement>(html`<div><p>Alpha   beta</p><p>gam­ma <b>delta</b></p></div>`);
    const range = document.createRange();
    range.selectNodeContents(root);
    expect(boundedSelectionText(range)).to.equal('Alpha betagamma delta');
    expect(boundedSelectionText(range, 5)).to.equal('Alpha');
    expect(boundedSelectionText(range, 0)).to.equal('');
    expect(boundedSelectionText(range, Number.NaN)).to.equal('Alpha betagamma delta');
    const text = root.querySelector('p')!.firstChild!;
    const inner = document.createRange();
    inner.setStart(text, 2);
    inner.setEnd(text, 9);
    expect(boundedSelectionText(inner)).to.equal('pha b');
    const rects = boundedSelectionRects(range);
    expect(rects.length).to.be.greaterThan(0);
    expect(Object.isFrozen(rects) && Object.isFrozen(rects[0])).to.equal(true);
    expect(boundedSelectionRects(range, 1).length).to.equal(1);
    expect(boundedSelectionRects(range, Number.POSITIVE_INFINITY).length).to.equal(rects.length);
  });
});
