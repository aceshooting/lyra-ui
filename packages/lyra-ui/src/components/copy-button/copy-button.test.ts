import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './copy-button.js';
import type { LyraCopyButton } from './copy-button.js';

describe('lyra-copy-button', () => {
  it('defaults to an empty value and the resting "Copy" label', async () => {
    const el = (await fixture(html`<lyra-copy-button></lyra-copy-button>`)) as LyraCopyButton;
    expect(el.value).to.equal('');
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copy');
  });

  it('fires lyra-copy with the current value and writes it to the clipboard on click', async () => {
    const writes: string[] = [];
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => (writes.push(text), Promise.resolve()) },
      configurable: true,
    });
    try {
      const el = (await fixture(html`<lyra-copy-button value="hello"></lyra-copy-button>`)) as LyraCopyButton;
      const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
      const listener = oneEvent(el, 'lyra-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: 'hello' });
      expect(writes).to.deep.equal(['hello']);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('fires lyra-copy even when navigator.clipboard is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    try {
      const el = (await fixture(html`<lyra-copy-button value="hello"></lyra-copy-button>`)) as LyraCopyButton;
      const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
      const listener = oneEvent(el, 'lyra-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: 'hello' });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('swaps the aria-label to the copied confirmation immediately after activation, then reverts after ~1.5s', async () => {
    const el = (await fixture(html`<lyra-copy-button value="hello"></lyra-copy-button>`)) as LyraCopyButton;
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    button.click();
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copied!');
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copy');
  });

  it('forwards a host aria-label to the internal semantic button', async () => {
    const el = (await fixture(html`
      <lyra-copy-button aria-label="Copy API key" value="secret"></lyra-copy-button>
    `)) as LyraCopyButton;
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copy API key');

    button.click();
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copy API key');
  });

  it('disables the internal button and suppresses activation', async () => {
    const el = (await fixture(html`
      <lyra-copy-button disabled value="secret"></lyra-copy-button>
    `)) as LyraCopyButton;
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    let copies = 0;
    el.addEventListener('lyra-copy', () => copies++);

    button.click();
    expect(el.disabled).to.be.true;
    expect(button.disabled).to.be.true;
    expect(copies).to.equal(0);
  });

  it('forwards focus() and blur() to the internal button', async () => {
    const el = (await fixture(html`<lyra-copy-button></lyra-copy-button>`)) as LyraCopyButton;
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;

    el.focus();
    expect(el.shadowRoot!.activeElement === button).to.be.true;
    el.blur();
    expect(el.shadowRoot!.activeElement).to.equal(null);
  });

  it('uses string overrides for both resting and confirmation labels', async () => {
    const el = (await fixture(html`<lyra-copy-button></lyra-copy-button>`)) as LyraCopyButton;
    el.strings = { copy: 'Copier', copied: 'Copié' };
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copier');

    button.click();
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copié');
  });

  it('supports a configurable feedback duration', async () => {
    const el = (await fixture(html`
      <lyra-copy-button value="hello" feedback-duration="20"></lyra-copy-button>
    `)) as LyraCopyButton;
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    expect(el.feedbackDuration).to.equal(20);
    button.click();
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copied!');

    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copy');
  });

  it('falls back to the default feedback duration for a non-finite/negative value instead of leaving the confirmation state stuck', async () => {
    const el = (await fixture(html`
      <lyra-copy-button value="hello" feedback-duration="NaN"></lyra-copy-button>
    `)) as LyraCopyButton;
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    button.click();
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copied!');

    // NaN self-heals to the DEFAULT_FEEDBACK_DURATION (1500ms), not 0/never -- a short wait must
    // NOT have already reverted it.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copied!');

    el.feedbackDuration = -20;
    button.click();
    await el.updateComplete;
    // A negative duration clamps to 0, reverting on the very next tick.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Copy');
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lyra-copy-button value="hello"></lyra-copy-button>`);
    await expect(el).to.be.accessible();
  });

  it('dims the disabled button via the shared --lyra-opacity-disabled token', async () => {
    const el = (await fixture(html`<lyra-copy-button disabled value="hello"></lyra-copy-button>`)) as LyraCopyButton;
    const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    // Regression: the rule previously referenced the non-existent
    // --lyra-disabled-opacity (reversed word order), which left the
    // invalid opacity declaration at its initial value (1) instead of the
    // shared 0.5 dimming used by every other disabled control.
    expect(getComputedStyle(button).opacity).to.equal('0.5');
  });
});
