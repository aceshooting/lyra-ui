import { html, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect, oneEvent } from '@open-wc/testing';

interface PaginationHost extends HTMLElement {
  page: number;
  total: number;
  updateComplete: Promise<boolean>;
}

describe('hydrated data', () => {
  it('lr-pagination applies a property-bound total, keeps the server page and advances after hydration', async () => {
    const pagination = await ssrFixture<PaginationHost>(html`<lr-pagination page="3" page-size="10" .total=${95}></lr-pagination>`);
    expect(pagination.total).to.equal(95);
    expect(pagination.page).to.equal(3);
    const current = pagination.shadowRoot!.querySelector('[part~="page-current"]')!;
    expect(current.textContent!.trim()).to.equal('3');
    // Controlled: the hydrated control requests the next page, and the consumer applies it.
    const changed = oneEvent(pagination, 'lr-page-change');
    pagination.shadowRoot!.querySelector<HTMLElement>('[part~="next-button"]')!.click();
    const event = (await changed) as CustomEvent<{ page: number; pageSize: number; offset: number }>;
    expect(event.detail).to.deep.equal({ page: 4, pageSize: 10, offset: 30 });
    pagination.page = event.detail.page;
    await pagination.updateComplete;
    expect(pagination.page).to.equal(4);
    expect(pagination.shadowRoot!.querySelector('[part~="page-current"]')!.textContent!.trim()).to.equal('4');
  });

  it('lr-timeline hydrates nested lr-timeline-item hosts without replacing their server trees', async () => {
    const timeline = await ssrFixture(html`<lr-timeline>
      <lr-timeline-item>Order placed</lr-timeline-item>
      <lr-timeline-item>Shipped</lr-timeline-item>
    </lr-timeline>`);
    const base = timeline.shadowRoot!.querySelector('[part~="base"]')!;
    expect(base.getAttribute('role')).to.equal('list');
    expect(timeline.querySelectorAll('lr-timeline-item')).to.have.length(2);
  });
});
