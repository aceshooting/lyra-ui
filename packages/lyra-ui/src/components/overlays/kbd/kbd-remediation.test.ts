import { fixture, expect, html } from '@open-wc/testing';
import './kbd.js';
import type { LyraKbd } from './kbd.js';
import { shortcutTokenLabel } from './kbd.class.js';

it('safely removes keys and restores later shortcut rendering', async () => {
  const el = await fixture<LyraKbd>(html`<lr-kbd keys="Ctrl+K"></lr-kbd>`);
  el.removeAttribute('keys');
  await el.updateComplete;
  expect(el.keys === null).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(0);
  el.keys = '';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(0);
  el.keys = 'Ctrl+P';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(2);
});

for (const token of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
  it(`renders and names the unknown token ${token} verbatim`, async () => {
    const el = await fixture<LyraKbd>(html`<lr-kbd .keys=${token}></lr-kbd>`);
    expect(el.shadowRoot!.querySelector('[part="key"]')?.textContent).to.equal(token);
    expect(el.shadowRoot!.querySelector('[role="img"]')?.getAttribute('aria-label')).to.equal(token);
    expect(shortcutTokenLabel(token, false)).to.deep.equal({ visual: token, word: token });
  });
}
