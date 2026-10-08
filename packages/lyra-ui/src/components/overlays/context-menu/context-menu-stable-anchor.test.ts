import { expect, fixture, html, nextFrame, oneEvent, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './context-menu.js';
import '../../layout/menu/menu-item.js';
import type { LyraContextMenu } from './context-menu.class.js';

it('keeps a context menu open when viewport scrolling leaves its fixed anchor in place', async () => {
  const oldScroll = { x: window.scrollX, y: window.scrollY };
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="height:2400px">
      <lr-context-menu style="--show-duration:0ms;--hide-duration:0ms">
        <button slot="trigger" style="position:fixed;left:20px;top:20px">Region actions</button>
        <lr-menu-item>Inspect</lr-menu-item>
      </lr-context-menu>
    </div>
  `);
  const el = wrapper.querySelector<LyraContextMenu>('lr-context-menu')!;
  const anchor = el.querySelector<HTMLButtonElement>('button')!;
  try {
    await focusByKeyboard(anchor);
    const shown = oneEvent(el, 'lr-after-show');
    el.showAt({ x: 50, y: 50, contextElement: anchor });
    await shown;
    const baseline = anchor.getBoundingClientRect();
    window.scrollTo({ top: 300, behavior: 'auto' });
    await waitUntil(() => window.scrollY > 0, 'viewport scroll was applied');
    await nextFrame();
    await nextFrame();
    expect(window.scrollY).to.be.greaterThan(0);
    expect(anchor.getBoundingClientRect().top).to.equal(baseline.top);
    expect(el.open).to.equal(true);
    await el.hide();
  } finally {
    window.scrollTo(oldScroll.x, oldScroll.y);
  }
});
