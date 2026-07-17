import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './compare-panel.js';
import type { LyraComparePanel } from './compare-panel.js';

describe('lyra-compare-panel', () => {
  it('renders labelA/labelB, falling back to the localized defaults when unset', async () => {
    const el = (await fixture(html`<lyra-compare-panel></lyra-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="pane-a"]')!.getAttribute('aria-label')).to.equal('Response A');
    expect(el.shadowRoot!.querySelector('[part="pane-b"]')!.getAttribute('aria-label')).to.equal('Response B');
  });

  it('renders slotted a/b/prompt content', async () => {
    const el = (await fixture(html`
      <lyra-compare-panel>
        <span slot="prompt">The prompt</span>
        <span slot="a">Answer A</span>
        <span slot="b">Answer B</span>
      </lyra-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.textContent).to.include('Answer A');
    expect(el.textContent).to.include('Answer B');
    expect(el.textContent).to.include('The prompt');
  });

  it('emits lyra-vote and reflects vote on the chosen button', async () => {
    const el = (await fixture(html`<lyra-compare-panel item-id="pair-1"></lyra-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('[part="vote-button"]');
    setTimeout(() => (buttons[0] as HTMLElement).click());
    const ev = await oneEvent(el, 'lyra-vote');
    expect(ev.detail).to.deep.equal({ choice: 'a', itemId: 'pair-1' });
    await el.updateComplete;
    expect(el.vote).to.equal('a');
    expect((buttons[0] as HTMLElement).getAttribute('aria-pressed')).to.equal('true');
  });

  it('hides the tie/both-bad buttons when hide-tie/hide-both-bad are set', async () => {
    const el = (await fixture(html`<lyra-compare-panel hide-tie hide-both-bad></lyra-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="vote-button"]').length).to.equal(2);
  });

  it('resets vote to null when itemId changes', async () => {
    const el = (await fixture(html`<lyra-compare-panel item-id="pair-1" vote="a"></lyra-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.vote).to.equal('a');
    el.itemId = 'pair-2';
    await el.updateComplete;
    expect(el.vote).to.be.null;
  });

  it('disables the vote bar when disabled is set', async () => {
    const el = (await fixture(html`<lyra-compare-panel disabled></lyra-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
  });

  it('stacks panes below 640px container width', async () => {
    const el = (await fixture(html`<lyra-compare-panel></lyra-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const css = (await import('./compare-panel.styles.js')).styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('@container (max-width: 639.98px)');
  });

  it('falls back to the built-in English vote label and honors a strings override', async () => {
    const el = (await fixture(html`<lyra-compare-panel></lyra-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="vote-bar"]')!.getAttribute('aria-label')).to.equal('Vote');
    el.strings = { compareVoteLabel: 'Voter' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="vote-bar"]')!.getAttribute('aria-label')).to.equal('Voter');
  });

  it('falls back to the built-in English panel label and lets a host aria-label win', async () => {
    const el = (await fixture(html`<lyra-compare-panel></lyra-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Comparison');

    const withHostLabel = (await fixture(
      html`<lyra-compare-panel aria-label="Eval pair 12"></lyra-compare-panel>`,
    )) as LyraComparePanel;
    await withHostLabel.updateComplete;
    expect(withHostLabel.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Eval pair 12',
    );
  });

  it('is accessible', async () => {
    const el = (await fixture(html`
      <lyra-compare-panel label-a="Model A" label-b="Model B">
        <span slot="a">Answer A</span>
        <span slot="b">Answer B</span>
      </lyra-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
