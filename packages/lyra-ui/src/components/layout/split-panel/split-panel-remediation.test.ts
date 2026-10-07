import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './split-panel.js';
import type { LyraSplitPanel } from './split-panel.class.js';

for (const primary of ['start', 'end'] as const) {
  for (const canceled of [false, true]) {
    it(`proposes ${primary}-edge percentages and pixels with cancellation=${canceled}`, async () => {
      const element = await fixture<LyraSplitPanel>(html`<lr-split-panel primary=${primary} style="inline-size:400px;block-size:100px"></lr-split-panel>`);
      await waitUntil(() => element.positionInPixels > 0);
      element.position = 30;
      await element.updateComplete;
      const before = { position: element.position, positionInPixels: element.positionInPixels };
      let proposal: { position: number; positionInPixels: number } | undefined;
      let commits = 0;
      element.addEventListener('lr-reposition-request', event => {
        proposal = event.detail;
        if (canceled) event.preventDefault();
      });
      element.addEventListener('lr-reposition', () => commits++);
      const divider = element.shadowRoot!.querySelector<HTMLElement>('[part~="divider"]')!;
      divider.focus();
      divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      await element.updateComplete;
      expect(proposal !== undefined).to.equal(true);
      const size = before.positionInPixels / (before.position / 100);
      expect(proposal!.position).to.be.closeTo(proposal!.positionInPixels / size * 100, 0.001);
      expect(element.position).to.be.closeTo(canceled ? before.position : proposal!.position, 0.001);
      expect(element.positionInPixels).to.be.closeTo(canceled ? before.positionInPixels : proposal!.positionInPixels, 0.001);
      expect(commits).to.equal(canceled ? 0 : 1);
      proposal = undefined;
      element.position = 45;
      await element.updateComplete;
      expect(proposal).to.equal(undefined);
      expect(commits).to.equal(canceled ? 0 : 1);
    });
  }
}

describe('split-panel divider keyboard and paint', () => {
  it('leaves modified arrows to the browser', async () => {
    const element = await fixture<LyraSplitPanel>(html`<lr-split-panel position="40" style="inline-size:400px;block-size:100px"></lr-split-panel>`);
    await waitUntil(() => element.positionInPixels > 0);
    const divider = element.shadowRoot!.querySelector<HTMLElement>('[part~="divider"]')!;
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true, ...init });
      divider.dispatchEvent(event);
      expect(event.defaultPrevented, JSON.stringify(init)).to.equal(false);
    }
    expect(element.position).to.equal(40);
  });

  it('tints a keyboard-focused divider with the hover color', async () => {
    const element = await fixture<LyraSplitPanel>(html`<lr-split-panel
      style="inline-size:400px;block-size:100px;--lr-split-panel-divider-hover-color: rgb(70, 80, 90)"></lr-split-panel>`);
    const divider = element.shadowRoot!.querySelector<HTMLElement>('[part~="divider"]')!;
    await focusByKeyboard(divider);
    await waitUntil(() => getComputedStyle(divider).backgroundColor === 'rgb(70, 80, 90)', 'focus-visible divider paint');
  });
});
