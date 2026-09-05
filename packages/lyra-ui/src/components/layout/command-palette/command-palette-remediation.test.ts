import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './command-palette.js';
import type { LyraCommand, LyraCommandPalette } from './command-palette.js';

describe('optional command keywords', () => {
  for (const keywords of [42, null, 'alias', { 0: 'alias', length: 1 }, ['alias', 42, null, 'alternate']]) {
    it(`retains ordinary command search and selection with ${JSON.stringify(keywords)} keywords`, async () => {
      const command = { commandId: 'save', label: 'Save document', description: 'Write the draft', keywords } as unknown as LyraCommand;
      const el = await fixture<LyraCommandPalette>(html`<lr-command-palette .commands=${[command, { commandId: 'close', label: 'Close' }]}></lr-command-palette>`);
      el.openPalette();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="command"]').length).to.equal(2);
      const input = el.shadowRoot!.querySelector('input')!;
      for (const query of ['Save', 'draft', ...(Array.isArray(keywords) ? ['alias', 'alternate'] : [])]) {
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await el.updateComplete;
        expect(el.shadowRoot!.querySelectorAll('[part="command"]').length, query).to.equal(1);
        expect(el.shadowRoot!.querySelector('[part="command"]')!.textContent).to.include('Save document');
      }
      const selected = oneEvent(el, 'lr-select');
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="command"]')!.click();
      expect((await selected).detail.command === command).to.equal(true);
      expect(el.commands[0] === command).to.equal(true);
    });
  }

  it('ignores holes and unsafe keyword entries without invoking accessors', async () => {
    let reads = 0;
    const keywords: unknown[] = ['first', , , 'last'];
    Object.defineProperty(keywords, '2', { get() { reads++; throw new Error('must not read keyword accessor'); } });
    const command = { commandId: 'safe', label: 'Safe command', keywords } as unknown as LyraCommand;
    const el = await fixture<LyraCommandPalette>(html`<lr-command-palette .commands=${[command]}></lr-command-palette>`);
    el.openPalette();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('input')!;
    for (const query of ['first', 'last']) {
      input.value = query;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="command"]').length).to.equal(1);
    }
    expect(reads).to.equal(0);
  });

  it('retains a command when its keyword array is a revoked proxy', async () => {
    const { proxy, revoke } = Proxy.revocable([], {});
    revoke();
    const command = { commandId: 'safe', label: 'Safe command', keywords: proxy };
    const el = await fixture<LyraCommandPalette>(html`<lr-command-palette .commands=${[command]}></lr-command-palette>`);
    el.openPalette();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="command"]').length).to.equal(1);
  });
});
