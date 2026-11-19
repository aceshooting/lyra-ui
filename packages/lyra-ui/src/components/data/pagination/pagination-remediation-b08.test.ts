import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './pagination.js';
import type { LyraPagination } from './pagination.js';

describe('pagination request revalidation and page field width', () => {
  it('drops the page change when a before-page-change listener disabled the control', async () => {
    const el = (await fixture(html`<lr-pagination format="compact" total="100" page-size="10" page="1"></lr-pagination>`)) as LyraPagination;
    let changes = 0;
    el.addEventListener('lr-page-change', () => { changes += 1; });
    el.addEventListener('lr-before-page-change', () => { el.disabled = true; });
    const next = el.shadowRoot!.querySelector<HTMLElement>('[part~="next-button"]')!;
    next.click();
    expect(changes).to.equal(0);
  });

  it('widens the compact page field so a four-digit page is not clipped', async () => {
    const el = (await fixture(html`<lr-pagination format="compact" total="123450" page-size="10" page="12345"></lr-pagination>`)) as LyraPagination;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
    expect(input.scrollWidth).to.be.at.most(input.clientWidth);
  });

  it('leaves modified, composing and repeated Enter in the page field uncommitted', async () => {
    const el = (await fixture(html`<lr-pagination format="compact" total="100" page-size="10" page="1"></lr-pagination>`)) as LyraPagination;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
    let changes = 0;
    el.addEventListener('lr-page-change', () => { changes += 1; });
    input.value = '3';
    const init = { key: 'Enter', bubbles: true, composed: true, cancelable: true };
    const held = [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { repeat: true }];
    for (const mod of held) {
      const ev = new KeyboardEvent('keydown', { ...init, ...mod });
      input.dispatchEvent(ev);
      expect(ev.defaultPrevented).to.equal(false);
    }
    expect(changes).to.equal(0);
    const plain = new KeyboardEvent('keydown', init);
    input.dispatchEvent(plain);
    expect(plain.defaultPrevented).to.equal(true);
  });

  it('marks the applied page with a system highlight under forced colors', async () => {
    const el = (await fixture(html`<lr-pagination total="100" page-size="10" page="2"></lr-pagination>`)) as LyraPagination;
    try {
      await setForcedColors('active');
    } catch {
      return;
    }
    try {
      if (!matchMedia('(forced-colors: active)').matches) return;
      const current = el.shadowRoot!.querySelector<HTMLElement>('[part~="page-current"]')!;
      const other = el.shadowRoot!.querySelector<HTMLElement>('[part~="page"]:not([part~="page-current"])')!;
      expect(getComputedStyle(current).backgroundColor).to.not.equal(getComputedStyle(other).backgroundColor);
    } finally {
      await setForcedColors('none');
    }
  });
});

it('discards a request when its target disappears during the proposal', async () => {
  const pager = await fixture<LyraPagination>(html`<lr-pagination total="30" page-size="10"></lr-pagination>`);
  const events: string[] = [];
  pager.addEventListener('lr-before-page-change', () => { pager.total = 5; });
  for (const type of ['lr-page-change', 'lr-activate']) pager.addEventListener(type, () => events.push(type));
  pager.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!.click();
  expect(events).to.deep.equal([]);
});

it('localizes whitespace-only navigation and compact editor labels', async () => {
  const pager = await fixture<LyraPagination>(html`<lr-pagination format="compact" total="20" label="  " previous-label=" "
    next-label=" " page-label=" " .strings=${{ paginationLabel: 'Page controls', previous: 'Back', next: 'Forward', paginationPage: 'Page number' }}>
    </lr-pagination>`);
  for (const [part, label] of [['base', 'Page controls'], ['previous-button', 'Back'], ['next-button', 'Forward'], ['page-input', 'Page number']]) {
    expect(pager.shadowRoot!.querySelector(`[part~="${part}"]`)!.getAttribute('aria-label')).to.equal(label);
  }
});

it('keeps link semantics on unavailable and current page anchors', async () => {
  const pager = await fixture<LyraPagination>(html`<lr-pagination total="200" with-edges href-template="/pages/{page}"></lr-pagination>`);
  for (const node of pager.shadowRoot!.querySelectorAll('a:not([href])')) expect(node.getAttribute('role')).to.equal('link');
  pager.disabled = true;
  await pager.updateComplete;
  const links = [...pager.shadowRoot!.querySelectorAll('a:not([href])')];
  expect(links.length).to.be.greaterThan(5);
  expect(links.every(link => link.getAttribute('role') === 'link')).to.equal(true);
});
