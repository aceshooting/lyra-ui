import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './model-select.js';
import type { LyraModelSelect } from './model-select.js';

const CATALOG = ['gpt-4o'];

for (const phase of ['initial', 'closed after resize'] as const) {
  it(`keeps a ${phase} model-select popup out of a transform ancestor's scrollable layout`, async () => {
    const container = await fixture<HTMLDivElement>(html`
      <div style="transform: translateZ(0); width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start">
        <lr-model-select .catalog=${CATALOG} style="width: 120px; --lr-transition-fast: 0s"></lr-model-select>
      </div>
    `);
    const control = container.querySelector<LyraModelSelect>('lr-model-select')!;
    await control.updateComplete;
    if (phase === 'closed after resize') {
      const listbox = control.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
      control.open = true;
      await control.updateComplete;
      await waitUntil(
        () => listbox.style.getPropertyValue('--lr-positioner-available-inline-size') !== '',
        'opened listbox never received live positioner geometry',
      );
      control.open = false;
      await control.updateComplete;
      container.style.width = '240px';
    }
    await waitUntil(
      () => container.scrollWidth === container.clientWidth,
      "the settled-closed listbox keeps enlarging the transform ancestor's scrollable layout",
    );
  });
}

it('preserves the model-select listbox close transition while removing the settled-closed layout', async () => {
  const control = await fixture<LyraModelSelect>(
    html`<lr-model-select .catalog=${CATALOG} style="--lr-transition-fast: 1s"></lr-model-select>`,
  );
  const listbox = control.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  for (let cycle = 0; cycle < 2; cycle++) {
    control.open = true;
    await control.updateComplete;
    await waitUntil(
      () => getComputedStyle(listbox).visibility === 'visible',
      `opening transition never revealed the listbox on cycle ${cycle}`,
    );
    expect(listbox.hidden, `listbox stayed hidden while open on cycle ${cycle}`).to.equal(false);
    control.open = false;
    await control.updateComplete;
    await waitUntil(() => listbox.getAnimations().length > 0, 'closing transition never started');
    expect(listbox.getBoundingClientRect().width, 'closing transition removed layout too early').to.be.greaterThan(0);
    listbox.getAnimations().forEach((animation) => animation.finish());
    await waitUntil(
      () => listbox.hidden === true,
      'listbox never left layout once its close transition settled',
    );
  }
});
