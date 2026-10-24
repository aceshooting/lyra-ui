import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './drawer.js';
import type { LyraDrawer } from './drawer.class.js';

function panelName(el: LyraDrawer): string {
  const panel = el.shadowRoot!.querySelector('[part~="panel"]')!;
  return panel.getAttribute('aria-label') ?? el.shadowRoot!
    .getElementById(panel.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? '';
}

it('refreshes a contained drawer referenced heading on opening, mutation and reconnect without acquiring modal ownership', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="position: relative; inline-size: 480px; block-size: 320px">
      <button data-outside>Outside action</button>
      <lr-drawer contained label="Fallback title" style="--lr-drawer-width: 200px; --lr-duration-base: 0ms">
        <h2 aria-labelledby="contained-heading-reference"><span id="contained-heading-reference">Initial heading</span></h2>
        <button>Inside action</button>
      </lr-drawer>
    </div>
  `);
  const el = wrapper.querySelector<LyraDrawer>('lr-drawer')!;
  const outside = wrapper.querySelector<HTMLButtonElement>('[data-outside]')!;
  const headingText = el.querySelector('span')!;
  const previousOverflow = document.documentElement.style.overflow;
  await focusByKeyboard(outside);
  try {
    await el.show();
    await waitUntil(() => panelName(el) === 'Initial heading', 'the first open resolves the referenced heading');
    expect(document.activeElement === outside).to.equal(true);
    expect(outside.inert).to.equal(false);
    expect(document.documentElement.style.overflow).to.equal(previousOverflow);
    expect(el.shadowRoot!.querySelector('[part~="panel"]')!.getAttribute('aria-modal')).not.to.equal('true');
    headingText.textContent = '  ';
    await waitUntil(() => panelName(el) === 'Fallback title', 'an empty referenced heading uses the visible fallback');
    headingText.textContent = 'Restored heading';
    await waitUntil(() => panelName(el) === 'Restored heading', 'restored reference text becomes the name');
    el.remove();
    headingText.textContent = 'After reconnect';
    wrapper.appendChild(el);
    await waitUntil(() => panelName(el) === 'After reconnect', 'reconnection reads the latest reference text');
    expect(el.open).to.equal(true);
    expect(document.activeElement === outside).to.equal(true);
    expect(outside.inert).to.equal(false);
    expect(document.documentElement.style.overflow).to.equal(previousOverflow);
    await sendKeys({ press: 'Escape' });
    await el.updateComplete;
    expect(el.open).to.equal(true);
  } finally {
    await el.hide();
  }
});
