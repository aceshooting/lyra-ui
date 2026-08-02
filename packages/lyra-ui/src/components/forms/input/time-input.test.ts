import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './time-input.js';
import type { LyraTimeInput } from './time-input.class.js';

const segment = (el: LyraTimeInput, name: string): HTMLElement =>
  el.shadowRoot!.querySelector(`[data-segment="${name}"]`)!;
const key = (target: Element, value: string, init: KeyboardEventInit = {}): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, composed: true, ...init }));
};
const paste = (target: Element, value: string): Event => {
  const event = new Event('paste', { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => type === 'text' ? value : '' },
  });
  target.dispatchEvent(event);
  return event;
};

describe('lr-time-input segmented field', () => {
  it('reflects the pinned Web Awesome positioning, format, and range properties', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    el.distance = 12;
    el.hourFormat = '24';
    el.min = '08:00';
    el.max = '18:00';
    el.placement = 'top-end';
    await el.updateComplete;

    expect(el.getAttribute('distance')).to.equal('12');
    expect(el.getAttribute('hour-format')).to.equal('24');
    expect(el.getAttribute('min')).to.equal('08:00');
    expect(el.getAttribute('max')).to.equal('18:00');
    expect(el.getAttribute('placement')).to.equal('top-end');
  });

  it('renders one locale-derived tab stop and preserves a canonical 24-hour value', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input label="Start time" locale="en-US" hour-format="12" value="23:04"></lr-time-input>`,
    );
    expect(el.value).to.equal('23:04');
    expect(segment(el, 'hour').textContent?.trim()).to.equal('11');
    expect(segment(el, 'minute').textContent?.trim()).to.equal('04');
    expect(segment(el, 'dayPeriod').textContent?.trim()).to.equal('PM');
    expect(el.shadowRoot!.querySelectorAll('[data-segment][tabindex="0"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });

  it('shows seconds only for a sub-minute numeric step', async () => {
    const minute = await fixture<LyraTimeInput>(html`<lr-time-input step="60"></lr-time-input>`);
    expect(minute.shadowRoot!.querySelector('[data-segment="second"]')).to.equal(null);
    const second = await fixture<LyraTimeInput>(html`<lr-time-input step="30" value="09:04:30"></lr-time-input>`);
    expect(segment(second, 'second').textContent?.trim()).to.equal('30');
    expect(second.value).to.equal('09:04:30');
  });

  it('fills segments with digits, auto-advances, and emits native plus compatibility events', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24"></lr-time-input>`);
    const seen: string[] = [];
    el.addEventListener('input', (event) => seen.push(event instanceof InputEvent ? 'input' : 'wrong'));
    el.addEventListener('change', (event) => seen.push(event instanceof Event ? 'change' : 'wrong'));
    el.addEventListener('lr-input', () => seen.push('lr-input'));
    el.addEventListener('lr-change', () => seen.push('lr-change'));
    segment(el, 'hour').focus();
    key(segment(el, 'hour'), '2');
    key(segment(el, 'hour'), '3');
    key(segment(el, 'minute'), '0');
    key(segment(el, 'minute'), '4');
    await el.updateComplete;
    expect(el.value).to.equal('23:04');
    expect(seen).to.include.members(['input', 'change', 'lr-input', 'lr-change']);
  });

  it('moves between segments with direction-aware arrows', async () => {
    const ltr = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24"></lr-time-input>`);
    segment(ltr, 'hour').focus();
    key(segment(ltr, 'hour'), 'ArrowRight');
    expect(ltr.shadowRoot!.activeElement).to.equal(segment(ltr, 'minute'));

    const rtl = await fixture<LyraTimeInput>(html`<lr-time-input dir="rtl" hour-format="24"></lr-time-input>`);
    segment(rtl, 'hour').focus();
    key(segment(rtl, 'hour'), 'ArrowLeft');
    expect(rtl.shadowRoot!.activeElement).to.equal(segment(rtl, 'minute'));
  });

  it('pastes a canonical time as one native-style edit and ignores invalid text', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24"></lr-time-input>`);
    let input: InputEvent | undefined;
    el.addEventListener('input', (event) => { input = event as InputEvent; });

    const accepted = paste(segment(el, 'hour'), ' 14:25 ');
    await el.updateComplete;
    expect(accepted.defaultPrevented).to.equal(true);
    expect(el.value).to.equal('14:25');
    expect(input?.inputType).to.equal('insertFromPaste');

    const rejected = paste(segment(el, 'minute'), 'tomorrow morning');
    expect(rejected.defaultPrevented).to.equal(false);
    expect(el.value).to.equal('14:25');
  });

  it('submits only complete values and restores the declarative default', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-time-input name="start" value="09:30" hour-format="24"></lr-time-input></form>
    `);
    const el = form.querySelector('lr-time-input') as LyraTimeInput;
    expect(new FormData(form).get('start')).to.equal('09:30');
    el.value = '11:45';
    form.reset();
    expect(el.value).to.equal('09:30');

    segment(el, 'hour').focus();
    key(segment(el, 'hour'), 'Backspace');
    expect(el.value).to.equal('');
    expect(new FormData(form).get('start')).to.equal('');
    expect(el.validity.badInput).to.equal(true);
  });

  it('participates through an external form owner and restores persisted state', async () => {
    const root = await fixture<HTMLDivElement>(html`
      <div>
        <form id="time-owner"></form>
        <lr-time-input form="time-owner" name="start" value="09:30"></lr-time-input>
      </div>
    `);
    const form = root.querySelector('form')!;
    const el = root.querySelector('lr-time-input') as LyraTimeInput;
    expect(el.getForm()).to.equal(form);
    expect(new FormData(form).get('start')).to.equal('09:30');

    el.formStateRestoreCallback('17:45', 'restore');
    await el.updateComplete;
    expect(el.value).to.equal('17:45');
    expect(segment(el, 'hour').textContent?.trim()).to.match(/^(17|5)$/);
    expect(new FormData(form).get('start')).to.equal('17:45');
  });

  it('validates required, ordinary/overnight ranges, and step grids', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input required min="22:00" max="06:00" step="300"></lr-time-input>`,
    );
    expect(el.validity.valueMissing).to.equal(true);
    el.value = '23:05';
    expect(el.checkValidity()).to.equal(true);
    el.value = '12:00';
    expect(el.checkValidity()).to.equal(false);
    el.value = '23:04';
    expect(el.validity.stepMismatch).to.equal(true);
  });

  it('accepts Date/null values and exposes local-clock valueAsDate/valueAsNumber getters', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    el.value = new Date(2026, 6, 15, 7, 8, 9);
    expect(el.value).to.equal('07:08:09');
    expect(el.valueAsNumber).to.equal((7 * 60 * 60 + 8 * 60 + 9) * 1000);
    expect(el.valueAsDate?.getHours()).to.equal(7);
    el.value = null;
    expect(el.value).to.equal('');
    expect(el.valueAsDate).to.equal(null);
  });

  it('relays focus and blur once when focus crosses the component boundary', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    const seen: string[] = [];
    el.addEventListener('focus', () => seen.push('focus'));
    el.addEventListener('lr-focus', () => seen.push('lr-focus'));
    el.addEventListener('blur', () => seen.push('blur'));
    el.addEventListener('lr-blur', () => seen.push('lr-blur'));
    el.focus();
    await el.updateComplete;
    el.blur();
    expect(seen).to.deep.equal(['focus', 'lr-focus', 'blur', 'lr-blur']);
  });
});

describe('lr-time-input popup and actions', () => {
  it('honors cancelable show/hide lifecycle events and settles after-events', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input style="--show-duration: 0.001ms; --hide-duration: 0.001ms"></lr-time-input>`,
    );
    el.addEventListener('lr-show', (event) => event.preventDefault(), { once: true });
    await el.show();
    expect(el.open).to.equal(false);

    const afterShow = oneEvent(el, 'lr-after-show');
    await el.show();
    await afterShow;
    expect(el.open).to.equal(true);

    el.addEventListener('lr-hide', (event) => event.preventDefault(), { once: true });
    await el.hide();
    expect(el.open).to.equal(true);
    const afterHide = oneEvent(el, 'lr-after-hide');
    await el.hide();
    await afterHide;
    expect(el.open).to.equal(false);
  });

  it('opens from Alt+ArrowDown and commits popup columns unless readonly', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" value="10:00"></lr-time-input>`);
    key(segment(el, 'hour'), 'ArrowDown', { altKey: true });
    await el.updateComplete;
    expect(el.open).to.equal(true);
    await expect(el).to.be.accessible();
    const hourNine = el.shadowRoot!.querySelector('[data-column="hour"][data-value="9"]') as HTMLButtonElement;
    hourNine.click();
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim()).to.equal('09');

    const readonly = await fixture<LyraTimeInput>(html`<lr-time-input readonly value="10:00"></lr-time-input>`);
    await readonly.show();
    (readonly.shadowRoot!.querySelector('[data-column="hour"][data-value="9"]') as HTMLButtonElement).click();
    expect(readonly.value).to.equal('10:00');
  });

  it('supports localized clear and now actions while a footer slot replaces the default now action', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input with-clear with-now value="09:30"></lr-time-input>`,
    );
    el.strings = { clear: 'Effacer', timeInputNow: 'Maintenant' };
    await el.updateComplete;
    const clear = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement;
    expect(clear.getAttribute('aria-label')).to.equal('Effacer');
    const cleared = oneEvent(el, 'lr-clear');
    clear.click();
    await cleared;
    expect(el.value).to.equal('');
    expect(el.shadowRoot!.querySelector('[part="now-button"]')?.textContent?.trim()).to.equal('Maintenant');

    const footer = await fixture<LyraTimeInput>(html`
      <lr-time-input with-now><button slot="footer">Custom footer</button></lr-time-input>
    `);
    expect(footer.shadowRoot!.querySelector('[part="now-button"]')).to.equal(null);
    expect(footer.shadowRoot!.querySelector('slot[name="footer"]')).not.to.equal(null);
  });

  it('forwards autocomplete to the hidden native autofill seam without double-submitting it', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-time-input name="start" autocomplete="bday" value="09:30"></lr-time-input></form>
    `);
    const el = form.querySelector('lr-time-input') as LyraTimeInput;
    const native = el.shadowRoot!.querySelector('input[data-autofill]') as HTMLInputElement;
    // Firefox normalizes unsupported/unknown autocomplete IDL tokens to an empty string even
    // while preserving the authored attribute; forwarding is the cross-engine contract here.
    expect(native.getAttribute('autocomplete')).to.equal('bday');
    expect(native.name).to.equal('');
    expect([...new FormData(form).entries()]).to.deep.equal([['start', '09:30']]);
  });
});
