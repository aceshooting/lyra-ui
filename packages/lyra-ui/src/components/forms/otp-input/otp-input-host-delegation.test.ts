import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-otp-input.js';
import type { LyraOtpInput } from './otp-input.class.js';

const controlOf = (el: LyraOtpInput): HTMLInputElement =>
  el.shadowRoot!.querySelector<HTMLInputElement>('[part="control"]')!;

describe('lr-otp-input host delegation', () => {
  it('forwards a host click to the enabled native control', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
    let clicks = 0;
    controlOf(el).addEventListener('click', () => { clicks += 1; });
    el.click();
    expect(clicks).to.equal(1);
  });

  it('ignores a paste without clipboard data while still owning the paste', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4" value="12"></lr-otp-input>`);
    let inputs = 0;
    el.addEventListener('input', () => { inputs += 1; });
    const event = new Event('paste', { bubbles: true, composed: true, cancelable: true });
    controlOf(el).dispatchEvent(event);
    await el.updateComplete;
    expect(event.defaultPrevented, 'the native paste is suppressed').to.equal(true);
    expect(el.value).to.equal('12');
    expect(inputs).to.equal(0);
  });
});

const key = (el: LyraOtpInput, value: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, composed: true, cancelable: true, ...init });
  controlOf(el).dispatchEvent(event);
  return event;
};

describe('lr-otp-input short paste', () => {
  it('fills only the leading cells from a paste shorter than the code', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
    const event = new Event('paste', { bubbles: true, composed: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => (type === 'text' ? '9-8' : '') } });
    controlOf(el).dispatchEvent(event);
    await el.updateComplete;
    expect(el.value).to.equal('98');
  });
});

describe('lr-otp-input keyboard guards', () => {
  it('leaves modifier chords to the platform and swallows rejected characters', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
    expect(key(el, 'v', { ctrlKey: true }).defaultPrevented, 'a paste shortcut stays native').to.equal(false);
    expect(key(el, '5', { metaKey: true }).defaultPrevented).to.equal(false);
    expect(key(el, 'x').defaultPrevented, 'a rejected character is not typed natively').to.equal(true);
    await el.updateComplete;
    expect(el.value).to.equal('');
    key(el, '7');
    await el.updateComplete;
    expect(el.value).to.equal('7');
  });

  it('drops a pending autosubmit when the code changes before it runs', async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <lr-otp-input name="code" label="Code" length="2" autosubmit></lr-otp-input>
      <button type="submit">Go</button>
    </form>`);
    const el = form.querySelector<LyraOtpInput>('lr-otp-input')!;
    let submits = 0;
    form.addEventListener('submit', (event) => { event.preventDefault(); submits += 1; });

    key(el, '1');
    key(el, '2');
    el.value = '1';
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(submits).to.equal(0);

    key(el, '3');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(el.value).to.equal('13');
    expect(submits).to.equal(1);
  });
});

describe('lr-otp-input active ring', () => {
  it('draws the active segment ring inside the segment so the scrolling row cannot clip it', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
    controlOf(el).focus();
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector<HTMLElement>('[part~="active"]')!;
    expect(getComputedStyle(active).boxShadow).to.contain('inset');
  });
});
