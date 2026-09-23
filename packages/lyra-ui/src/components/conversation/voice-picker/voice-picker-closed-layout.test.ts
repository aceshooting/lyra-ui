import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './voice-picker.js';
import type { LyraVoicePicker } from './voice-picker.js';

const CATALOG = ['alloy'];

for (const phase of ['initial', 'closed after resize'] as const) {
  it(`keeps a ${phase} voice-picker popup out of a transform ancestor's scrollable layout`, async () => {
    const container = await fixture<HTMLDivElement>(html`
      <div style="transform: translateZ(0); width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start">
        <lr-voice-picker .catalog=${CATALOG} style="width: 120px; --lr-transition-fast: 0s"></lr-voice-picker>
      </div>
    `);
    const control = container.querySelector<LyraVoicePicker>('lr-voice-picker')!;
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

it('preserves the voice-picker listbox close transition while removing the settled-closed layout', async () => {
  const control = await fixture<LyraVoicePicker>(
    html`<lr-voice-picker .catalog=${CATALOG} style="--lr-transition-fast: 1s"></lr-voice-picker>`,
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
