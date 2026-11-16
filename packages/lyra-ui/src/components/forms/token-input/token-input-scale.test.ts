import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './token-input.js';
import type { LyraTokenInput } from './token-input.js';
const tokens = Array.from({ length: 1000 }, (_, index) => `Token ${index}`);
async function settle(el: LyraTokenInput) { await el.updateComplete; await nextFrame(); await el.updateComplete; }
it('leaves the token window unlimited when unset', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input label="Tokens" .value=${tokens}></lr-token-input>`);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(1000);
});
it('bounds token markup and preserves keyed survivors on removal', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input label="Tokens" max-tokens-visible="10" .value=${tokens}></lr-token-input>`);
  await settle(el);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(10);
  expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).contain('990');
  const second = el.shadowRoot!.querySelectorAll('[part="token"]')[1]!;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove"]')!.click(); await settle(el);
  expect(el.value[0]).equal('Token 1');
  expect(el.shadowRoot!.querySelector('[part="token"]') === second).equal(true);
  recordScaleMeasurement('lr-token-input', 'n=1000 capped remove', { mountedTokens: el.shadowRoot!.querySelectorAll('[part="token"]').length });
});
it('keeps keyboard destinations visible in an editable token window', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input label="Tokens" editable max-tokens-visible="4" .value=${tokens}></lr-token-input>`);
  await settle(el);
  el.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await settle(el);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(4);
  expect(el.shadowRoot!.activeElement?.textContent).equal('Token 999');
});
it('localizes overflow and retains the full value in a disabled capped control', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input label="Tokens" disabled max-tokens-visible="2"
    .strings=${{ selectSelectedOverflow: '{n} hidden tokens' }} .value=${tokens}></lr-token-input>`);
  await settle(el);
  expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).contain('998 hidden tokens');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove"]')?.click(); await settle(el);
  expect(el.value.length).equal(1000);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(2);
});

it('retains a focused remove action through a new token cap and repairs it after a controlled shrink', async () => {
  const values = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-token-input label="Tokens" name="tokens" .value=${values}
      .strings=${{ selectSelectedOverflow: '{n} hidden tokens', removeWithContext: 'Remove {label}' }}></lr-token-input></form>
  `);
  const el = form.querySelector('lr-token-input')!;
  const events: string[] = [];
  for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));
  const remove = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="remove"]')[4]!;
  await focusByKeyboard(remove);
  expect(el.shadowRoot!.activeElement === remove).equal(true);

  el.maxTokensVisible = 2;
  await settle(el);

  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(2);
  expect(el.shadowRoot!.activeElement === remove, 'the focused tail survives the new window').equal(true);
  expect(remove.isConnected).equal(true);
  expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).contain('3 hidden tokens');
  expect(new FormData(form).getAll('tokens')).deep.equal(values);

  el.value = values.slice(0, 3);
  await settle(el);

  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(2);
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).equal('remove');
  expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).equal('Remove Charlie');
  expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).contain('1 hidden tokens');
  expect(new FormData(form).getAll('tokens')).deep.equal(['Alpha', 'Bravo', 'Charlie']);
  expect(events).deep.equal([]);
});
