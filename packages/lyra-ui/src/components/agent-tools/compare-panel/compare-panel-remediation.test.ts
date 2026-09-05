import { expect, fixture, html } from '@open-wc/testing';
import './compare-panel.js';
import type { LyraComparePanel } from './compare-panel.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

async function paint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

describe('disabled vote button paint', () => {
  for (const selected of [false, true]) {
    it(`retains ${selected ? 'selected' : 'unselected'} paint during hover and press`, async () => {
      const el = await fixture<LyraComparePanel>(html`
        <lr-compare-panel disabled vote="a" style="--lr-transition-fast: 0s; --lr-compare-panel-selected-background: rgb(0, 51, 102);"></lr-compare-panel>
      `);
      const button = el.shadowRoot!.querySelector<HTMLButtonElement>(selected
        ? '[part="vote-button"][data-selected]'
        : '[part="vote-button"]:not([data-selected])')!;
      await resetMouse();
      await paint();
      const resting = getComputedStyle(button).backgroundColor;
      expect(button.disabled).to.equal(true);
      try {
        await hoverUntilMatched(button, 'disabled vote button should receive hover');
        await paint();
        expect(getComputedStyle(button).backgroundColor).to.equal(resting);
        await sendMouse({ type: 'down' });
        await paint();
        expect(getComputedStyle(button).backgroundColor).to.equal(resting);
      } finally {
        await resetMouse();
      }
    });
  }
});

it('keeps stacked response content visible at a narrow allocation while retaining the pane height cap', async () => {
  const el = await fixture<LyraComparePanel>(html`
    <lr-compare-panel style="inline-size: 320px;">
      <p slot="a">A concise answer with supporting detail.</p>
      <p slot="b">An alternative answer for comparison.</p>
    </lr-compare-panel>
  `);
  await paint();
  const panes = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="pane-a"], [part="pane-b"]')];
  for (const pane of panes) {
    expect(pane.clientHeight, 'short response fits without clipped header or text').to.be.at.least(pane.scrollHeight - 1);
  }
  const content = el.querySelector<HTMLElement>('[slot="a"]')!;
  content.textContent = 'A longer response with supporting detail. '.repeat(100);
  el.style.setProperty('--lr-compare-panel-max-height', '140px');
  await paint();
  expect(panes[0]!.getBoundingClientRect().height, 'long responses keep the configured cap').to.be.at.most(142);
  expect(panes[0]!.scrollHeight).to.be.greaterThan(panes[0]!.clientHeight);
});
