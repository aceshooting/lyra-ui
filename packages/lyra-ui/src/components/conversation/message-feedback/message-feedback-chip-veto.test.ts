import { expect, fixture, html } from '@open-wc/testing';
import type { LyraMessageFeedback } from './message-feedback.class.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import './message-feedback.js';

for (const cause of ['disabled', 'pending', 'veto'] as const) {
  for (const selected of [false, true]) {
    it(`preserves ${selected ? 'selected' : 'unselected'} feedback reasons after ${cause} during a chip request`, async () => {
      const host = await fixture<LyraMessageFeedback>(html`<lr-message-feedback .detail=${{
        reasons: [{ id: 'wrong', label: 'Incorrect' }],
      }}></lr-message-feedback>`);
      host.shadowRoot!.querySelector<HTMLButtonElement>('[part="down-button"]')!.click();
      await host.updateComplete;
      const chip = host.shadowRoot!.querySelector<LyraChip>('lr-chip')!;
      await chip.updateComplete;
      const button = chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!;
      if (selected) { button.click(); await host.updateComplete; await chip.updateComplete; }
      host.addEventListener('lr-chip-toggle-request', event => {
        if (cause === 'veto') event.preventDefault();
        else host[cause] = true;
      }, { capture: true, once: true });
      button.click();
      await host.updateComplete; await chip.updateComplete;
      expect(chip.selected).to.equal(selected);
      if (cause !== 'veto') host[cause] = false;
      await host.updateComplete; await chip.updateComplete;
      const submissions: string[][] = [];
      host.addEventListener('lr-feedback-submit-request', event => {
        submissions.push([...(event as CustomEvent<{ reasonIds: readonly string[] }>).detail.reasonIds]);
      });
      host.shadowRoot!.querySelector<HTMLButtonElement>('[part="submit-button"]')!.click();
      expect(submissions).to.deep.equal([selected ? ['wrong'] : []]);
    });
  }
}
