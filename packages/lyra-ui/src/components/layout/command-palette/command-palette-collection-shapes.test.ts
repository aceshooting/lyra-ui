import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraCommand, LyraCommandPalette } from './command-palette.class.js';
import './command-palette.js';

it('omits sparse, accessor, array and invalid optional-field commands while preserving the usable command identity', async () => {
  let reads = 0;
  let callbacks = 0;
  const command: LyraCommand = { commandId: 'available', label: 'Available command', onSelect: () => { callbacks += 1; } };
  const commands: unknown[] = [];
  commands.length = 5;
  Object.defineProperty(commands, '1', { get() { reads += 1; throw new Error('command accessor'); } });
  commands[2] = [];
  commands[3] = { commandId: 'invalid', label: 'Invalid command', group: 42 };
  commands[4] = command;
  const el = await fixture<LyraCommandPalette>(html`<lr-command-palette .commands=${commands}></lr-command-palette>`);
  let selected: unknown;
  el.addEventListener('lr-select', event => { selected = event.detail.command; });
  try {
    el.openPalette();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
    await waitUntil(() => el.shadowRoot!.activeElement === input);
    const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.include('Available command');
    expect(reads).to.equal(0);
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => !el.open);
    expect(selected === command).to.equal(true);
    expect(callbacks).to.equal(1);
    expect(reads).to.equal(0);
  } finally {
    el.close();
  }
});

it('renders no commands for primitive collection bindings and accepts a later valid collection', async () => {
  const el = await fixture<LyraCommandPalette>(html`<lr-command-palette></lr-command-palette>`);
  try {
    el.openPalette();
    await el.updateComplete;
    for (const value of [null, undefined, 42, 'commands']) {
      Reflect.set(el, 'commands', value);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="command"]').length).to.equal(0);
      expect(el.open).to.equal(true);
    }
    el.commands = [{ commandId: 'recovered', label: 'Recovered command' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="command"]').length).to.equal(1);
    expect(el.shadowRoot!.textContent).to.include('Recovered command');
  } finally {
    el.close();
  }
});
