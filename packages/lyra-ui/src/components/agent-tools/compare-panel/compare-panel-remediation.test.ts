import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-compare-panel.js';
import type { LyraComparePanel } from '../../lr-compare-panel.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

async function paint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

describe('disabled vote button paint', () => {
  for (const selected of [false, true]) {
    it(`retains ${selected ? 'selected' : 'unselected'} paint during hover and press`, async () => {
      const el = await fixture<LyraComparePanel>(html`
        <lr-compare-panel data-lr-theme-scope disabled vote="a" style="--lr-transition-fast: 0s; --lr-compare-panel-selected-bg: rgb(0, 51, 102);"></lr-compare-panel>
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

describe('lr-compare-panel vote commit and pane tab stops', () => {
  it('reports an accepted vote after committing it, and stays silent for a vetoed one', async () => {
    const el = await fixture<LyraComparePanel>(html`<lr-compare-panel item-id="pair-1"></lr-compare-panel>`);
    const changes: { vote: string; itemId: string; committed: string | null }[] = [];
    el.addEventListener('lr-vote-change', (event) => {
      const { vote, itemId } = (event as CustomEvent<{ vote: string; itemId: string }>).detail;
      changes.push({ vote, itemId, committed: el.vote });
    });
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="vote-button"]')];
    buttons[1]!.click();
    expect(changes).to.deep.equal([{ vote: 'b', itemId: 'pair-1', committed: 'b' }]);
    el.addEventListener('lr-vote-request', (event) => event.preventDefault(), { once: true });
    buttons[0]!.click();
    expect(changes.length).to.equal(1);
    expect(el.vote).to.equal('b');
  });

  it('makes a pane a tab stop only while its response overflows', async () => {
    const el = await fixture<LyraComparePanel>(html`
      <lr-compare-panel style="--lr-compare-panel-max-height: 120px">
        <p slot="a">Short.</p>
        <p slot="b">Short too.</p>
      </lr-compare-panel>
    `);
    await paint();
    const paneA = el.shadowRoot!.querySelector<HTMLElement>('[part="pane-a"]')!;
    expect(paneA.hasAttribute('tabindex')).to.equal(false);
    el.querySelector<HTMLElement>('[slot="a"]')!.textContent = 'A long response line. '.repeat(200);
    await paint();
    await paint();
    expect(paneA.getAttribute('tabindex')).to.equal('0');
    el.remove();
    expect(paneA.hasAttribute('tabindex')).to.equal(false);
    document.body.append(el);
    await paint();
    await paint();
    expect(paneA.getAttribute('tabindex')).to.equal('0');
    el.remove();
  });
});

it('emits nothing when the vote already held is pressed again', async () => {
  const el = await fixture<LyraComparePanel>(html`<lr-compare-panel item-id="pair-1"></lr-compare-panel>`);
  const events: string[] = [];
  for (const type of ['lr-vote-request', 'lr-vote-change']) el.addEventListener(type, () => events.push(type));
  const button = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="vote-button"]')!;
  button().click();
  await el.updateComplete;
  button().click();
  await el.updateComplete;
  expect(events).to.deep.equal(['lr-vote-request', 'lr-vote-change']);
});
