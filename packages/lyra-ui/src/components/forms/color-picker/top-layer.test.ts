import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, hitId, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-color-picker.js';
import type { LyraColorPicker } from '../../lr-color-picker.js';

const NO_MOTION = '--lr-transition-fast: 0ms';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-color-picker data-lr-theme-scope style=${NO_MOTION}
    ?top-layer=${topLayer} label="Accent" value="#336699"></lr-color-picker>`);
  const el = wrapper.querySelector<LyraColorPicker>('lr-color-picker')!;
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
  await waitUntil(() => el.open && panel.getBoundingClientRect().height > 0 && panel.style.left !== '', 'the panel is placed');
  return { el, sibling, panel };
}

describe('top-layer on lr-color-picker', () => {
  it('defaults off, beneath a higher sibling', async () => {
    const { el, sibling, panel } = await mount(false);
    expect(el.topLayer).to.equal(false);
    const [x, y] = pointOverSibling(panel, sibling);
    expect(panel.matches(':popover-open')).to.equal(false);
    expect(hitId(x, y)).to.equal('sibling');
    el.open = false;
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, panel } = await mount(true);
    expect(el.hasAttribute('top-layer')).to.equal(true);
    await waitUntil(() => panel.matches(':popover-open'), 'the panel is promoted');
    const [x, y] = pointOverSibling(panel, sibling);
    expect(hitBelongsTo(el, x, y), 'the panel wins the hit test over the sibling').to.equal(true);
    el.topLayer = false;
    await waitUntil(() => !panel.matches(':popover-open'), 'turning it off releases the top layer');
    expect(el.open).to.equal(true);
    el.open = false;
  });
});
