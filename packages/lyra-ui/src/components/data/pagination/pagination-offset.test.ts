import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../../lr-pagination.js';
import type { LyraPagination } from '../../lr-pagination.js';

const pageButton = (el: LyraPagination, page: number) =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="page"]')).find((b) => b.textContent?.trim() === String(page))!;

describe('lr-pagination offset', () => {
  it('reports the zero-based offset with every page and page-size proposal', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="200" page-size="20" .pageSizeOptions=${[20, 50]}></lr-pagination>`);
    const before = oneEvent(el, 'lr-before-page-change');
    const change = oneEvent(el, 'lr-page-change');
    pageButton(el, 3).click();
    expect({ ...(await before).detail }).to.deep.equal({ page: 3, pageSize: 20, offset: 40 });
    expect({ ...(await change).detail }).to.deep.equal({ page: 3, pageSize: 20, offset: 40 });
    el.page = 4;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part~="page-size"]')!;
    const sized = oneEvent(el, 'lr-page-size-change');
    select.value = '50';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect({ ...(await sized).detail }).to.deep.equal({ page: 2, pageSize: 50, offset: 50 });
  });

  it('derives the page from an offset attribute, flooring a non-multiple', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="200" page-size="20" offset="40"></lr-pagination>`);
    expect(el.page).to.equal(3);
    expect(el.getAttribute('page')).to.equal('3');
    expect(pageButton(el, 3).getAttribute('aria-current')).to.equal('page');
    el.offset = 59;
    await el.updateComplete;
    expect(el.page).to.equal(3);
    el.offset = 60;
    await el.updateComplete;
    expect(el.page).to.equal(4);
    el.pageSize = 50;
    await el.updateComplete;
    expect(el.page).to.equal(2);
  });

  it('lets page win in the same update and ignores negative or non-finite offsets', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="200" page-size="20" page="5" offset="40"></lr-pagination>`);
    expect(el.page).to.equal(5);
    el.offset = 100;
    el.page = 2;
    await el.updateComplete;
    expect(el.page).to.equal(2);
    for (const bad of [-20, Number.NaN, Number.POSITIVE_INFINITY]) {
      el.offset = bad;
      await el.updateComplete;
      expect(el.offset).to.equal(undefined);
      expect(el.page).to.equal(2);
    }
    el.setAttribute('offset', '');
    await el.updateComplete;
    expect(el.offset).to.equal(undefined);
    el.pageSize = 0;
    el.offset = 40;
    await el.updateComplete;
    expect(el.page).to.equal(2);
  });

  it('keeps a page written on its own when only pageSize changes afterwards', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="200" page-size="20" offset="0"></lr-pagination>`);
    el.page = 4;
    await el.updateComplete;
    el.pageSize = 25;
    await el.updateComplete;
    expect(el.page, 'the stale offset no longer drives the page').to.equal(4);
    el.offset = 100;
    await el.updateComplete;
    expect(el.page).to.equal(5);
  });

  it('leaves page alone while offset is unset', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="200" page-size="20" page="4"></lr-pagination>`);
    el.pageSize = 50;
    await el.updateComplete;
    expect(el.offset).to.equal(undefined);
    expect(el.page).to.equal(4);
  });
});
