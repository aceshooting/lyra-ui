import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';

// `lr-date-input`'s calendar popup defaults to `position: fixed`, so a bare `overflow: auto`
// ancestor does not by itself pick up the popup's stale layout box -- only an ancestor that also
// establishes a CSS containing block for fixed positioning (transform/filter/contain/
// will-change/backdrop-filter) does. `transform: translateZ(0)` is that ancestor here, mirroring
// `select-closed-layout.test.ts`'s `position: relative` for the absolute-default select/combobox.
for (const phase of ['initial', 'closed after resize'] as const) {
  it(`keeps a ${phase} date-input popup out of the scrollable layout`, async () => {
    const container = await fixture<HTMLDivElement>(html`
      <div style="transform: translateZ(0); width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start">
        <lr-date-input style="width: 120px; --lr-transition-fast: 0s"></lr-date-input>
      </div>
    `);
    const el = container.querySelector<LyraDateInput>('lr-date-input')!;
    await el.updateComplete;
    if (phase === 'closed after resize') {
      await el.show();
      const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
      expect(getComputedStyle(panel).visibility).to.equal('visible');
      await el.hide();
      container.style.width = '240px';
    }
    expect(container.scrollWidth).to.equal(container.clientWidth);
  });
}

it('preserves the date-input popup close transition while removing the settled closed layout', async () => {
  const el = await fixture<LyraDateInput>(
    html`<lr-date-input style="--show-duration: 1s; --hide-duration: 1s"></lr-date-input>`
  );
  const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
  const shown = el.show();
  await waitUntil(() => panel.getAnimations().length > 0, 'opening transition starts');
  panel.getAnimations().forEach((animation) => animation.finish());
  await shown;
  expect(getComputedStyle(panel).visibility).to.equal('visible');
  const hidden = el.hide();
  await waitUntil(() => panel.getAnimations().length > 0, 'closing transition starts');
  expect(panel.getBoundingClientRect().width).to.be.greaterThan(0);
  panel.getAnimations().forEach((animation) => animation.finish());
  await hidden;
  expect(panel.getBoundingClientRect().width).to.equal(0);
  expect(panel.hasAttribute('hidden')).to.equal(true);
});
