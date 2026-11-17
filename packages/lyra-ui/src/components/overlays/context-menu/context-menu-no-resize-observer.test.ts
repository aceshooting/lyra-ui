import { expect, fixture, html, nextFrame, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './context-menu.js';
import '../../layout/menu/menu-item.js';
import type { LyraContextMenu } from './context-menu.class.js';

it('tracks real anchor motion and preserves native dismissal without ResizeObserver', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div>
      <div id="scroller" style="overflow:auto;inline-size:320px;block-size:120px">
        <div style="block-size:640px;padding-block-start:20px">
          <lr-context-menu label="Row actions" style="--show-duration:0ms;--hide-duration:0ms">
            <button slot="trigger">Row actions</button><lr-menu-item>Inspect</lr-menu-item>
          </lr-context-menu>
        </div>
      </div>
    </div>
  `);
  const scroller = root.querySelector<HTMLElement>('#scroller')!;
  const menu = root.querySelector<LyraContextMenu>('lr-context-menu')!;
  const anchor = root.querySelector<HTMLButtonElement>('button')!;
  const item = root.querySelector<HTMLElement>('lr-menu-item')!;
  const owner = menu.ownerDocument.defaultView!;
  const original = Object.getOwnPropertyDescriptor(owner, 'ResizeObserver');
  let shows = 0;
  let hides = 0;
  let afterHides = 0;
  menu.addEventListener('lr-show', () => { shows += 1; });
  menu.addEventListener('lr-hide', () => { hides += 1; });
  menu.addEventListener('lr-after-hide', () => { afterHides += 1; });
  try {
    Object.defineProperty(owner, 'ResizeObserver', { configurable: true, value: undefined });
    expect(typeof owner.ResizeObserver).to.equal('undefined');
    await focusByKeyboard(anchor);
    let rect = anchor.getBoundingClientRect();
    const shown = oneEvent(menu, 'lr-after-show');
    menu.showAt({ x: rect.left, y: rect.bottom, contextElement: anchor });
    await shown;
    await waitUntil(() => item.matches(':focus-within'), 'the actual menu row receives focus');
    expect(menu.open).to.equal(true);
    expect(shows).to.equal(1);

    const baselineTop = anchor.getBoundingClientRect().top;
    owner.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(anchor.getBoundingClientRect().top).to.equal(baselineTop);
    expect(menu.open).to.equal(true);
    expect(hides).to.equal(0);

    const scrolled = oneEvent(scroller, 'scroll');
    const movedHide = oneEvent(menu, 'lr-after-hide');
    scroller.scrollTop = 60;
    await scrolled;
    await waitUntil(() => Math.abs(anchor.getBoundingClientRect().top - baselineTop) > 30,
      'native scrolling moves the connected anchor');
    await movedHide;
    expect(menu.open).to.equal(false);
    expect(hides).to.equal(1);
    expect(afterHides).to.equal(1);

    const resetScroll = oneEvent(scroller, 'scroll');
    scroller.scrollTop = 0;
    await resetScroll;
    await focusByKeyboard(anchor);
    rect = anchor.getBoundingClientRect();
    const reopened = oneEvent(menu, 'lr-after-show');
    menu.showAt({ x: rect.left, y: rect.bottom, contextElement: anchor });
    await reopened;
    await waitUntil(() => item.matches(':focus-within'), 'a fresh menu session receives focus');
    const escaped = oneEvent(menu, 'lr-after-hide');
    await sendKeys({ press: 'Escape' });
    await escaped;
    await waitUntil(() => document.activeElement === anchor, 'Escape restores the live trigger');
    expect(menu.open).to.equal(false);
    expect(shows).to.equal(2);
    expect(hides).to.equal(2);
    expect(afterHides).to.equal(2);
  } finally {
    menu.remove();
    if (original) Object.defineProperty(owner, 'ResizeObserver', original);
    else Reflect.deleteProperty(owner, 'ResizeObserver');
  }
});
