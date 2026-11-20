import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, hitId, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-date-input.js';

const NO_MOTION = '--lr-transition-fast: 0ms';
type Field = HTMLElement & { open: boolean; topLayer: boolean; updateComplete: Promise<boolean> };

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-date-input data-lr-theme-scope style=${NO_MOTION}
    ?top-layer=${topLayer} label="Date" value="2026-05-14"></lr-date-input>`);
  const el = wrapper.querySelector('lr-date-input') as Field;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => el.open && popup.getBoundingClientRect().height > 0 && popup.style.left !== ''
    && popup.hasAttribute('data-positioned'), 'the popup is placed');
  return { el, sibling, popup };
}

describe('top-layer on lr-date-input', () => {
  it('defaults off, beneath a higher sibling', async () => {
    const { el, sibling, popup } = await mount(false);
    expect(el.topLayer).to.equal(false);
    expect(el.hasAttribute('top-layer')).to.equal(false);
    const [x, y] = pointOverSibling(popup, sibling);
    expect(popup.matches(':popover-open')).to.equal(false);
    expect(hitId(x, y)).to.equal('sibling');
    el.open = false;
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, popup } = await mount(true);
    await waitUntil(() => popup.matches(':popover-open'), 'the popup is promoted');
    const [x, y] = pointOverSibling(popup, sibling);
    await waitUntil(() => hitBelongsTo(el, x, y), 'the popup wins the hit test over the sibling');
    el.topLayer = false;
    await waitUntil(() => !popup.matches(':popover-open'), 'turning it off releases the top layer');
    expect(el.open).to.equal(true);
    expect(el.hasAttribute('top-layer')).to.equal(false);
    el.open = false;
  });
});
