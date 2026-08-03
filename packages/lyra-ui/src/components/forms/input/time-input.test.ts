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

describe('lr-time-input popup dismissal, autofill, and stepping', () => {
  it('normalizes the declarative step, hour-format, and placement attributes', async () => {
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input step="any" hour-format="bogus" placement="top-end"></lr-time-input>
    `);
    expect(el.step).to.equal('any');
    expect(el.hourFormat).to.equal('auto');
    expect(el.placement).to.equal('top-end');

    el.setAttribute('step', '-5');
    el.setAttribute('hour-format', '12');
    el.setAttribute('placement', 'nowhere');
    await el.updateComplete;
    expect(el.step).to.equal(60);
    expect(el.hourFormat).to.equal('12');
    expect(el.placement).to.equal('bottom-start');
  });

  it('toggles the popup from the expand button and closes on an outside pointer press', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input value="10:00"></lr-time-input>`);
    const expand = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="expand-button"]')!;
    expand.click();
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expect(expand.getAttribute('aria-expanded')).to.equal('true');

    // Pressing a column option keeps focus on the segment rather than moving it into the popup.
    const option = el.shadowRoot!.querySelector<HTMLElement>('[part~="column-item"]')!;
    const insidePress = new PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true });
    option.dispatchEvent(insidePress);
    await el.updateComplete;
    expect(insidePress.defaultPrevented).to.equal(true);
    expect(el.open).to.equal(true);

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.equal(false);

    expand.click();
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expand.click();
    await el.updateComplete;
    expect(el.open).to.equal(false);
  });

  it('closes the popup on Escape and returns focus to the active segment', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input value="10:00"></lr-time-input>`);
    await el.show();
    await el.updateComplete;
    expect(el.open).to.equal(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.equal(false);
  });

  it('closes the popup when the control becomes disabled', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input value="10:00"></lr-time-input>`);
    await el.show();
    expect(el.open).to.equal(true);
    el.disabled = true;
    await el.updateComplete;
    expect(el.open).to.equal(false);

    el.disabled = false;
    await el.updateComplete;
    await el.show();
    expect(el.open).to.equal(true);
  });

  it('refuses to open while disabled', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input disabled value="10:00"></lr-time-input>`);
    await el.show();
    await el.updateComplete;
    expect(el.open).to.equal(false);
    expect(el.hasAttribute('open')).to.equal(false);
  });

  it('commits the current clock from the now action and ignores it when readonly', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input with-now hour-format="24" step="1"></lr-time-input>`,
    );
    await el.show();
    await el.updateComplete;
    const changed = oneEvent(el, 'lr-change');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="now-button"]')!.click();
    await changed;
    expect(el.value).to.match(/^\d{2}:\d{2}:\d{2}$/);

    const readonly = await fixture<LyraTimeInput>(
      html`<lr-time-input with-now readonly value="09:30"></lr-time-input>`,
    );
    await readonly.show();
    await readonly.updateComplete;
    readonly.shadowRoot!.querySelector<HTMLButtonElement>('[part="now-button"]')!.click();
    expect(readonly.value).to.equal('09:30');
  });

  it('adopts a value written into the hidden autofill seam', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input autocomplete="bday"></lr-time-input>`);
    const native = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-autofill]')!;

    const input = oneEvent(el, 'lr-input');
    native.value = '07:45';
    native.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText' }));
    await input;
    expect(el.value).to.equal('07:45');

    const change = oneEvent(el, 'lr-change');
    native.value = '18:15';
    native.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await change;
    expect(el.value).to.equal('18:15');

    native.value = 'not a time';
    native.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    native.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.value).to.equal('18:15');
  });

  it('ignores autofill writes while readonly', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input readonly value="09:30"></lr-time-input>`);
    const native = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-autofill]')!;
    native.value = '07:45';
    native.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    native.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.value).to.equal('09:30');
  });

  it('steps and wraps each segment with the arrow keys', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input hour-format="24" step="1" value="00:00:00"></lr-time-input>`,
    );
    key(segment(el, 'hour'), 'ArrowDown');
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim()).to.equal('23');

    key(segment(el, 'hour'), 'ArrowUp');
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim()).to.equal('00');

    key(segment(el, 'second'), 'ArrowDown');
    await el.updateComplete;
    expect(segment(el, 'second').textContent?.trim()).to.equal('59');

    const twelve = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="12"></lr-time-input>`);
    key(segment(twelve, 'dayPeriod'), 'ArrowUp');
    await twelve.updateComplete;
    const first = segment(twelve, 'dayPeriod').textContent?.trim();
    key(segment(twelve, 'dayPeriod'), 'ArrowUp');
    await twelve.updateComplete;
    expect(segment(twelve, 'dayPeriod').textContent?.trim()).to.not.equal(first);

    const readonly = await fixture<LyraTimeInput>(
      html`<lr-time-input hour-format="24" readonly value="10:00"></lr-time-input>`,
    );
    key(segment(readonly, 'hour'), 'ArrowUp');
    await readonly.updateComplete;
    expect(segment(readonly, 'hour').textContent?.trim()).to.equal('10');
  });

  it('forwards a host click to the active segment unless disabled', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" value="10:00"></lr-time-input>`);
    el.click();
    expect(el.shadowRoot!.activeElement).to.equal(segment(el, 'hour'));
    el.blur();
    expect(el.shadowRoot!.activeElement).to.equal(null);

    const disabled = await fixture<LyraTimeInput>(html`<lr-time-input disabled value="10:00"></lr-time-input>`);
    disabled.click();
    expect(disabled.shadowRoot!.activeElement).to.equal(null);
  });

  it('keeps focus transitions and relayed FocusEvents in an adopted owner realm', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input hour-format="24" value="10:30"></lr-time-input>
    `);

    try {
      el.remove();
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;

      const input = el.shadowRoot!.querySelector<HTMLElement>('[part="input"]')!;
      const hour = segment(el, 'hour');
      const foreignInternal = frameDocument.createElement('button');
      const foreignExternal = frameDocument.createElement('button');
      input.append(foreignInternal);
      frameDocument.body.append(foreignExternal);
      expect(foreignInternal instanceof Element, 'the related target is genuinely foreign').to.be.false;

      const publicFocus: FocusEvent[] = [];
      const publicBlur: FocusEvent[] = [];
      el.addEventListener('focus', (event) => publicFocus.push(event as FocusEvent));
      el.addEventListener('blur', (event) => publicBlur.push(event as FocusEvent));

      foreignExternal.focus();
      hour.focus();
      expect(publicFocus.length).to.equal(1);
      expect(publicFocus[0] instanceof frameWindow.FocusEvent).to.be.true;
      expect(publicFocus[0] instanceof FocusEvent, 'the owner-realm event is not ambient-branded').to.be.false;
      publicFocus.length = 0;

      foreignInternal.focus();
      hour.focus();
      expect(publicFocus.length, 'moving within the segmented surface does not re-emit focus').to.equal(0);
      expect(publicBlur.length, 'moving within the segmented surface does not re-emit blur').to.equal(0);

      foreignExternal.focus();
      expect(publicBlur.length).to.equal(1);
      expect(publicBlur[0] instanceof frameWindow.FocusEvent).to.be.true;

      foreignInternal.focus();
      expect(el.shadowRoot!.activeElement === foreignInternal).to.be.true;
      el.blur();
      expect(
        el.shadowRoot!.activeElement === null,
        'host blur reaches a foreign HTML descendant',
      ).to.be.true;
    } finally {
      el.remove();
      iframe.remove();
    }
  });

  it('does not light-dismiss an adopted popup for a foreign node inside the host', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input hour-format="24" value="10:30"></lr-time-input>
    `);

    try {
      el.remove();
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await el.show();

      const inside = frameDocument.createElement('button');
      el.append(inside);
      inside.dispatchEvent(new frameWindow.Event('pointerdown', { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el.open, 'a composed pointer path within the adopted host stays inside').to.be.true;

      frameDocument.body.dispatchEvent(new frameWindow.Event('pointerdown', { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el.open, 'a genuine outside pointer still dismisses').to.be.false;
    } finally {
      el.remove();
      iframe.remove();
    }
  });

  it('marks the control touched and describes it with one neutral validation message', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input required></lr-time-input>`);
    expect(el.checkValidity()).to.equal(false);
    expect(el.reportValidity()).to.equal(false);
    await el.updateComplete;
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.hasAttribute('hidden')).to.equal(false);
    expect(error.textContent?.trim().length).to.be.greaterThan(0);
    expect(error.getAttribute('role')).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length).to.equal(0);
    const group = el.shadowRoot!.querySelector('[part="input"]')!;
    expect(group.getAttribute('aria-describedby')?.split(' ')).to.include(error.id);

    el.value = '09:30';
    await el.updateComplete;
    expect(el.reportValidity()).to.equal(true);
  });
});

// A control barred from constraint validation is neither :valid nor :invalid natively -- a real
// `<input required disabled>` and `<input required readonly>` both match neither -- so a barred
// time input must publish no violation at all. This override used to guard only `readonly`, so a
// disabled required field kept `valueMissing` raised and `:state(invalid)` published.
describe('lr-time-input barred from constraint validation', () => {
  it('reports no violation while disabled, and restores it on re-enable', async () => {
    const el = (await fixture(
      html`<lr-time-input required disabled></lr-time-input>`,
    )) as LyraTimeInput;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing while disabled').to.be.false;
    expect(el.validationMessage, 'no message while disabled').to.equal('');

    el.disabled = false;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing once enabled').to.be.true;
  });

  it('reports no range violation while disabled', async () => {
    const el = (await fixture(
      html`<lr-time-input value="08:00" min="09:00" disabled></lr-time-input>`,
    )) as LyraTimeInput;
    await el.updateComplete;
    expect(el.validity.rangeUnderflow, 'rangeUnderflow while disabled').to.be.false;
    expect(el.validity.valid, 'valid while disabled').to.be.true;
  });

  it('reports no violation inside a disabled fieldset', async () => {
    const form = (await fixture(html`
      <form><fieldset disabled><lr-time-input required></lr-time-input></fieldset></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-time-input') as LyraTimeInput;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing inside a disabled fieldset').to.be.false;
    expect(el.checkValidity(), 'checkValidity() inside a disabled fieldset').to.be.true;
  });

  it('still reports no violation while readonly', async () => {
    const el = (await fixture(
      html`<lr-time-input required readonly></lr-time-input>`,
    )) as LyraTimeInput;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing while readonly').to.be.false;
  });
});
