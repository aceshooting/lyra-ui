import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.class.js';

const trigger = (el: LyraLocalePicker) => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
const popup = (el: LyraLocalePicker) => el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;

async function openPicker(el: LyraLocalePicker): Promise<void> {
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => !popup(el).hidden && getComputedStyle(popup(el)).visibility === 'visible');
}

async function closePicker(el: LyraLocalePicker): Promise<void> {
  el.open = false;
  await el.updateComplete;
  await waitUntil(() => popup(el).hidden);
}

it('keeps an authoritative empty catalog uncommitted through open-menu navigation and Enter', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-locale-picker label="Language" name="language" required without-flags .locales=${[]}
      style="--lr-duration-base: 0ms"></lr-locale-picker></form>
  `);
  const el = form.querySelector<LyraLocalePicker>('lr-locale-picker')!;
  let changes = 0;
  el.addEventListener('lr-change', () => { changes++; });
  try {
    await focusByKeyboard(trigger(el));
    await openPicker(el);
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      await sendKeys({ press: key });
      await el.updateComplete;
      expect(el.open).to.equal(true);
      expect(trigger(el).getAttribute('aria-activedescendant') ?? '').to.equal('');
      expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
    }
    expect(el.value).to.equal('');
    expect(el.checkValidity()).to.equal(false);
    expect(new FormData(form).get('language')).to.equal('');
    expect(changes).to.equal(0);
    await expect(el).to.be.accessible();
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => !el.open);
    expect(el.value).to.equal('');
    expect(changes).to.equal(0);
  } finally {
    await closePicker(el);
  }
});

it('clears a typed search over an authoritative empty catalog before the next Escape closes', async () => {
  const el = await fixture<LyraLocalePicker>(html`
    <lr-locale-picker label="Language" searchable without-flags .locales=${[]}
      style="--lr-duration-base: 0ms"></lr-locale-picker>
  `);
  try {
    await focusByKeyboard(trigger(el));
    await sendKeys({ type: 'z' });
    await waitUntil(() => el.input?.value === 'z' && el.shadowRoot!.activeElement === el.input);
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
    expect(el.value).to.equal('');
    await sendKeys({ press: 'Escape' });
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expect(el.input!.value).to.equal('');
    expect(el.input!.hasAttribute('aria-activedescendant')).to.equal(false);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !el.open);
    expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
    expect(el.value).to.equal('');
  } finally {
    await closePicker(el);
  }
});

it('does not open or commit from a composing trigger key', async () => {
  const el = await fixture<LyraLocalePicker>(html`
    <lr-locale-picker label="Language" without-flags .locales=${['en', 'fr']}></lr-locale-picker>
  `);
  for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true, ...init });
    trigger(el).dispatchEvent(event);
    await el.updateComplete;
    expect(event.defaultPrevented).to.equal(false);
    expect(el.open).to.equal(false);
    expect(el.value).to.equal('');
  }
});
