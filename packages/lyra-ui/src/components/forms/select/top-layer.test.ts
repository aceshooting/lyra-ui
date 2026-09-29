import { expect, html, waitUntil } from '@open-wc/testing';
import {
  headerFixture,
  hitBelongsTo,
  hitId,
  pointOverSibling,
} from '../../../../test/top-layer-header.js';
import './select.js';
import type { LyraSelect } from './select.js';

const NO_MOTION = '--lr-transition-fast: 0ms';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-select
    style=${NO_MOTION}
    ?top-layer=${topLayer}
    label="Fruit"
  >
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>`);
  const el = wrapper.querySelector('lr-select') as LyraSelect;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  return { el, sibling, listbox };
}

async function openPlaced(el: LyraSelect, listbox: HTMLElement): Promise<void> {
  await el.show();
  await waitUntil(
    () => el.open && listbox.getBoundingClientRect().height > 0 && listbox.style.left !== '',
    'the listbox is placed',
  );
}

describe('top-layer on lr-select', () => {
  it('defaults off: the listbox stays beneath a higher sibling', async () => {
    const { el, sibling, listbox } = await mount(false);
    expect(el.topLayer).to.equal(false);
    expect(el.hasAttribute('top-layer')).to.equal(false);
    await openPlaced(el, listbox);
    const [x, y] = pointOverSibling(listbox, sibling);
    expect(listbox.matches(':popover-open')).to.equal(false);
    expect(hitId(x, y)).to.equal('sibling');
    await el.hide();
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, listbox } = await mount(true);
    expect(el.topLayer).to.equal(true);
    await openPlaced(el, listbox);
    await waitUntil(() => listbox.matches(':popover-open'), 'the listbox is promoted');
    expect(getComputedStyle(listbox).position).to.equal('fixed');
    const [x, y] = pointOverSibling(listbox, sibling);
    expect(hitBelongsTo(el, x, y), 'the listbox wins the hit test over the sibling').to.equal(true);
    const triggerRect = el.shadowRoot!.querySelector('[part="trigger"]')!.getBoundingClientRect();
    expect(listbox.getBoundingClientRect().top).to.be.closeTo(triggerRect.bottom, 12);

    el.topLayer = false;
    await waitUntil(
      () => !listbox.matches(':popover-open'),
      'turning it off releases the top layer',
    );
    await waitUntil(() => listbox.getBoundingClientRect().height > 0, 'still open and placed');
    expect(el.open).to.equal(true);
    const [x2, y2] = pointOverSibling(listbox, sibling);
    expect(hitId(x2, y2)).to.equal('sibling');
    await el.hide();
  });
});
