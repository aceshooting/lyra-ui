import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-page-rail.js';
import type { LyraPageRail } from '../../lr-page-rail.js';
import type { LyraVirtualList } from '../../lr-virtual-list.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

function key(el: LyraPageRail, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init });
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(event);
  return event;
}

function rows(el: LyraPageRail): HTMLElement[] {
  const list = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  return [...list.shadowRoot!.querySelectorAll<HTMLElement>('[part~="page"]')];
}

describe('lr-page-rail remediation', () => {
  it('restarts the digit buffer when the typed prefix cannot be a page', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="5"></lr-page-rail>`);
    key(el, { key: '1' });
    expect(el.page).to.equal(1);
    key(el, { key: '2' });
    expect(el.page).to.equal(2);
  });

  it('ignores digits typed during IME composition', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="5"></lr-page-rail>`);
    key(el, { key: '3', isComposing: true });
    expect(el.page).to.equal(1);
  });

  it('announces a type-ahead jump in mediated mode with lr-page-select', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="12"></lr-page-rail>`);
    const selected = oneEvent(el, 'lr-page-select');
    key(el, { key: '7' });
    expect((await selected).detail).to.deep.equal({ page: 7 });
    expect(el.page).to.equal(7);
  });

  it('names the rail with the default for a whitespace-only label', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="3" label="   "></lr-page-rail>`);
    const label = el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label');
    expect(label).to.equal('Page thumbnails');
  });

  it('draws page buttons in the host font instead of the UA control font', async () => {
    const el = await fixture<LyraPageRail>(html`
      <lr-page-rail page-count="3" style="--lr-font: Georgia, serif"></lr-page-rail>
    `);
    await waitUntil(() => rows(el).length > 0);
    expect(getComputedStyle(rows(el)[0]!).fontFamily).to.equal(getComputedStyle(el).fontFamily);
  });

  it('keeps the current page distinguishable under forced colors', async () => {
    let active = false;
    try {
      await setForcedColors('active');
      active = matchMedia('(forced-colors: active)').matches;
    } catch {
      active = false;
    }
    try {
      if (!active) return;
      const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="3" page="2"></lr-page-rail>`);
      await waitUntil(() => rows(el).length > 1);
      const [first, second] = rows(el);
      expect(getComputedStyle(second!).backgroundColor).to.not.equal(getComputedStyle(first!).backgroundColor);
    } finally {
      await setForcedColors('none');
    }
  });
});
