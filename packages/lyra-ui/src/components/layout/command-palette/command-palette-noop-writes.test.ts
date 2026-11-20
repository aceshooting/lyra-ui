import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraCommandPalette } from './command-palette.class.js';
import '../../lr-command-palette.js';

function recordLifecycle(el: LyraCommandPalette): string[] {
  const events: string[] = [];
  for (const type of ['lr-show', 'lr-close-request', 'lr-hide', 'lr-close', 'lr-select']) {
    el.addEventListener(type, () => events.push(type));
  }
  return events;
}

describe('lr-command-palette identical open writes', () => {
  it('emits nothing for an open write that matches the current state', async () => {
    const el = await fixture<LyraCommandPalette>(html`<lr-command-palette
      .commands=${[{ commandId: 'one', label: 'One' }]}></lr-command-palette>`);
    const events = recordLifecycle(el);
    el.open = false;
    await el.updateComplete;
    expect(events).to.deep.equal([]);
    el.open = true;
    await el.updateComplete;
    expect(events).to.deep.equal(['lr-show']);
    el.open = true;
    await el.updateComplete;
    expect(events, 'a repeated open write re-announced the palette').to.deep.equal(['lr-show']);
    el.close();
    await el.updateComplete;
    expect(el.open).to.equal(false);
  });
});

describe('lr-command-palette disabled rows', () => {
  it('ignores a click on a disabled command and keeps the palette open', async () => {
    let ran = 0;
    const el = await fixture<LyraCommandPalette>(html`<lr-command-palette
      .commands=${[
        { commandId: 'off', label: 'Unavailable', disabled: true, onSelect: () => { ran += 1; } },
        { commandId: 'on', label: 'Available' },
      ]}></lr-command-palette>`);
    el.openPalette();
    await el.updateComplete;
    const events = recordLifecycle(el);
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="command"]')];
    await waitUntil(() => rows.length === 2, 'rows never rendered');
    const disabled = rows.find((row) => row.textContent?.includes('Unavailable'))!;
    disabled.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(events).to.deep.equal([]);
    expect(ran).to.equal(0);
    expect(el.open).to.equal(true);
  });
});
