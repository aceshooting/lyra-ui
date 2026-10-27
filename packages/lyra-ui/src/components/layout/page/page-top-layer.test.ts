import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import './page.js';

it('keeps mobile navigation above fixed headers and outside transformed ancestor bounds', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <header style="position:fixed;inset:0 0 auto;height:80px;z-index:2147483647;background:white">Fixed header</header>
    <div style="transform:translateZ(0);inline-size:360px;margin:120px">
      <lr-page style="inline-size:320px;--lr-transition-base:0ms">
        <button slot="navigation-toggle">Open navigation</button>
        <button slot="navigation">Navigation action</button>
      </lr-page>
    </div>
  </div>`);
  const page = wrapper.querySelector('lr-page')!;
  const opener = page.querySelector<HTMLButtonElement>('[slot="navigation-toggle"]')!;
  const action = page.querySelector<HTMLButtonElement>('[slot="navigation"]')!;
  await page.updateComplete;
  await focusByKeyboard(opener);
  page.showNavigation();
  await page.updateComplete;
  const surface = page.shadowRoot!.querySelector<HTMLElement>('[part="dialog-wrapper"]')!;
  await waitUntil(() => surface.getBoundingClientRect().width > 0);
  const bounds = surface.getBoundingClientRect();
  expect(bounds.left).to.be.closeTo(0, 1);
  expect(bounds.top).to.be.closeTo(0, 1);
  expect(surface.matches(':popover-open')).to.equal(true);
  let clicks = 0;
  action.addEventListener('click', () => clicks++);
  const rect = action.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
  expect(clicks).to.equal(1);
  expect(deepActiveElement(document) === action).to.equal(true);
  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !page.navOpen);
  expect(surface.matches(':popover-open')).to.equal(false);
  await waitUntil(() => deepActiveElement(document) === opener);
});

it('does not restart modal presentation when a close supersedes a queued reconnect', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-page style="inline-size:320px;--lr-transition-base:0ms" nav-open>
      <button slot="navigation">Navigation action</button>
    </lr-page>
  </div>`);
  const page = wrapper.querySelector('lr-page')!;
  await page.updateComplete;
  const controller = (page as unknown as { modalSurface: { show(): void } }).modalSurface;
  const show = controller.show;
  let presentations = 0;
  controller.show = (): void => {
    presentations += 1;
    show.call(controller);
  };
  try {
    // Queue rendering before reconnect's deferred show, then close in the same task.
    page.requestUpdate();
    page.remove();
    wrapper.append(page);
    page.navOpen = false;
    await page.updateComplete;
    await Promise.resolve();
    expect(presentations, 'a closed drawer does not restart its presentation subscription').to.equal(0);
    expect(page.shadowRoot!.querySelector('[part="dialog-wrapper"]')!.matches(':popover-open')).to.equal(false);
  } finally {
    controller.show = show;
  }
});
