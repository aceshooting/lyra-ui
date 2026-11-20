import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-mention-popover.js';
import type { LyraMentionItem, LyraMentionPopover } from '../../lr-mention-popover.js';

const NO_MOTION = '--lr-transition-fast: 0ms';
const ITEMS: LyraMentionItem[] = [
  { suggestionId: 'alice', label: 'Alice Johansson', description: 'Product design' },
  { suggestionId: 'bob', label: 'Bob Nakamura' },
  { suggestionId: 'carol', label: 'Carol Ibarra', description: 'Engineering' },
];

function listbox(el: LyraMentionPopover): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
}

async function openPlaced(el: LyraMentionPopover, anchor: HTMLElement): Promise<HTMLElement> {
  el.anchor = anchor;
  el.items = ITEMS;
  el.open = true;
  await el.updateComplete;
  const popup = listbox(el);
  await waitUntil(
    () => getComputedStyle(popup).visibility === 'visible' && popup.style.left !== '',
    'the listbox is placed',
  );
  return popup;
}

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<div>
    <span id="anchor">Message</span>
    <lr-mention-popover data-lr-theme-scope style=${NO_MOTION} ?top-layer=${topLayer}></lr-mention-popover>
  </div>`);
  const el = wrapper.querySelector('lr-mention-popover') as LyraMentionPopover;
  await el.updateComplete;
  const popup = await openPlaced(el, wrapper.querySelector<HTMLElement>('#anchor')!);
  return { el, sibling, popup };
}

describe('top-layer on lr-mention-popover', () => {
  it('defaults off, beneath a higher sibling', async () => {
    const { el, sibling, popup } = await mount(false);
    expect(el.topLayer).to.equal(false);
    const [x, y] = pointOverSibling(popup, sibling);
    expect(popup.matches(':popover-open')).to.equal(false);
    expect(hitBelongsTo(el, x, y)).to.equal(false);
    el.open = false;
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, popup } = await mount(true);
    expect(el.getAttribute('top-layer')).to.equal('');
    await waitUntil(() => popup.matches(':popover-open'), 'the listbox is promoted');
    const [x, y] = pointOverSibling(popup, sibling);
    expect(hitBelongsTo(el, x, y), 'the listbox wins the hit test over the sibling').to.equal(true);
    el.topLayer = false;
    await waitUntil(() => !popup.matches(':popover-open'), 'turning it off releases the top layer');
    expect(el.open).to.equal(true);
    el.open = false;
  });

  it('stacks the listbox at an enclosing overlay\'s leased stack index', async () => {
    const host = await fixture<HTMLElement>(html`<div style="--lr-overlay-stack-index: 1234">
      <span id="anchor">Message</span><lr-mention-popover style=${NO_MOTION}></lr-mention-popover>
    </div>`);
    const el = host.querySelector('lr-mention-popover') as LyraMentionPopover;
    const popup = await openPlaced(el, host.querySelector<HTMLElement>('#anchor')!);
    expect(getComputedStyle(popup).zIndex).to.equal('1234');
    el.open = false;
  });
});
