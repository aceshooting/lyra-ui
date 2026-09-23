import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './select.js';
import '../combobox/combobox.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraCombobox } from '../combobox/combobox.js';

for (const kind of ['select', 'combobox'] as const) {
  for (const phase of ['initial', 'closed after resize'] as const) {
    it(`keeps a ${phase} ${kind} popup out of the scrollable layout`, async () => {
      const options = html`
        <lr-option value="a">A long option label that exceeds the trigger width</lr-option>
        <lr-option value="b">Another option</lr-option>
      `;
      const container = await fixture<HTMLDivElement>(html`
        <div style="position: relative; width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start">
          ${kind === 'select'
            ? html`<lr-select label="Choice" positioning-strategy="absolute" style="width: 120px; --lr-transition-fast: 0s">${options}</lr-select>`
            : html`<lr-combobox label="Choice" positioning-strategy="absolute" style="width: 120px; --lr-transition-fast: 0s">${options}</lr-combobox>`}
        </div>
      `);
      const control = container.querySelector<LyraSelect | LyraCombobox>(`lr-${kind}`)!;
      await control.updateComplete;
      if (phase === 'closed after resize') {
        await control.show();
        const panel = control.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
        expect(getComputedStyle(panel).visibility).to.equal('visible');
        await control.hide();
        container.style.width = '240px';
      }
      expect(container.scrollWidth).to.equal(container.clientWidth);
    });
  }

  it(`preserves ${kind} popup transitions while removing the settled closed layout`, async () => {
    const control = await fixture<LyraSelect | LyraCombobox>(kind === 'select'
      ? html`<lr-select label="Choice" style="--show-duration: 1s; --hide-duration: 1s"><lr-option value="a">Apple</lr-option><lr-option value="b">Banana</lr-option></lr-select>`
      : html`<lr-combobox label="Choice" style="--show-duration: 1s; --hide-duration: 1s"><lr-option value="a">Apple</lr-option><lr-option value="b">Banana</lr-option></lr-combobox>`);
    const panel = control.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    for (let cycle = 0; cycle < 2; cycle++) {
      const shown = control.show();
      await waitUntil(() => panel.getAnimations().length > 0, `opening transition starts on cycle ${cycle}`);
      panel.getAnimations().forEach((animation) => animation.finish());
      await shown;
      expect(getComputedStyle(panel).visibility).to.equal('visible');
      const hidden = control.hide();
      await waitUntil(() => panel.getAnimations().length > 0, 'closing transition starts');
      expect(panel.getBoundingClientRect().width).to.be.greaterThan(0);
      panel.getAnimations().forEach((animation) => animation.finish());
      await hidden;
      expect(panel.getBoundingClientRect().width).to.equal(0);
    }
  });
}
