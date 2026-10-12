import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './context-menu.js';
import '../overlay/dropdown.js';
import '../../layout/menu/menu-item.js';
import type { LyraContextMenu } from './context-menu.class.js';

it('closes a point-anchored menu when its connected anchor moves before viewport resize', async () => {
  const el = await fixture<LyraContextMenu>(html`
    <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
      <div slot="trigger"><button id="anchor">Open menu</button></div>
      <lr-menu-item value="one">One</lr-menu-item>
    </lr-context-menu>
  `);
  const anchor = el.querySelector<HTMLButtonElement>('#anchor')!;
  const initialLeft = anchor.getBoundingClientRect().left;

  const afterShow = oneEvent(el, 'lr-after-show');
  anchor.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: 20,
    clientY: 20,
  }));
  await afterShow;
  expect(el.open).to.equal(true);

  let hideRequests = 0;
  el.addEventListener('lr-hide', () => { hideRequests += 1; });
  const afterHide = oneEvent(el, 'lr-after-hide');
  anchor.style.transform = 'translateX(140px)';
  await waitUntil(
    () => Math.abs(anchor.getBoundingClientRect().left - initialLeft) > 100,
    'the connected anchor geometry did not move before resize',
  );
  window.dispatchEvent(new Event('resize'));
  await afterHide;

  expect(hideRequests).to.equal(1);
  expect(el.open).to.equal(false);
});
