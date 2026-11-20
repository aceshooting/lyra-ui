import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../internal/announcer.js';
import '../lr-country-picker.js';

describe('catalog picker filter loading', () => {
  for (const cancel of ['disable search', 'disconnect']) {
    it(`ignores a rejected load after ${cancel}`, async () => {
      const picker = await fixture<HTMLElementTagNameMap['lr-country-picker']>(html`<lr-country-picker></lr-country-picker>`);
      let rejectLoad: (() => void) | undefined;
      Object.assign(picker, {
        loadCombobox: () => new Promise<void>((_resolve, reject) => {
          rejectLoad = () => reject(new Error('Unavailable module'));
        }),
      });
      let errors = 0;
      picker.addEventListener('lr-load-error', () => errors++);
      picker.searchable = true;
      await waitUntil(() => rejectLoad !== undefined);
      if (cancel === 'disconnect') picker.remove();
      else picker.searchable = false;
      rejectLoad!();
      await picker.updateComplete;
      expect(errors).to.equal(0);
      expect(picker.shadowRoot!.querySelectorAll('[part="search-error"]').length).to.equal(0);
    });
  }

  it('reports a failed filter load once and lets the user retry without losing the selection', async () => {
    const picker = await fixture<HTMLElementTagNameMap['lr-country-picker']>(html`<lr-country-picker value="LU"
      .countries=${['LU', 'FR']} lang="en"></lr-country-picker>`);
    let loads = 0;
    Object.assign(picker, {
      loadCombobox: async () => {
        if (++loads === 1) throw new Error('Unavailable module');
        await import('./combobox/combobox-catalog.js');
      },
    });
    let errors = 0;
    picker.addEventListener('lr-load-error', () => errors++);
    picker.searchable = true;
    await picker.updateComplete;
    const notice = picker.shadowRoot!.querySelector<HTMLElement>('[part="search-error"]');
    expect(notice?.textContent ?? '').to.include('Could not load the search field.');
    expect(notice!.getClientRects().length).to.be.greaterThan(0);
    const probe = document.createElement('span');
    probe.style.color = 'var(--lr-color-danger)';
    document.body.append(probe);
    expect(getComputedStyle(notice!).color).to.equal(getComputedStyle(probe).color);
    probe.remove();
    await waitUntil(() => document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)?.textContent?.includes('Could not load the search field.'));
    expect(errors).to.equal(1);
    expect(picker.value).to.equal('LU');
    expect(picker.input === null).to.equal(true);
    const child = picker.shadowRoot!.querySelector('lr-select')!;
    await child.show();
    child.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="FR"]')!.click();
    expect(picker.value).to.equal('FR');
    picker.strings = { catalogPickerSearchLoadFailed: 'Search unavailable', retry: 'Try the filter again' };
    await picker.updateComplete;
    expect(notice!.textContent?.trim()).to.equal('Search unavailable');
    expect(loads).to.equal(1);
    expect(errors).to.equal(1);
    const retry = picker.shadowRoot!.querySelector<HTMLButtonElement>('[part="search-retry"]')!;
    expect(retry.textContent?.trim()).to.equal('Try the filter again');
    picker.disabled = true;
    await picker.updateComplete;
    expect(retry.disabled).to.equal(true);
    retry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(loads).to.equal(1);
    picker.disabled = false;
    await picker.updateComplete;
    const concurrent = await fixture<HTMLElementTagNameMap['lr-country-picker']>(html`<lr-country-picker></lr-country-picker>`);
    let rejectConcurrent: (() => void) | undefined;
    Object.assign(concurrent, {
      loadCombobox: () => new Promise<void>((_resolve, reject) => {
        rejectConcurrent = () => reject(new Error('Unavailable module'));
      }),
    });
    let concurrentErrors = 0;
    concurrent.addEventListener('lr-load-error', () => concurrentErrors++);
    concurrent.searchable = true;
    await waitUntil(() => rejectConcurrent !== undefined);
    retry.click();
    await picker.updateComplete;
    await waitUntil(() => picker.input !== null);
    expect(loads).to.equal(2);
    expect(picker.shadowRoot!.querySelectorAll('[part="search-error"]').length).to.equal(0);
    expect(picker.value).to.equal('FR');
    rejectConcurrent!();
    await concurrent.updateComplete;
    const filter = concurrent.shadowRoot!.querySelector('lr-combobox');
    expect(filter !== null).to.equal(true);
    await filter!.updateComplete;
    expect(concurrent.input !== null).to.equal(true);
    expect(concurrentErrors).to.equal(0);
  });
});
