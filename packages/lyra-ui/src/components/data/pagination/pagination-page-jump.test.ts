import { expect, fixture, html } from '@open-wc/testing';
import './pagination.js';
import type { LyraPagination } from './pagination.js';

function pageInput(el: LyraPagination): HTMLInputElement {
  return el.shadowRoot!.querySelector<HTMLInputElement>('[part~="page-input"]')!;
}

function recordRequests(el: LyraPagination): string[] {
  const seen: string[] = [];
  for (const name of ['lr-before-page-change', 'lr-page-change', 'lr-activate']) el.addEventListener(name, () => seen.push(name));
  return seen;
}

describe('lr-pagination page-jump field', () => {
  it('commits only on Enter and leaves other keys to the native field', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination format="compact" total="95" page-size="10"></lr-pagination>`);
    const requests = recordRequests(el);
    const input = pageInput(el);
    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true, cancelable: true });
    input.dispatchEvent(tab);
    await el.updateComplete;
    expect(tab.defaultPrevented).to.equal(false);
    expect(requests).to.deep.equal([]);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true });
    input.dispatchEvent(enter);
    await el.updateComplete;
    expect(enter.defaultPrevented).to.equal(true);
    expect(requests).to.deep.equal(['lr-before-page-change', 'lr-page-change', 'lr-activate']);
  });

  it('marks an emptied draft invalid only once it is committed', async () => {
    const el = await fixture<LyraPagination>(html`<lr-pagination format="compact" total="95" page-size="10"></lr-pagination>`);
    const requests = recordRequests(el);
    const input = pageInput(el);
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    // Clearing the field mid-edit is not yet an error...
    expect(input.getAttribute('aria-invalid')).to.equal('false');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    // ...but committing a blank page is.
    expect(requests).to.deep.equal([]);
    expect(input.getAttribute('aria-invalid')).to.equal('true');
    expect(el.page).to.equal(1);
  });
});
