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
});
