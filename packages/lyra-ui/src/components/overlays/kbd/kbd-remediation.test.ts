import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-kbd.js';
import type { LyraKbd } from '../../lr-kbd.js';
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

it('keeps the shortcut sequence left to right while custom content inherits its direction', async () => {
  const el = await fixture<LyraKbd>(html`<lr-kbd dir="rtl" keys="ctrl+k"></lr-kbd>`);
  const keys = el.shadowRoot!.querySelectorAll('[part="key"]');
  expect(keys[0]!.getBoundingClientRect().left).to.be.lessThan(keys[1]!.getBoundingClientRect().left);
  el.textContent = 'مفتاح';
  await el.updateComplete;
  expect(getComputedStyle(el).direction).to.equal('rtl');
});

it('localizes the spoken shortcut separator independently of the printed chord', async () => {
  const el = await fixture<LyraKbd>(html`<lr-kbd keys="ctrl+k" .strings=${{ kbdShortcutSeparator: ' plus ' }}></lr-kbd>`);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Control plus K');
  expect(el.shadowRoot!.querySelector('.sep')!.textContent).to.equal('+');
});
