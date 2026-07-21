import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './compare-panel.js';
import type { LyraComparePanel } from './compare-panel.js';
import { styles } from './compare-panel.styles.js';

describe('lr-compare-panel', () => {
  it('renders labelA/labelB, falling back to the localized defaults when unset', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="pane-a"]')!.getAttribute('aria-label')).to.equal('Response A');
    expect(el.shadowRoot!.querySelector('[part="pane-b"]')!.getAttribute('aria-label')).to.equal('Response B');
  });

  it('renders slotted a/b/prompt content', async () => {
    const el = (await fixture(html`
      <lr-compare-panel>
        <span slot="prompt">The prompt</span>
        <span slot="a">Answer A</span>
        <span slot="b">Answer B</span>
      </lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.textContent).to.include('Answer A');
    expect(el.textContent).to.include('Answer B');
    expect(el.textContent).to.include('The prompt');
  });

  it('emits lr-vote and reflects vote on the chosen button', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-1"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('[part="vote-button"]');
    setTimeout(() => (buttons[0] as HTMLElement).click());
    const ev = await oneEvent(el, 'lr-vote');
    expect(ev.detail).to.deep.equal({ choice: 'a', itemId: 'pair-1' });
    await el.updateComplete;
    expect(el.vote).to.equal('a');
    expect((buttons[0] as HTMLElement).getAttribute('aria-pressed')).to.equal('true');
  });

  it('emits lr-vote for the B pane and marks the B button pressed', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-2"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('[part="vote-button"]');
    setTimeout(() => (buttons[1] as HTMLElement).click());
    const ev = await oneEvent(el, 'lr-vote');
    expect(ev.detail).to.deep.equal({ choice: 'b', itemId: 'pair-2' });
    await el.updateComplete;
    expect(el.vote).to.equal('b');
    expect((buttons[1] as HTMLElement).getAttribute('aria-pressed')).to.equal('true');
  });

  it('emits lr-vote for a tie and marks the tie button pressed', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-3"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    // Button order: A, B, tie, both-bad.
    const tieButton = el.shadowRoot!.querySelectorAll('[part="vote-button"]')[2] as HTMLElement;
    setTimeout(() => tieButton.click());
    const ev = await oneEvent(el, 'lr-vote');
    expect(ev.detail).to.deep.equal({ choice: 'tie', itemId: 'pair-3' });
    await el.updateComplete;
    expect(el.vote).to.equal('tie');
    expect(tieButton.getAttribute('aria-pressed')).to.equal('true');
  });

  it('emits lr-vote for both-bad and marks that button pressed', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-4"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const bothBadButton = el.shadowRoot!.querySelectorAll('[part="vote-button"]')[3] as HTMLElement;
    setTimeout(() => bothBadButton.click());
    const ev = await oneEvent(el, 'lr-vote');
    expect(ev.detail).to.deep.equal({ choice: 'both-bad', itemId: 'pair-4' });
    await el.updateComplete;
    expect(el.vote).to.equal('both-bad');
    expect(bothBadButton.getAttribute('aria-pressed')).to.equal('true');
  });

  it('synchronizes the paired pane scroll position when sync-scroll is enabled and content overflows', async () => {
    const el = (await fixture(html`
      <lr-compare-panel sync-scroll style="--lr-compare-panel-max-height: 50px">
        <div slot="a" style="block-size: 500px;">Tall A content</div>
        <div slot="b" style="block-size: 500px;">Tall B content</div>
      </lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.syncScroll).to.be.true;
    const paneA = el.shadowRoot!.querySelector('[part="pane-a"]') as HTMLElement;
    const paneB = el.shadowRoot!.querySelector('[part="pane-b"]') as HTMLElement;
    expect(paneA.scrollHeight).to.be.greaterThan(paneA.clientHeight);

    paneA.scrollTop = paneA.scrollHeight - paneA.clientHeight; // scroll to the very bottom
    paneA.dispatchEvent(new Event('scroll'));
    await aTimeout(50);

    expect(paneB.scrollTop).to.be.greaterThan(0);
  });

  it('does not sync scroll between panes when sync-scroll is unset (the default)', async () => {
    const el = (await fixture(html`
      <lr-compare-panel style="--lr-compare-panel-max-height: 50px">
        <div slot="a" style="block-size: 500px;">Tall A content</div>
        <div slot="b" style="block-size: 500px;">Tall B content</div>
      </lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.syncScroll).to.be.false;
    const paneA = el.shadowRoot!.querySelector('[part="pane-a"]') as HTMLElement;
    const paneB = el.shadowRoot!.querySelector('[part="pane-b"]') as HTMLElement;

    paneA.scrollTop = paneA.scrollHeight - paneA.clientHeight;
    paneA.dispatchEvent(new Event('scroll'));
    await aTimeout(50);

    expect(paneB.scrollTop).to.equal(0);
  });

  it('hides the tie/both-bad buttons when hide-tie/hide-both-bad are set', async () => {
    const el = (await fixture(html`<lr-compare-panel hide-tie hide-both-bad></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="vote-button"]').length).to.equal(2);
  });

  it('resets vote to null when itemId changes', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-1" vote="a"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.vote).to.equal('a');
    el.itemId = 'pair-2';
    await el.updateComplete;
    expect(el.vote).to.be.null;
  });

  it('disables the vote bar when disabled is set', async () => {
    const el = (await fixture(html`<lr-compare-panel disabled></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
  });

  it('stacks panes below 640px container width', async () => {
    const wrap = await fixture(html`
      <div style="inline-size:320px;">
        <lr-compare-panel></lr-compare-panel>
      </div>
    `);
    const narrow = wrap.querySelector('lr-compare-panel') as LyraComparePanel;
    await narrow.updateComplete;
    const panes = narrow.shadowRoot!.querySelector('[part="panes"]') as HTMLElement;
    expect(getComputedStyle(panes).flexDirection).to.equal('column');

    // Control: the same part at the default (wide) allocation stays a row.
    const wide = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await wide.updateComplete;
    const widePanes = wide.shadowRoot!.querySelector('[part="panes"]') as HTMLElement;
    expect(getComputedStyle(widePanes).flexDirection).to.equal('row');
  });

  it('falls back to the built-in English vote label and honors a strings override', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="vote-bar"]')!.getAttribute('aria-label')).to.equal('Vote');
    el.strings = { compareVoteLabel: 'Voter' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="vote-bar"]')!.getAttribute('aria-label')).to.equal('Voter');
  });

  it('falls back to the built-in English panel label and lets a host aria-label win', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Comparison');

    const withHostLabel = (await fixture(
      html`<lr-compare-panel aria-label="Eval pair 12"></lr-compare-panel>`,
    )) as LyraComparePanel;
    await withHostLabel.updateComplete;
    expect(withHostLabel.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Eval pair 12',
    );
  });

  it('dims a disabled vote button through the shared disabled-opacity token', async () => {
    const wrapper = (await fixture(
      html`<div style="--lr-theme-opacity-disabled: 0.25"><lr-compare-panel disabled></lr-compare-panel></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-compare-panel') as LyraComparePanel;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
    expect(getComputedStyle(button).opacity).to.equal('0.25');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`
      <lr-compare-panel label-a="Model A" label-b="Model B">
        <span slot="a">Answer A</span>
        <span slot="b">Answer B</span>
      </lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('gives vote-button a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='vote-button'\]:hover/);
  });
});
