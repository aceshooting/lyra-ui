import { expect, html, waitUntil } from '@open-wc/testing';
import {
  headerFixture,
  hitBelongsTo,
  hitId,
  pointOverSibling,
} from '../../../../test/top-layer-header.js';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.js';

const NO_MOTION = '--lr-transition-fast: 0ms';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-locale-picker
    data-lr-theme-scope style=${NO_MOTION}
    ?top-layer=${topLayer}
    value="en"
    without-flags
    .locales=${['en', 'fr', 'de']}
  ></lr-locale-picker>`);
  const el = wrapper.querySelector('lr-locale-picker') as LyraLocalePicker;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  return { el, sibling, listbox };
}

async function openPlaced(el: LyraLocalePicker, listbox: HTMLElement): Promise<void> {
  el.open = true;
  await el.updateComplete;
  await waitUntil(
    () => el.open && listbox.getBoundingClientRect().height > 0 && listbox.style.left !== '',
    'the listbox is placed',
  );
}

describe('top-layer on lr-locale-picker', () => {
  it('defaults off: the listbox stays beneath a higher sibling', async () => {
    const { el, sibling, listbox } = await mount(false);
    expect(el.topLayer).to.equal(false);
    expect(el.hasAttribute('top-layer')).to.equal(false);
    await openPlaced(el, listbox);
    const [x, y] = pointOverSibling(listbox, sibling);
    expect(listbox.matches(':popover-open')).to.equal(false);
    expect(hitId(x, y)).to.equal('sibling');
    el.open = false;
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, listbox } = await mount(true);
    expect(el.topLayer).to.equal(true);
    await openPlaced(el, listbox);
    await waitUntil(() => listbox.matches(':popover-open'), 'the listbox is promoted');
    const [x, y] = pointOverSibling(listbox, sibling);
    expect(hitBelongsTo(el, x, y), 'the listbox wins the hit test over the sibling').to.equal(true);

    el.topLayer = false;
    await waitUntil(
      () => !listbox.matches(':popover-open'),
      'turning it off releases the top layer',
    );
    await waitUntil(() => listbox.getBoundingClientRect().height > 0, 'still open and placed');
    expect(el.open).to.equal(true);
    const [x2, y2] = pointOverSibling(listbox, sibling);
    expect(hitId(x2, y2)).to.equal('sibling');
    el.open = false;
  });
});
