import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './context-menu.js';
import '../../layout/menu/menu-item.js';
import type { LyraContextMenu, LyraContextMenuShowDetail } from './context-menu.class.js';

it('returns programmatic menu focus to the focused descendant of an external context anchor', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <section id="external"><button id="return">External action</button></section>
      <lr-context-menu style="--show-duration:0ms;--hide-duration:0ms"><lr-menu-item>Inspect</lr-menu-item></lr-context-menu>
    </div>
  `);
  const el = wrapper.querySelector<LyraContextMenu>('lr-context-menu')!;
  const target = wrapper.querySelector<HTMLButtonElement>('#return')!;
  await focusByKeyboard(target);
  const shown = oneEvent(el, 'lr-after-show');
  el.showAt({ x: 100, y: 100, contextElement: wrapper.querySelector('#external')! });
  await shown;
  const hidden = oneEvent(el, 'lr-after-hide');
  await sendKeys({ press: 'Escape' });
  await hidden;
  await waitUntil(() => document.activeElement === target);
  expect(el.open).to.equal(false);
});

it('clamps a keyboard menu point when its focused trigger moves completely outside the viewport', async () => {
  const el = await fixture<LyraContextMenu>(html`
    <lr-context-menu style="--show-duration:0ms;--hide-duration:0ms">
      <button slot="trigger" id="region">Region actions</button><lr-menu-item>Inspect</lr-menu-item>
    </lr-context-menu>
  `);
  const target = el.querySelector<HTMLButtonElement>('#region')!;
  await focusByKeyboard(target);
  target.style.cssText = 'position:fixed;left:-200px;top:-200px;width:40px;height:40px';
  const detail = oneEvent(el, 'lr-show');
  const shown = oneEvent(el, 'lr-after-show');
  await sendKeys({ press: 'Shift+F10' });
  const event = await detail as CustomEvent<LyraContextMenuShowDetail>;
  await shown;
  expect(event.detail.source).to.equal('keyboard');
  expect(event.detail.clientX).to.equal(0);
  expect(event.detail.clientY).to.equal(0);
  expect(el.open).to.equal(true);
  await el.hide();
});
