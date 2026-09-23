import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.js';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
setFlagUrlResolver(async () => TEST_FLAG_SRC);

// `lr-locale-picker`'s option listbox defaults to `position: fixed`, so a bare `overflow: auto`
// ancestor does not by itself pick up the listbox's stale layout box -- only an ancestor that
// also establishes a CSS containing block for fixed positioning (transform/filter/contain/
// will-change/backdrop-filter) does. `transform: translateZ(0)` is that ancestor here, mirroring
// `select-closed-layout.test.ts`'s `position: relative` for the absolute-default select/combobox.
for (const phase of ['initial', 'closed after resize'] as const) {
  it(`keeps a ${phase} locale-picker listbox out of the scrollable layout`, async () => {
    const container = await fixture<HTMLDivElement>(html`
      <div style="transform: translateZ(0); width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start">
        <lr-locale-picker style="width: 120px; --lr-transition-fast: 0s"></lr-locale-picker>
      </div>
    `);
    const el = container.querySelector<LyraLocalePicker>('lr-locale-picker')!;
    await el.updateComplete;
    if (phase === 'closed after resize') {
      el.open = true;
      await el.updateComplete;
      const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
      await waitUntil(() => getComputedStyle(panel).visibility === 'visible');
      el.open = false;
      await el.updateComplete;
      await waitUntil(() => panel.hasAttribute('hidden'), 'the settled-closed listbox leaves layout');
      container.style.width = '240px';
    }
    expect(container.scrollWidth).to.equal(container.clientWidth);
  });
}

it('preserves the locale-picker listbox close transition while removing the settled closed layout', async () => {
  const el = await fixture<LyraLocalePicker>(
    html`<lr-locale-picker style="--lr-transition-fast: 1s"></lr-locale-picker>`
  );
  const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => getComputedStyle(panel).visibility === 'visible');
  el.open = false;
  await el.updateComplete;
  await waitUntil(() => panel.getAnimations().length > 0, 'closing transition starts');
  expect(panel.getBoundingClientRect().width).to.be.greaterThan(0);
  panel.getAnimations().forEach((animation) => animation.finish());
  await waitUntil(() => panel.hasAttribute('hidden'), 'the settled-closed listbox leaves layout');
  expect(panel.getBoundingClientRect().width).to.equal(0);
});
