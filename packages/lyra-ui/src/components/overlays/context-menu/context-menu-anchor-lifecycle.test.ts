import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-context-menu.js';
import '../../lr-menu-item.js';
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

it('keeps the replacement anchor and focus target when showAt runs inside lr-after-hide', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="original">Original</button><button id="anchor">Replacement</button>
      <button id="return">Return here</button>
      <lr-context-menu style="--show-duration:0ms;--hide-duration:0ms">
        <lr-menu-item>Inspect</lr-menu-item>
      </lr-context-menu>
    </div>
  `);
  const menu = wrapper.querySelector('lr-context-menu')!;
  const original = wrapper.querySelector<HTMLButtonElement>('#original')!;
  const anchor = wrapper.querySelector<HTMLButtonElement>('#anchor')!;
  const target = wrapper.querySelector<HTMLButtonElement>('#return')!;
  const firstShown = oneEvent(menu, 'lr-after-show');
  menu.showAt({ x: 60, y: 40, contextElement: original }, { returnFocusTo: original });
  await firstShown;
  const replacementShown = oneEvent(menu, 'lr-after-show');
  menu.addEventListener('lr-after-hide', () => {
    menu.showAt({ x: 120, y: 40, contextElement: anchor }, { returnFocusTo: target });
  }, { once: true });
  await menu.hide();
  await replacementShown;
  const hidden = oneEvent(menu, 'lr-after-hide');
  anchor.remove();
  await waitUntil(() => !menu.open, 'removing the replacement anchor closes its menu');
  await hidden;
  expect(document.activeElement === target).to.be.true;
});

it('coalesces synchronous showAt preflight requests and watches the last requested anchor', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <button id="first">First</button><button id="last">Last</button><button id="return">Return</button>
    <lr-context-menu><lr-menu-item>Inspect</lr-menu-item></lr-context-menu>
  </div>`);
  const menu = wrapper.querySelector('lr-context-menu')!;
  const first = wrapper.querySelector<HTMLButtonElement>('#first')!;
  const last = wrapper.querySelector<HTMLButtonElement>('#last')!;
  const target = wrapper.querySelector<HTMLButtonElement>('#return')!;
  let requests = 0;
  menu.addEventListener('lr-show', () => {
    if (++requests === 1) menu.showAt({ x: 140, y: 40, contextElement: last }, { returnFocusTo: target });
  });
  const shown = oneEvent(menu, 'lr-after-show');
  menu.showAt({ x: 20, y: 20, contextElement: first }, { returnFocusTo: first });
  await shown;
  expect(requests).to.equal(1);
  const hidden = oneEvent(menu, 'lr-after-hide');
  last.remove();
  await waitUntil(() => !menu.open);
  await hidden;
  expect(document.activeElement === target).to.be.true;
});

it('applies a preflight veto to the nested request and accepts a fresh show afterward', async () => {
  const menu = await fixture<LyraContextMenu>(html`<lr-context-menu><lr-menu-item>Inspect</lr-menu-item></lr-context-menu>`);
  let requests = 0;
  menu.addEventListener('lr-show', () => requests++);
  menu.addEventListener('lr-show', (event) => {
    menu.showAt({ x: 120, y: 40 });
    event.preventDefault();
  }, { once: true });
  menu.showAt({ x: 20, y: 20 });
  expect(requests).to.equal(1);
  expect(menu.open).to.be.false;
  const shown = oneEvent(menu, 'lr-after-show');
  menu.showAt({ x: 60, y: 20 });
  await shown;
  expect(requests).to.equal(2);
  await menu.hide();
});
