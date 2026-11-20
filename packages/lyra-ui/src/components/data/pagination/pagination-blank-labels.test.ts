import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-pagination.js';
import type { LyraPagination } from '../../lr-pagination.js';

describe('<lr-pagination> blank control labels', () => {
  for (const blank of ['', '   ']) {
    it(`treats ${JSON.stringify(blank)} control labels as unset so every control keeps a name`, async () => {
      const el = await fixture<LyraPagination>(html`<lr-pagination
        .total=${100}
        .page=${3}
        with-edges
        .previousLabel=${blank}
        .nextLabel=${blank}
        .firstLabel=${blank}
        .lastLabel=${blank}
      ></lr-pagination>`);
      const names = (part: string) => el.shadowRoot!.querySelector(`[part~="${part}"]`)!.getAttribute('aria-label');
      expect(names('previous-button')).to.equal('Previous');
      expect(names('next-button')).to.equal('Next');
      expect(names('first-button')).to.not.equal('');
      expect(names('first-button')).to.not.equal(null);
      expect(names('last-button')).to.not.equal('');
    });

    it(`treats ${JSON.stringify(blank)} page-label as unset on the page-jump input`, async () => {
      const el = await fixture<LyraPagination>(html`<lr-pagination
        .total=${100}
        .page=${3}
        format="compact"
        .pageLabel=${blank}
      ></lr-pagination>`);
      expect(el.shadowRoot!.querySelector('[part="page-input"]')!.getAttribute('aria-label')).to.equal('Page');
    });
  }

  it('still allows an empty navigation landmark label', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination .total=${100} .page=${3} label=""></lr-pagination>`);
    expect(el.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).to.equal('');
  });
});
