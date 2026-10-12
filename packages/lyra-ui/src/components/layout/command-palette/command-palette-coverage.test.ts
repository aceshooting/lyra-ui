import { expect, fixture, html } from '@open-wc/testing';
import type { LyraCommandPalette } from './command-palette.class.js';
import './command-palette.js';

it('fails closed when a revoked public command collection is read and recovers on reassignment', async () => {
  const el = (await fixture(html`<lr-command-palette></lr-command-palette>`)) as LyraCommandPalette;
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  el.commands = revoked.proxy as unknown as typeof el.commands;
  el.openPalette();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part~="command"]').length).to.equal(0);

  el.commands = [{ commandId: 'recovered', label: 'Recovered command' }];
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="command"]');
  expect(rows.length).to.equal(1);
  expect(rows[0]!.textContent).to.include('Recovered command');
});
