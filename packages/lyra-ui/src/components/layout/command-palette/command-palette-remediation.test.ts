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

it('draws its search glyph inline without registering lr-icon', async () => {
  const el = await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
  el.openPalette();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="search"] svg') !== null).to.equal(true);
  expect(customElements.get('lr-icon') === undefined).to.equal(true);
  el.close();
});

it('opens and closes through the shared show()/hide() overlay surface', async () => {
  const el = await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
  el.show();
  expect(el.open).to.equal(true);
  const closed = oneEvent(el, 'lr-close');
  el.hide();
  expect((await closed).detail.reason).to.equal('api');
});

describe('dialog-vocabulary lifecycle events', () => {
  it('emits lr-show, lr-after-show, lr-hide, lr-close and lr-after-hide in order, the after events once rendered', async () => {
    const el = await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
    const order: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-close-request', 'lr-close', 'lr-after-hide']) {
      el.addEventListener(name, (event) => {
        order.push(name);
        if (name === 'lr-hide') expect((event as CustomEvent<{ reason: string }>).detail.reason).to.equal('escape');
        if (name === 'lr-hide') expect(event.cancelable).to.equal(false);
      });
    }
    el.openPalette();
    expect(order).to.deep.equal(['lr-show']);
    await el.updateComplete;
    expect(order).to.deep.equal(['lr-show', 'lr-after-show']);
    el.close('escape');
    expect(order.slice(2)).to.deep.equal(['lr-close-request', 'lr-hide', 'lr-close']);
    await el.updateComplete;
    expect(order.slice(5)).to.deep.equal(['lr-after-hide']);
  });

  it('emits neither lr-hide nor lr-after-hide when the close is vetoed, and no lr-after-hide before ever opening', async () => {
    const el = await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
    const seen: string[] = [];
    el.addEventListener('lr-hide', () => seen.push('hide'));
    el.addEventListener('lr-after-hide', () => seen.push('after-hide'));
    el.addEventListener('lr-close-request', (event) => event.preventDefault());
    el.openPalette();
    await el.updateComplete;
    el.close();
    await el.updateComplete;
    expect(seen).to.deep.equal([]);
  });
});
