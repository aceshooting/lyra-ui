import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sinkTexts } from '../../../../test/announcements.js';
import '../../lr-pagination.js';
import type { LyraPagination, LyraPaginationChangeDetail } from '../../lr-pagination.js';

function sizeSelect(el: LyraPagination): HTMLSelectElement | null {
  return el.shadowRoot!.querySelector<HTMLSelectElement>('[part~="page-size"]');
}

function optionValues(el: LyraPagination): string[] {
  return [...(sizeSelect(el)?.options ?? [])].map((option) => option.value);
}

function choose(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('lr-pagination page-size selector', () => {
  it('renders no selector while pageSizeOptions is unset or empty', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="95" page-size="10"></lr-pagination>`);
    expect([...el.pageSizeOptions]).to.deep.equal([]);
    expect(sizeSelect(el) === null).to.equal(true);
    el.pageSizeOptions = [Number.NaN, -5, 0, 2.5];
    await el.updateComplete;
    expect(sizeSelect(el) === null).to.equal(true);
  });

  it('lists normalized ascending options that always include the applied size', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination
      total="95"
      page-size="15"
      .pageSizeOptions=${[50, 10, 25, 10, 0, -1, 2.5, Number.POSITIVE_INFINITY]}
    ></lr-pagination>`);
    expect(optionValues(el)).to.deep.equal(['10', '15', '25', '50']);
    expect(sizeSelect(el)!.value).to.equal('15');
    expect(sizeSelect(el)!.getAttribute('aria-label')).to.equal('Items per page');
    expect([...sizeSelect(el)!.options].map((option) => option.textContent?.trim())).to.deep.equal([
      '10 per page', '15 per page', '25 per page', '50 per page',
    ]);
  });

  it('renders in the compact format and in indeterminate mode', async () => {
    const compact = await fixture<LyraPagination>(html`<lr-pagination format="compact" total="95" .pageSizeOptions=${[10, 20]}></lr-pagination>`);
    expect(optionValues(compact)).to.deep.equal(['10', '20']);
    const open = await fixture<LyraPagination>(html`<lr-pagination total="-1" page="3" .pageSizeOptions=${[10, 20]}></lr-pagination>`);
    expect(optionValues(open)).to.deep.equal(['10', '20']);
    const request = oneEvent(open, 'lr-page-size-change');
    choose(sizeSelect(open)!, '20');
    const { detail } = (await request) as CustomEvent<LyraPaginationChangeDetail>;
    // No total to clamp against: page 3 at 10 begins at item 21, which is page 2 at 20.
    expect({ ...detail }).to.deep.equal({ page: 2, pageSize: 20 });
  });

  it('ignores a change to the applied size or while disabled, and restores the display', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="95" page="2" .pageSizeOptions=${[10, 25]}></lr-pagination>`);
    const seen: string[] = [];
    el.addEventListener('lr-before-page-size-change', () => seen.push('before'));
    choose(sizeSelect(el)!, '10');
    sizeSelect(el)!.value = 'not-a-size';
    sizeSelect(el)!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(sizeSelect(el)!.value).to.equal('10');
    el.disabled = true;
    await el.updateComplete;
    choose(sizeSelect(el)!, '25');
    expect(sizeSelect(el)!.value).to.equal('10');
    expect(seen).to.deep.equal([]);
  });

  it('keeps page, pageSize and the displayed size when the request is vetoed', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="95" page="4" .pageSizeOptions=${[10, 25]}></lr-pagination>`);
    const seen: string[] = [];
    el.addEventListener('lr-page-size-change', () => seen.push('change'));
    el.addEventListener('lr-page-change', () => seen.push('page'));
    const before = oneEvent(el, 'lr-before-page-size-change');
    el.addEventListener('lr-before-page-size-change', (event) => event.preventDefault(), { once: true });
    choose(sizeSelect(el)!, '25');
    const proposal = (await before) as CustomEvent<LyraPaginationChangeDetail>;
    expect(proposal.cancelable).to.equal(true);
    expect({ ...proposal.detail }).to.deep.equal({ page: 2, pageSize: 25 });
    await el.updateComplete;
    expect(seen).to.deep.equal([]);
    expect([el.page, el.pageSize]).to.deep.equal([4, 10]);
    expect(sizeSelect(el)!.value).to.equal('10');
  });

  it('emits both events with the remapped page, stays controlled, and announces the applied size', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="95" page="10" .pageSizeOptions=${[10, 50]}></lr-pagination>`);
    const order: string[] = [];
    el.addEventListener('lr-before-page-size-change', () => order.push('before'));
    el.addEventListener('lr-page-size-change', () => order.push('change'));
    const accepted = oneEvent(el, 'lr-page-size-change');
    choose(sizeSelect(el)!, '50');
    const { detail } = (await accepted) as CustomEvent<LyraPaginationChangeDetail>;
    // Page 10 at 10 begins at item 91; at 50 per page that is page 2 of 2.
    expect({ ...detail }).to.deep.equal({ page: 2, pageSize: 50 });
    expect(order).to.deep.equal(['before', 'change']);
    await el.updateComplete;
    // Controlled: nothing applied yet, so the selector shows the size still in effect.
    expect([el.page, el.pageSize, sizeSelect(el)!.value]).to.deep.equal([10, 10, '10']);

    const announced = sinkTexts('polite').length;
    el.pageSize = detail.pageSize;
    el.page = detail.page;
    await el.updateComplete;
    expect(sizeSelect(el)!.value).to.equal('50');
    expect(sinkTexts('polite').slice(announced)).to.deep.equal(['50 per page', 'Page 2 of 2']);
  });

  it('honors page-size-label and a .strings override', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination
      total="95"
      page-size-label="Results shown"
      .strings=${{ paginationPageSizeOption: '{count} / page' }}
      .pageSizeOptions=${[10]}
    ></lr-pagination>`);
    expect(sizeSelect(el)!.getAttribute('aria-label')).to.equal('Results shown');
    expect(sizeSelect(el)!.options[0]!.textContent?.trim()).to.equal('10 / page');
    el.pageSizeLabel = undefined;
    el.strings = { paginationPageSize: 'Rows shown' };
    await el.updateComplete;
    expect(sizeSelect(el)!.getAttribute('aria-label')).to.equal('Rows shown');
  });

  it('renders under dir="rtl" and passes axe with the selector shown', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination dir="rtl" with-summary total="95" .pageSizeOptions=${[10, 20]}></lr-pagination>`);
    const select = sizeSelect(el)!;
    const next = el.shadowRoot!.querySelector('[part~="next-button"]')!;
    // Logical placement: the selector follows the next control, so under RTL it sits to its left.
    expect(select.getBoundingClientRect().right <= next.getBoundingClientRect().left + 1).to.equal(true);
    await expect(el).to.be.accessible();
  });
});
