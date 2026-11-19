import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html } from '@open-wc/testing';
import './chat-composer.js';

it('yields modified Enter and submits only once for held Enter', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-chat-composer']>(document.createElement('lr-chat-composer'));
  el.value = 'draft';
  await el.updateComplete;
  let submissions = 0;
  el.addEventListener('lr-submit', () => submissions++);
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
    const key = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...modifier });
    el.input!.dispatchEvent(key);
    expect(key.defaultPrevented).to.equal(false);
  }
  el.input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  el.input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true }));
  expect(submissions).to.equal(1);
});

it('returns null for every selection endpoint before the first render', () => {
  const el = document.createElement('lr-chat-composer');
  el.select();
  el.setSelectionRange(0, 1, 'backward');
  expect([el.selectionStart, el.selectionEnd, el.selectionDirection]).to.deep.equal([null, null, null]);
});

it('consumes a repeated submit key without adding a newline or emitting a second submission', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-chat-composer']>(document.createElement('lr-chat-composer'));
  el.value = 'draft';
  await el.updateComplete;
  let count = 0;
  el.addEventListener('lr-submit', () => count++);
  el.input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  const repeat = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, cancelable: true });
  el.input!.dispatchEvent(repeat);
  expect(repeat.defaultPrevented).to.equal(true);
  expect(count).to.equal(1);
});

it('falls back to a localized name for whitespace-only overrides', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-chat-composer']>(html`<lr-chat-composer
    aria-label="  " placeholder="   " .strings=${{ composerLabel: 'Localized name' }}></lr-chat-composer>`);
  expect(el.shadowRoot!.querySelector('textarea')!.getAttribute('aria-label')).to.equal('Localized name');
  el.setAttribute('aria-label', '  Named control  ');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('textarea')!.getAttribute('aria-label')?.trim()).to.equal('Named control');
});

it('themes its focused border independently of the resting border', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-chat-composer']>(html`<lr-chat-composer data-lr-theme-scope
    style="--lr-transition-fast:0s; --lr-chat-composer-border-color:rgb(1, 2, 3); --lr-chat-composer-focus-border-color:rgb(4, 5, 6)"></lr-chat-composer>`);
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(getComputedStyle(base).borderTopColor).to.equal('rgb(1, 2, 3)');
  await focusByKeyboard(el.input!);
  expect(getComputedStyle(base).borderTopColor).to.equal('rgb(4, 5, 6)');
});

it('restores its default for blank max-rows and honors explicit numbers', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-chat-composer']>(html`<lr-chat-composer max-rows=" "></lr-chat-composer>`);
  expect(el.maxRows).to.equal(8);
  el.setAttribute('max-rows', '3');
  await el.updateComplete;
  expect(el.maxRows).to.equal(3);
  el.removeAttribute('max-rows');
  await el.updateComplete;
  expect(el.maxRows).to.equal(8);
});

it('fits its textarea on reconnect after the first render finishes detached', async () => {
  const parent = await fixture<HTMLElement>(html`<div style="inline-size: 200px"></div>`);
  const el = document.createElement('lr-chat-composer');
  el.value = 'A long draft '.repeat(40);
  parent.append(el);
  el.remove();
  await el.updateComplete;
  expect(el.isConnected).to.equal(false);
  parent.append(el);
  expect(el.input!.getBoundingClientRect().height).to.be.greaterThan(40);
});
