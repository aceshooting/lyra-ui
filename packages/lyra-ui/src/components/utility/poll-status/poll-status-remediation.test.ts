import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './poll-status.js';
import type { LyraPollStatus } from './poll-status.js';

for (const direction of ['ltr', 'rtl']) {
  for (const state of ['inactive', 'refreshing'] as const) {
    it(`wraps an unbroken localized ${state} label within 320px in ${direction}`, async () => {
      const label = 'InternationalRefreshStatusWithoutBreaks'.repeat(5);
      const root = await fixture<HTMLDivElement>(html`<div dir=${direction} style="inline-size:320px">
        <lr-poll-status .active=${state !== 'inactive'} .nextInMs=${0}
          .strings=${{ pollInactive: label, pollRefreshing: label }}></lr-poll-status>
      </div>`);
      const viewer = root.querySelector<LyraPollStatus>('lr-poll-status')!;
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="countdown"]')?.textContent === label);
      const control = viewer.shadowRoot!.querySelector<HTMLButtonElement>('[part="pause-button"]')!;
      const rect = root.getBoundingClientRect();
      const viewerRect = viewer.getBoundingClientRect();
      expect(viewerRect.left).to.be.at.least(rect.left - 1);
      expect(viewerRect.right).to.be.at.most(rect.right + 1);
      expect(viewer.scrollWidth).to.be.at.most(root.clientWidth);
      expect(control.getBoundingClientRect().width).to.be.at.least(parseFloat(getComputedStyle(control).minInlineSize));
      expect(control.disabled).to.equal(state === 'inactive');
      if (state !== 'inactive') {
        control.click();
        await viewer.updateComplete;
        expect(viewer.paused).to.equal(true);
        control.click();
        await viewer.updateComplete;
        expect(viewer.paused).to.equal(false);
      }
    });
  }
}
