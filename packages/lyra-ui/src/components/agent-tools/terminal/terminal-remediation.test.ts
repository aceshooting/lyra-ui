import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './terminal.js';
import type { LyraTerminal } from './terminal.js';

it('clears rendered match markers when a later query has no matches', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal content="error: first&#10;info: next"></lr-terminal>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  expect(await el.search('error')).to.equal(1);
  await waitUntil(() => list.shadowRoot!.querySelectorAll('[data-match="active"]').length === 1);
  expect(await el.search('missing')).to.equal(0);
  await waitUntil(() => list.shadowRoot!.querySelectorAll('[data-match]').length === 0, 'old search markers should be removed');
  expect(list.shadowRoot!.querySelectorAll('[part~="line-active-match"]').length).to.equal(0);
  expect(await el.searchNext()).to.equal(false);
  expect(await el.search('info')).to.equal(1);
  await waitUntil(() => list.shadowRoot!.querySelector('[data-line-number="2"]')?.getAttribute('data-match') === 'active');
  el.clearSearch();
  await el.updateComplete;
  await waitUntil(() => list.shadowRoot!.querySelectorAll('[data-match]').length === 0);
});

it('clears removed content while retaining normal null and explicit-empty readback', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal content="Before"></lr-terminal>`);
  el.removeAttribute('content');
  await el.updateComplete;
  expect(el.content).to.equal(null);
  expect(el.getPlainText()).to.equal('');
  el.setAttribute('content', '');
  await el.updateComplete;
  expect(el.content).to.equal('');
  el.setAttribute('content', 'After');
  await el.updateComplete;
  expect(el.getPlainText()).to.equal('After');
});
