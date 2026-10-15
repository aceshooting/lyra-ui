import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { place } from './positioner.js';

it('aligns a fixed popup with its anchor inside a filtered inline containing block', async () => {
  const host = await fixture<HTMLElement>(html`
    <div style="margin: 90px; padding: 24px;">
      <span style="display: inline; filter: blur(0px);">
        <button id="anchor" style="inline-size: 120px; block-size: 32px">Open</button>
        <div id="popup" style="inline-size: 180px; block-size: 72px">Options</div>
      </span>
    </div>
  `);
  const anchor = host.querySelector<HTMLElement>('#anchor')!;
  const popup = host.querySelector<HTMLElement>('#popup')!;
  const containingBlock = anchor.parentElement!;
  const childCount = containingBlock.childNodes.length;
  let placed = false;
  const stop = place(anchor, popup, {
    placement: 'bottom-start',
    strategy: 'fixed',
    offset: 0,
    flip: false,
    shift: false,
    onPlaced: () => { placed = true; },
  });

  try {
    await waitUntil(() => placed, 'The fixed popup receives its placement');
    const anchorRect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    expect(popupRect.left, 'The inline containing block does not offset the popup twice').to.be.closeTo(anchorRect.left, 1.5);
    expect(popupRect.top, 'The popup starts below its anchor').to.be.closeTo(anchorRect.bottom, 1.5);
    expect(containingBlock.childNodes.length, 'Position measurement leaves the inline content intact').to.equal(childCount);
  } finally {
    stop();
  }
});
