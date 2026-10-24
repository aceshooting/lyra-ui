import { expect, fixture, html } from '@open-wc/testing';
import './pagination.js';
import type { LyraPagination } from './pagination.js';

function pageLabels(el: LyraPagination): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="page"]')].map((node) => node.textContent!.trim());
}

function ellipses(el: LyraPagination): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="ellipsis"]')];
}

describe('lr-pagination page window boundaries', () => {
  it('pins no page at either end when boundary-count is zero', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="200" page-size="10" page="10"
      sibling-count="1" boundary-count="0"></lr-pagination>`);
    expect(pageLabels(el)).to.deep.equal(['9', '10', '11']);
    expect(ellipses(el).length).to.equal(2);
  });

  it('keeps the window full when the current page is one of the last', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination total="500" page-size="10" page="50"></lr-pagination>`);
    expect(pageLabels(el)).to.deep.equal(['1', '44', '45', '46', '47', '48', '49', '50']);
    expect(ellipses(el).length).to.equal(1);
    el.page = 1;
    await el.updateComplete;
    expect(pageLabels(el)).to.deep.equal(['1', '2', '3', '4', '5', '6', '7', '50']);
    expect(ellipses(el).length).to.equal(1);
  });

  it('renders skipped-run controls without a destination while link mode is disabled', async () => {
    const template = (disabled: boolean) => html`<lr-pagination total="500" page-size="10" page="25"
      href-template="/results?page={page}" ?disabled=${disabled}></lr-pagination>`;
    const enabled = await fixture<LyraPagination>(template(false));
    expect(ellipses(enabled).map((node) => node.localName)).to.deep.equal(['a', 'a']);
    expect(ellipses(enabled).every((node) => node.hasAttribute('href'))).to.equal(true);
    expect(ellipses(enabled).map((node) => node.getAttribute('aria-disabled'))).to.deep.equal(['false', 'false']);
    const disabled = await fixture<LyraPagination>(template(true));
    expect(ellipses(disabled).map((node) => node.localName)).to.deep.equal(['a', 'a']);
    expect(ellipses(disabled).some((node) => node.hasAttribute('href'))).to.equal(false);
    expect(ellipses(disabled).map((node) => node.getAttribute('aria-disabled'))).to.deep.equal(['true', 'true']);
  });

  it('ignores a page jump committed while the control is disabled', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination format="compact" total="95" page-size="10" disabled></lr-pagination>`);
    const requests: string[] = [];
    for (const name of ['lr-before-page-change', 'lr-page-change', 'lr-activate']) el.addEventListener(name, () => requests.push(name));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
    input.value = '3';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(requests).to.deep.equal([]);
    expect(el.page).to.equal(1);
  });
});
