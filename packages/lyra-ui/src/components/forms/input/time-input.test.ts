import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
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
  it('completes its open-state first update on an SSR-shaped host without Element.matches()', async () => {
    const container = await fixture<HTMLDivElement>(html`<div></div>`);
    const el = container.ownerDocument.createElement('lr-time-input') as LyraTimeInput;
    Object.defineProperty(el, 'matches', {
      configurable: true,
      value: undefined,
    });

    expect(typeof (el as unknown as { matches?: unknown }).matches).to.equal('undefined');
    // Lit's server element shim applies the public state before the first render, but does not
    // implement the browser-only selector predicate. Keep this order: setting `open` is the path
    // that consults live disabled state before the source component's first update.
    el.setAttribute('open', '');
    container.append(el);
    await el.updateComplete;

    expect(el.hasUpdated).to.equal(true);
    expect(el.open).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part~="time-input"]')).to.exist;
  });

  it('inherits component-scoped gap and radius hooks across size and pill fallbacks', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="--lr-time-input-gap: 13px; --lr-time-input-radius: 17px">
        <lr-time-input size="2xs" pill value="10:00"></lr-time-input>
      </div>
    `);
    const el = wrapper.querySelector('lr-time-input') as LyraTimeInput;
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="time-input"]')!;
    expect(getComputedStyle(row).gap).to.equal('13px');
    expect(getComputedStyle(row).borderRadius).to.equal('17px');
  });

  it('uses scoped open and selected-option paint inherited from an ancestor', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div
        style="
          --lr-time-input-focus-border-color: rgb(1, 2, 3);
          --lr-time-input-column-selected-bg: rgb(4, 5, 6);
          --lr-time-input-column-selected-color: rgb(7, 8, 9);
          --lr-time-input-column-selected-font-weight: 350;
        "
      >
        <lr-time-input value="10:00"></lr-time-input>
      </div>
    `);
    const el = wrapper.querySelector('lr-time-input') as LyraTimeInput;
    await el.show();
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="time-input"]')!;
    const selected = el.shadowRoot!.querySelector<HTMLElement>('[part~="column-item-selected"]')!;
    expect(getComputedStyle(row).borderTopColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(selected).backgroundColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(selected).color).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(selected).fontWeight).to.equal('350');
  });

  it('keeps picker-bearing rows on the shared hit-floor-aware height ladder', async () => {
    const expected: Record<string, number> = { '2xs': 42, xs: 42, s: 42, m: 42, l: 48, xl: 56 };
    for (const [size, height] of Object.entries(expected)) {
      const el = await fixture<LyraTimeInput>(html`<lr-time-input size=${size} value="10:00"></lr-time-input>`);
      const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="time-input"]')!;
      expect(row.getBoundingClientRect().height, `size=${size}`).to.equal(height);
    }
  });

  it('contains a long RTL open-seconds composition in an exact 320px allocation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 320px">
        <lr-time-input
          open
          step="15"
          value="10:00:15"
          label="InternationalizedUnbrokenAppointmentLabelThatMustRemainInsideTheAllocation"
          hint="Supporting copy wraps within the same narrow allocation."
        ></lr-time-input>
      </div>
    `);
    const el = wrapper.querySelector('lr-time-input') as LyraTimeInput;
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector<HTMLElement>('[part~="form-control-label"]')!;
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
    expect(el.getBoundingClientRect().width).to.be.at.most(wrapper.getBoundingClientRect().width);
    expect(label.getBoundingClientRect().width).to.be.at.most(wrapper.getBoundingClientRect().width);
  });

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
    expect((minute.shadowRoot!.querySelector('[data-segment="second"]')) === (null)).to.equal(true);
    const second = await fixture<LyraTimeInput>(html`<lr-time-input step="30" value="09:04:30"></lr-time-input>`);
    expect(segment(second, 'second').textContent?.trim()).to.equal('30');
    expect(second.value).to.equal('09:04:30');
  });

  it('accepts active-locale digits and localizes range placeholders through the segment presentation', async () => {
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input locale="ar-EG" hour-format="24" min="13:45"></lr-time-input>
    `);
    key(segment(el, 'hour'), '١');
    key(segment(el, 'hour'), '٢');
    key(segment(el, 'minute'), '٣');
    key(segment(el, 'minute'), '٠');
    await el.updateComplete;

    expect(el.value).to.equal('12:30');
    expect(segment(el, 'hour').textContent?.trim()).to.equal('١٢');
    expect(segment(el, 'minute').textContent?.trim()).to.equal('٣٠');
    expect(el.validity.rangeUnderflow).to.equal(true);
    expect(el.validationMessage).to.include('١٣:٤٥');
    expect(el.validationMessage).not.to.include('13:45');
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
    expect((ltr.shadowRoot!.activeElement) === (segment(ltr, 'minute'))).to.equal(true);

    const rtl = await fixture<LyraTimeInput>(html`<lr-time-input dir="rtl" hour-format="24"></lr-time-input>`);
    segment(rtl, 'hour').focus();
    key(segment(rtl, 'hour'), 'ArrowLeft');
    expect((rtl.shadowRoot!.activeElement) === (segment(rtl, 'minute'))).to.equal(true);
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
    expect((el.getForm()) === (form)).to.equal(true);
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

  it('publishes a WA-compatible static validators catalog observing the intrinsic constraint attributes', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input required></lr-time-input>`);
    const ctor = customElements.get('lr-time-input') as unknown as {
      validators: Array<{
        observedAttributes?: string[];
        checkValidity: (element: LyraTimeInput) => { isValid: boolean; message: string; invalidKeys: string[] };
      }>;
    };
    const catalog = ctor.validators;
    expect(catalog).to.have.lengthOf(1);
    expect(catalog[0]!.observedAttributes).to.deep.equal(['required', 'disabled', 'readonly', 'value', 'min', 'max', 'step']);

    let result = catalog[0]!.checkValidity(el);
    expect(result.isValid).to.equal(false);
    expect(result.invalidKeys).to.include('valueMissing');
    expect(result.message).to.equal(el.validationMessage);

    el.value = '09:30';
    result = catalog[0]!.checkValidity(el);
    expect(result.isValid).to.equal(true);
    expect(result.message).to.equal('');
  });

  it('matches native time step-base precedence through live values, invalid bases, and reset', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <input type="time" value="00:00:30" step="60">
        <lr-time-input value="00:00:30" step="60"></lr-time-input>
      </form>
    `);
    const native = form.querySelector('input')!;
    const el = form.querySelector('lr-time-input') as LyraTimeInput;
    native.value = '00:01:30';
    el.value = '00:01:30';
    expect(el.validity.stepMismatch).to.equal(native.validity.stepMismatch).and.to.equal(false);

    native.min = '00:00:15';
    el.min = '00:00:15';
    await el.updateComplete;
    expect(el.validity.stepMismatch).to.equal(native.validity.stepMismatch).and.to.equal(true);
    native.min = 'invalid';
    el.min = 'invalid';
    await el.updateComplete;
    expect(el.validity.stepMismatch).to.equal(native.validity.stepMismatch).and.to.equal(false);

    form.reset();
    expect(el.value).to.equal(native.value).and.to.equal('00:00:30');
    expect(el.validity.stepMismatch).to.equal(native.validity.stepMismatch).and.to.equal(false);
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

  it('relays focus and blur once when focus crosses the component boundary, and never lr-focus/lr-blur', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    const seen: string[] = [];
    el.addEventListener('focus', () => seen.push('focus'));
    el.addEventListener('lr-focus', () => seen.push('lr-focus'));
    el.addEventListener('blur', () => seen.push('blur'));
    el.addEventListener('lr-blur', () => seen.push('lr-blur'));
    el.focus();
    await el.updateComplete;
    el.blur();
    // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
    expect(seen).to.deep.equal(['focus', 'blur']);
  });

  it('rejects host focus while directly or fieldset disabled without relaying focus events', async () => {
    const direct = await fixture<LyraTimeInput>(html`<lr-time-input disabled value="10:00"></lr-time-input>`);
    const form = await fixture<HTMLFormElement>(html`
      <form><fieldset><lr-time-input value="10:00"></lr-time-input></fieldset></form>
    `);
    const inherited = form.querySelector('lr-time-input') as LyraTimeInput;
    (form.querySelector('fieldset') as HTMLFieldSetElement).disabled = true;

    for (const el of [direct, inherited]) {
      const seen: string[] = [];
      el.addEventListener('focus', () => seen.push('focus'));
      el.focus();
      await el.updateComplete;
      expect(el.shadowRoot!.activeElement === null).to.equal(true);
      expect(seen).to.deep.equal([]);
    }
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
    // `[part='popup']`'s opacity transition (via [data-hidden] removal) is still running right
    // after `open` becomes true and the update settles. Left running, axe's color-contrast check
    // factors in the popup's current (transitional) opacity, so sampling mid-fade blends its text
    // and background toward each other and reports a false "serious" violation. Finishing it
    // outright matches the idiom overlay.test.ts already uses for this same kind of reveal
    // animation.
    el.shadowRoot!.querySelector('[part="popup"]')?.getAnimations().forEach((animation) => animation.finish());
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

  it('provides one roving option per popup column with Arrow, Home, End, and native activation', async () => {
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input hour-format="24" value="10:05"></lr-time-input>
    `);
    await el.show();
    await el.updateComplete;
    const selected = el.shadowRoot!
      .querySelector<HTMLButtonElement>('[data-column="minute"][aria-selected="true"]')!;
    const column = selected.closest<HTMLElement>('[role="listbox"]')!;
    expect(column.querySelectorAll('[role="option"][tabindex="0"]')).to.have.length(1);

    selected.focus();
    key(selected, 'ArrowDown');
    const next = el.shadowRoot!.activeElement as HTMLButtonElement;
    expect(next.dataset['value']).to.equal('6');
    expect(column.querySelectorAll('[role="option"][tabindex="0"]')).to.have.length(1);

    key(next, 'End');
    const last = el.shadowRoot!.activeElement as HTMLButtonElement;
    expect(last.dataset['value']).to.equal('59');
    key(last, 'Home');
    const first = el.shadowRoot!.activeElement as HTMLButtonElement;
    expect(first.dataset['value']).to.equal('0');
    expect(first.localName).to.equal('button');
    expect(first.type).to.equal('button');
    first.click();
    await el.updateComplete;
    expect(el.value).to.equal('10:00');
    expect(el.shadowRoot!.activeElement === segment(el, 'minute')).to.be.true;
  });

  it('roves a popup column backward with ArrowUp, wrapping from the first option to the last', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" value="10:05"></lr-time-input>`);
    await el.show();
    await el.updateComplete;
    const selected = el.shadowRoot!
      .querySelector<HTMLButtonElement>('[data-column="minute"][aria-selected="true"]')!;
    selected.focus();
    key(selected, 'ArrowUp');
    const previous = el.shadowRoot!.activeElement as HTMLButtonElement;
    expect(previous.dataset['value']).to.equal('4');

    key(previous, 'Home');
    const first = el.shadowRoot!.activeElement as HTMLButtonElement;
    key(first, 'ArrowUp');
    const wrapped = el.shadowRoot!.activeElement as HTMLButtonElement;
    expect(wrapped.dataset['value'], 'ArrowUp from the first option wraps to the last').to.equal('59');
  });

  it('ignores popup column keydowns while disabled and for keys outside the roving set', async () => {
    const disabled = await fixture<LyraTimeInput>(
      html`<lr-time-input disabled hour-format="24" value="10:05"></lr-time-input>`,
    );
    const option = disabled.shadowRoot!.querySelector<HTMLButtonElement>('[role="option"]')!;
    key(option, 'ArrowDown');
    expect(disabled.shadowRoot!.activeElement === null, 'no focus change while disabled').to.equal(true);

    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" value="10:05"></lr-time-input>`);
    await el.show();
    await el.updateComplete;
    const selected = el.shadowRoot!
      .querySelector<HTMLButtonElement>('[data-column="minute"][aria-selected="true"]')!;
    selected.focus();
    key(selected, 'a');
    expect(
      el.shadowRoot!.activeElement === selected,
      'a key outside Arrow/Home/End leaves focus and the roving tab stop untouched',
    ).to.equal(true);
  });

  it('derives offset, hourly, multi-hour, and overnight popup options from the full valid grid', async () => {
    const offset = await fixture<LyraTimeInput>(html`
      <lr-time-input hour-format="24" step="600" min="00:05" value="00:05"></lr-time-input>
    `);
    const optionValues = (el: LyraTimeInput, name: string): number[] =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[data-column="${name}"]`)]
        .map((option) => Number(option.dataset['value']));
    expect(optionValues(offset, 'minute')).to.deep.equal([5, 15, 25, 35, 45, 55]);
    expect(offset.shadowRoot!.querySelector('[data-column="minute"][data-value="5"][aria-selected="true"]')).to.exist;

    const hourly = await fixture<LyraTimeInput>(html`
      <lr-time-input hour-format="24" step="3600" min="00:30" value="03:30"></lr-time-input>
    `);
    expect(optionValues(hourly, 'minute')).to.deep.equal([30]);
    expect(optionValues(hourly, 'hour')).to.deep.equal(Array.from({ length: 24 }, (_, hour) => hour));

    const multiHour = await fixture<LyraTimeInput>(html`
      <lr-time-input hour-format="24" step="7200" min="00:30" value="04:30"></lr-time-input>
    `);
    expect(optionValues(multiHour, 'minute')).to.deep.equal([30]);
    expect(optionValues(multiHour, 'hour')).to.deep.equal(Array.from({ length: 12 }, (_, index) => index * 2));

    const overnight = await fixture<LyraTimeInput>(html`
      <lr-time-input
        hour-format="24"
        step="3600"
        min="22:30"
        max="06:30"
        value="23:30"
      ></lr-time-input>
    `);
    expect(optionValues(overnight, 'minute')).to.deep.equal([30]);
    expect(optionValues(overnight, 'hour')).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 22, 23]);
  });

  it('derives the picker grid from a sub-second-precision step by keeping only genuinely whole-second candidates', async () => {
    const optionValues = (el: LyraTimeInput, name: string): number[] =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[data-column="${name}"]`)]
        .map((option) => Number(option.dataset['value']));

    // stepMilliseconds >= 1000 but not an exact multiple of 1000 (1.5s): half the raw grid points
    // land at a half-second offset, forcing the wholeSecond check's second OR operand (closeness to
    // the *next* whole second, evaluated only once the first operand is false) to actually run
    // instead of always short-circuiting on the first.
    const coarse = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" step="1.5"></lr-time-input>`);
    await coarse.show();
    await coarse.updateComplete;
    const coarseSeconds = optionValues(coarse, 'second');
    expect(coarseSeconds.every((value) => value % 3 === 0), 'only every third whole second lands on a 1.5s grid').to
      .equal(true);
    expect(coarseSeconds).to.include(0);
    expect(coarseSeconds).to.not.include(1);

    // stepMilliseconds < 1000 (300ms) walks the day one whole second at a time instead, still
    // finding only the whole seconds that happen to fall exactly on the sub-second step.
    const fine = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" step="0.3"></lr-time-input>`);
    await fine.show();
    await fine.updateComplete;
    const fineSeconds = optionValues(fine, 'second');
    expect(fineSeconds.every((value) => value % 3 === 0), 'only every third whole second lands on a 300ms grid').to
      .equal(true);
    expect(fineSeconds).to.include(0);
    expect(fineSeconds).to.not.include(1);
  });

  it('produces an empty picker grid when a sub-second min base puts every whole second off the 1s step', async () => {
    // `min`'s sub-second remainder (500ms) means no whole-second value ever lands on a 1-second
    // step grid, so both operands of the offset-from-either-edge check run and the picker
    // legitimately has zero options in every column -- not a crash, just nothing selectable.
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input hour-format="24" step="1" min="00:00:00.500"></lr-time-input>`,
    );
    await el.show();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[role="option"]').length).to.equal(0);
  });

  it('projects disabled state to every popup option and removes all option tab stops', async () => {
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input disabled hour-format="24" value="10:05"></lr-time-input>
    `);
    const options = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(options.length).to.be.greaterThan(0);
    expect(options.every((option) => option.disabled)).to.equal(true);
    expect(options.every((option) => option.tabIndex === -1)).to.equal(true);
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
    expect((footer.shadowRoot!.querySelector('[part="now-button"]')) === (null)).to.equal(true);
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

  it('hands focus-return duty to the next open picker when a non-topmost instance is light-dismissed', async () => {
    // Two simultaneously open pickers register as separate stacked overlay entries. Dismissing the
    // non-topmost one via an outside pointerdown asks the overlay manager to resolve *its own*
    // captured restore target first; when that lookup instead falls through to handing focus to
    // whatever overlay is now on top, the manager resolves that entry's own popup panel to find a
    // focusable target inside it.
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-time-input id="lower" hour-format="24" value="09:00"></lr-time-input>
        <lr-time-input id="upper" hour-format="24" value="10:00"></lr-time-input>
      </div>
    `);
    const lower = wrapper.querySelector('#lower') as LyraTimeInput;
    const upper = wrapper.querySelector('#upper') as LyraTimeInput;
    await lower.show();
    await lower.updateComplete;
    await upper.show();
    await upper.updateComplete;
    expect(lower.open).to.equal(true);
    expect(upper.open).to.equal(true);

    // Lands inside lower's own row (so lower stays open) but outside upper (so upper light-dismisses).
    const lowerRow = lower.shadowRoot!.querySelector('[part~="time-input"]')!;
    lowerRow.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await upper.updateComplete;

    expect(upper.open, 'the outside click only dismisses the instance it landed outside of').to.equal(false);
    expect(lower.open, 'the still-open lower picker is untouched').to.equal(true);
    expect(
      lower.shadowRoot!.activeElement?.getAttribute('role'),
      'focus lands inside the remaining open picker instead of nowhere',
    ).to.equal('option');
  });

  it('clips cross-axis column overflow instead of creating a phantom horizontal scrollbar', async () => {
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input value="10:00" style="--column-width: 1rem"></lr-time-input>
    `);
    await el.show();
    await el.updateComplete;
    const column = el.shadowRoot!.querySelector<HTMLElement>('[part="column"]')!;
    expect(column.scrollWidth).to.be.greaterThan(column.clientWidth);
    expect(getComputedStyle(column).overflowX).to.equal('hidden');
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

  it('force-closes an open popup through willUpdate when a fieldset cascade disables the control', async () => {
    // Distinct from the direct-`disabled`-setter case above: `formDisabledCallback` sets
    // `_fieldsetDisabled` straight on the FormAssociated mixin, bypassing this class's own
    // `disabled` setter override (and its own `forceClose` call) entirely. Only `willUpdate`'s
    // `this.open && this.effectiveDisabled` guard closes the popup on this path.
    const form = await fixture<HTMLFormElement>(html`
      <form><fieldset><lr-time-input value="09:00"></lr-time-input></fieldset></form>
    `);
    const el = form.querySelector('lr-time-input') as LyraTimeInput;
    await el.show();
    await el.updateComplete;
    expect(el.open).to.equal(true);

    (form.querySelector('fieldset') as HTMLFieldSetElement).disabled = true;
    await el.updateComplete;
    expect(el.open, 'the fieldset cascade closes the popup without touching the own disabled setter').to.equal(false);
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

  it('treats an intentional native autofill empty value as one standard clear transaction', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input value="09:30"></lr-time-input>`);
    const native = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-autofill]')!;
    const seen: string[] = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('lr-input', () => seen.push('lr-input'));
    el.addEventListener('change', () => seen.push('change'));
    el.addEventListener('lr-change', () => seen.push('lr-change'));

    native.value = '';
    native.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'deleteContentBackward',
    }));
    native.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await el.updateComplete;

    expect(el.value).to.equal('');
    expect(seen).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
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
    expect((el.shadowRoot!.activeElement) === (segment(el, 'hour'))).to.equal(true);
    el.blur();
    expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);

    const disabled = await fixture<LyraTimeInput>(html`<lr-time-input disabled value="10:00"></lr-time-input>`);
    disabled.click();
    expect((disabled.shadowRoot!.activeElement) === (null)).to.equal(true);
  });

  it('recomputes to a valid segment when focus() is called with a stale internal active segment', async () => {
    // `focus()` itself recomputes `activeSegmentFor(order)` and only reassigns `this.activeSegment`
    // when that recompute actually disagrees with the stored value -- distinct from the
    // format-change auto-rehome path (which runs through `willUpdate`/`updated`, not `focus()`).
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" value="10:00"></lr-time-input>`);
    (el as unknown as { activeSegment: string }).activeSegment = 'dayPeriod'; // absent from the 24-hour order
    el.focus();
    expect(
      (el.shadowRoot!.activeElement) === (segment(el, 'hour')),
      'falls back to the first surviving segment',
    ).to.equal(true);
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

  // Disabling a focused native control blurs it (plain platform
  // behavior, nothing custom-element-specific) -- here that's the active segment losing its
  // tabindex="0" while the browser still counts it as the focused element. That blur is not a
  // real user interaction and must not mark the field touched.
  it('does not mark touched from a blur caused by the segment itself becoming disabled', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24"></lr-time-input>`);
    const hourSegment = segment(el, 'hour');
    hourSegment.focus();
    expect(el.shadowRoot!.activeElement === hourSegment, 'focused before disable').to.be.true;

    el.disabled = true;
    await el.updateComplete;

    expect((el as unknown as { touched: boolean }).touched, 'touched after a disable-forced blur').to.equal(false);
  });

  it('still marks touched on a real blur (focus moving elsewhere)', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24"></lr-time-input>`);
    const hourSegment = segment(el, 'hour');
    hourSegment.focus();
    expect(el.shadowRoot!.activeElement === hourSegment, 'focused before blur').to.be.true;

    hourSegment.blur();
    await el.updateComplete;

    expect((el as unknown as { touched: boolean }).touched, 'touched after a real blur').to.equal(true);
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

describe('lr-time-input segment editing edge cases', () => {
  it('resets an overflowing two-digit segment to just the new digit and auto-advances', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24"></lr-time-input>`);
    key(segment(el, 'hour'), '2');
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim(), 'buffered single digit shown unpadded').to.equal('2');

    // "29" overflows the 0-23 bound, so the second keystroke resets the buffer to just itself.
    key(segment(el, 'hour'), '9');
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim()).to.equal('09');
    expect((el.shadowRoot!.activeElement) === (segment(el, 'minute')), 'auto-advances since no second digit could complete a valid hour').to.equal(true);
  });

  it('holds a leading zero pending for a two-digit 12-hour entry', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="12"></lr-time-input>`);
    key(segment(el, 'hour'), '0');
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim(), 'below the 1-12 minimum, held pending').to.equal('0');
    expect(el.value).to.equal('');

    key(segment(el, 'hour'), '9');
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim()).to.equal('9');
  });

  it('ignores digit keys pressed on the day-period segment', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="12"></lr-time-input>`);
    key(segment(el, 'dayPeriod'), '5');
    await el.updateComplete;
    expect(segment(el, 'dayPeriod').textContent?.trim()).to.equal('--');
  });

  it('leaves the value incomplete in 12-hour mode until a day period is chosen, then recomputes the hour', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="12"></lr-time-input>`);
    key(segment(el, 'hour'), '9');
    await el.updateComplete;
    key(segment(el, 'minute'), '3');
    key(segment(el, 'minute'), '0');
    await el.updateComplete;
    expect(el.value, 'day period still unset -- draft stays incomplete').to.equal('');

    key(segment(el, 'dayPeriod'), 'p');
    await el.updateComplete;
    expect(el.value).to.equal('21:30');

    key(segment(el, 'dayPeriod'), 'A');
    await el.updateComplete;
    expect(el.value, 'uppercase key and a hyphen recompute back to the am hour').to.equal('09:30');
  });

  it('clears an individual populated segment back to blank via Backspace', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" value="10:15"></lr-time-input>`);
    key(segment(el, 'minute'), 'Backspace');
    await el.updateComplete;
    expect(segment(el, 'minute').textContent?.trim()).to.equal('--');
    expect(el.value).to.equal('');
  });

  it('jumps a segment to its bounds with Home and End', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" value="10:15"></lr-time-input>`);
    key(segment(el, 'hour'), 'Home');
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim()).to.equal('00');
    key(segment(el, 'hour'), 'End');
    await el.updateComplete;
    expect(segment(el, 'hour').textContent?.trim()).to.equal('23');

    const twelve = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="12" value="03:00"></lr-time-input>`);
    key(segment(twelve, 'dayPeriod'), 'Home');
    await twelve.updateComplete;
    expect(segment(twelve, 'dayPeriod').textContent?.trim()).to.match(/am/i);
    key(segment(twelve, 'dayPeriod'), 'End');
    await twelve.updateComplete;
    expect(segment(twelve, 'dayPeriod').textContent?.trim()).to.match(/pm/i);

    const readonly = await fixture<LyraTimeInput>(
      html`<lr-time-input hour-format="24" readonly value="10:15"></lr-time-input>`,
    );
    key(segment(readonly, 'hour'), 'Home');
    await readonly.updateComplete;
    expect(segment(readonly, 'hour').textContent?.trim(), 'readonly ignores Home/End').to.equal('10');
  });

  it('ignores segment keydowns entirely while disabled', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input disabled hour-format="24" value="10:15"></lr-time-input>`,
    );
    key(segment(el, 'hour'), 'ArrowUp');
    key(segment(el, 'hour'), '5');
    await el.updateComplete;
    expect(el.value).to.equal('10:15');
  });

  it('ignores a paste on a readonly segment', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input readonly value="09:30" hour-format="24"></lr-time-input>`,
    );
    const event = paste(segment(el, 'hour'), '14:25');
    expect(event.defaultPrevented).to.equal(false);
    expect(el.value).to.equal('09:30');
  });

  it('treats a paste event with no clipboardData as empty text instead of throwing', async () => {
    // A plain `Event` (rather than the `paste` helper's synthetic `ClipboardEvent`-shaped object)
    // has no `clipboardData` at all, exercising the `event.clipboardData?.getData(...) ?? ''`
    // optional-chain/nullish fallback.
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24" value="09:30"></lr-time-input>`);
    const bare = new Event('paste', { bubbles: true, composed: true, cancelable: true });
    expect(() => segment(el, 'hour').dispatchEvent(bare)).to.not.throw();
    expect(bare.defaultPrevented, 'empty pasted text is a no-op, never preventDefault').to.equal(false);
    expect(el.value).to.equal('09:30');
  });

  it('falls back to insertReplacementText when the autofill input event carries no inputType', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    const native = el.shadowRoot!.querySelector<HTMLInputElement>('input[data-autofill]')!;
    let seenInputType: string | undefined;
    el.addEventListener('input', (event) => { seenInputType = (event as InputEvent).inputType; });
    native.value = '08:15';
    native.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.value).to.equal('08:15');
    expect(seenInputType).to.equal('insertReplacementText');
  });

  it('falls back to a zero-padded segment display when Intl.NumberFormat construction throws', async () => {
    // A fresh, never-before-used locale/options pair in this file guarantees a cache miss in
    // getNumberFormat()'s shared memo, so the forced-throwing constructor actually runs instead of
    // returning a formatter some earlier test already cached.
    const original = Intl.NumberFormat;
    Intl.NumberFormat = function () {
      throw new RangeError('forced failure for coverage');
    } as unknown as typeof Intl.NumberFormat;
    try {
      const el = await fixture<LyraTimeInput>(
        html`<lr-time-input locale="de-DE" hour-format="24" value="07:04"></lr-time-input>`,
      );
      expect(segment(el, 'hour').textContent?.trim()).to.equal('07');
      expect(segment(el, 'minute').textContent?.trim()).to.equal('04');
    } finally {
      Intl.NumberFormat = original;
    }
  });

  it('rejects a non-ASCII digit key without throwing when the active locale formatter is unavailable', async () => {
    const original = Intl.NumberFormat;
    Intl.NumberFormat = function () {
      throw new RangeError('forced failure for coverage');
    } as unknown as typeof Intl.NumberFormat;
    try {
      const el = await fixture<LyraTimeInput>(html`<lr-time-input locale="ja-JP" hour-format="24"></lr-time-input>`);
      expect(() => key(segment(el, 'hour'), '٣')).to.not.throw();
      await el.updateComplete;
      expect(segment(el, 'hour').textContent?.trim(), 'a locale digit is silently rejected, not accepted as 3').to.equal('--');

      key(segment(el, 'hour'), '2');
      await el.updateComplete;
      expect(segment(el, 'hour').textContent?.trim(), 'plain ASCII digits remain unaffected').to.equal('2');
    } finally {
      Intl.NumberFormat = original;
    }
  });

  it('treats a duck-typed non-Node related target as outside the input group without throwing', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24"></lr-time-input>`);
    // A genuine EventTarget (so it survives FocusEvent's own relatedTarget validation) that also
    // structurally resembles an Element (satisfies the defensive shape check) but is not a real
    // DOM node, so the native `Node.prototype.contains()` call on it throws -- the catch branch
    // must treat that as "not contained" rather than let the exception escape the focus handler.
    const fakeElement = Object.assign(new EventTarget(), {
      nodeType: 1,
      getRootNode: () => document,
      contains: () => false,
    });
    const seen: string[] = [];
    el.addEventListener('focus', () => seen.push('focus'));
    el.addEventListener('blur', () => seen.push('blur'));

    const focusEvent = new FocusEvent('focus', {
      bubbles: true,
      composed: true,
      relatedTarget: fakeElement as unknown as EventTarget,
    });
    segment(el, 'hour').dispatchEvent(focusEvent);
    expect(seen).to.deep.equal(['focus']);

    const blurEvent = new FocusEvent('blur', {
      bubbles: true,
      composed: true,
      relatedTarget: fakeElement as unknown as EventTarget,
    });
    segment(el, 'hour').dispatchEvent(blurEvent);
    expect(seen).to.deep.equal(['focus', 'blur']);
  });
});

describe('lr-time-input popup and lifecycle edge cases', () => {
  it('supports direct assignment to the open and step accessors', async () => {
    // A direct property assignment bypasses the attribute converter's own positive-number guard,
    // so the accessor's own fallback must still catch a non-positive value.
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    el.step = -5;
    expect(el.step).to.equal(60);

    // Setting `open` directly before the element has ever connected/updated takes the silent
    // (non-announcing) path: no lr-show/lr-after-show fires, unlike show().
    const detached = document.createElement('lr-time-input') as LyraTimeInput;
    let sawShow = false;
    detached.addEventListener('lr-show', () => { sawShow = true; });
    try {
      detached.open = true;
      document.body.append(detached);
      await detached.updateComplete;
      expect(detached.open).to.equal(true);
      expect(sawShow, 'no announced show event before the element ever connected/updated').to.equal(false);
    } finally {
      detached.remove();
    }
  });

  it('announces show/after-show when the open property is assigned directly on an already-mounted control', async () => {
    // Unlike the pre-connect direct-assignment case above, this element is already connected and
    // has already completed its first update, so the `open` setter's own
    // `this.isConnected && this.hasUpdated` announce guard evaluates true here.
    const el = await fixture<LyraTimeInput>(html`<lr-time-input value="10:00"></lr-time-input>`);
    const afterShow = oneEvent(el, 'lr-after-show');
    el.open = true;
    await afterShow;
    expect(el.open).to.equal(true);
  });

  it('skips overlay activation when the host reports disconnected at update-flush time', async () => {
    // `activatePopup()` guards on `this.isConnected` to avoid wiring a positioner/light-dismiss
    // listener for a host that is no longer in the document by the time its scheduled update
    // flushes. Overriding the accessor (rather than actually removing the element, which would
    // also run disconnectedCallback's own forceClose) isolates that one guard.
    const el = await fixture<LyraTimeInput>(html`<lr-time-input value="10:00"></lr-time-input>`);
    Object.defineProperty(el, 'isConnected', { configurable: true, get: () => false });
    try {
      await el.show();
      expect(el.open, 'the open flag itself still flips').to.equal(true);
      const popup = el.shadowRoot!.querySelector('[part="popup"]')!;
      expect(popup.hasAttribute('data-hidden'), 'render still reflects the open state').to.equal(false);
    } finally {
      delete (el as unknown as { isConnected?: unknown }).isConnected;
    }
  });

  it('recomputes seconds in both step directions and rehomes focus when a segment disappears', async () => {
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input hour-format="24" step="60" value="09:30"></lr-time-input>
    `);
    expect(el.shadowRoot!.querySelector('[data-segment="second"]') === null).to.be.true;

    el.step = 30;
    await el.updateComplete;
    const second = segment(el, 'second');
    second.focus();
    expect(el.shadowRoot!.activeElement === second).to.be.true;

    el.step = 60;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-segment="second"]') === null).to.be.true;
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['segment']).to.equal('hour');

    el.step = 30;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-segment="second"]')).not.to.equal(null);
  });

  it('reconnects a forced-closed popup with property, DOM, ARIA, and custom state in agreement', async () => {
    const host = await fixture<HTMLDivElement>(html`
      <div><lr-time-input value="09:30"></lr-time-input></div>
    `);
    const el = host.querySelector('lr-time-input') as LyraTimeInput;
    await el.show();
    await el.updateComplete;
    expect(el.matches(':state(open)')).to.equal(true);

    el.remove();
    host.append(el);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLElement>('[part="input"]')!;
    const expand = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="expand-button"]')!;
    const popup = el.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
    expect(el.open).to.equal(false);
    expect(el.hasAttribute('open')).to.equal(false);
    expect(el.matches(':state(open)')).to.equal(false);
    expect(input.getAttribute('aria-expanded')).to.equal('false');
    expect(expand.getAttribute('aria-expanded')).to.equal('false');
    expect(popup.hasAttribute('data-hidden')).to.equal(true);
  });

  it('preserves every partial-edit tuple across adoption and reconnect', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const cases: Array<{ name: 'hour' | 'minute' | 'second' | 'dayPeriod'; step?: number }> = [
      { name: 'hour' },
      { name: 'minute' },
      { name: 'second', step: 30 },
      { name: 'dayPeriod' },
    ];

    for (const entry of cases) {
      const el = document.createElement('lr-time-input') as LyraTimeInput;
      el.hourFormat = entry.name === 'dayPeriod' ? '12' : '24';
      if (entry.step) el.step = entry.step;
      document.body.append(el);
      await el.updateComplete;
      key(segment(el, entry.name), entry.name === 'dayPeriod' ? 'p' : '1');
      await el.updateComplete;
      const beforeText = segment(el, entry.name).textContent?.trim();
      expect(el.value, entry.name).to.equal('');
      expect(el.validity.badInput, entry.name).to.equal(true);

      el.remove();
      frame.contentDocument!.body.append(frame.contentDocument!.adoptNode(el));
      await el.updateComplete;
      expect(segment(el, entry.name).textContent?.trim(), entry.name).to.equal(beforeText);
      expect(el.value, entry.name).to.equal('');
      expect(el.validity.badInput, entry.name).to.equal(true);
      el.remove();
    }
  });

  it('ignores a superseded show/hide transition instead of emitting a stale after-event', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input style="--show-duration: 0.001ms; --hide-duration: 0.001ms"></lr-time-input>`,
    );
    const events: string[] = [];
    el.addEventListener('lr-after-show', () => events.push('after-show'));
    el.addEventListener('lr-after-hide', () => events.push('after-hide'));
    const showPromise = el.show();
    const hidePromise = el.hide();
    await Promise.all([showPromise, hidePromise]);
    expect(el.open).to.equal(false);
    expect(events, 'the superseded show transition never announces').to.deep.equal(['after-hide']);
  });

  it('repositions the popup when placement or distance changes while open', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input value="10:00"></lr-time-input>`);
    await el.show();
    el.placement = 'top-end';
    await el.updateComplete;
    expect(el.open).to.equal(true);
    el.distance = 8;
    await el.updateComplete;
    expect(el.open).to.equal(true);
    await el.hide();
  });

  it('recovers focus to a valid segment if the active one no longer exists after a format change', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="12" value="09:30"></lr-time-input>`);
    segment(el, 'dayPeriod').focus();
    expect((el.shadowRoot!.activeElement) === (segment(el, 'dayPeriod'))).to.equal(true);
    let focusRelays = 0;
    let blurRelays = 0;
    el.addEventListener('focus', () => focusRelays++);
    el.addEventListener('blur', () => blurRelays++);

    el.setAttribute('hour-format', '24');
    await el.updateComplete;
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['segment'],
      'falls back to a segment that still exists',
    ).to.equal('hour');
    expect(focusRelays, 'logical focus continuity does not emit another focus event').to.equal(0);
    expect(blurRelays, 'logical focus continuity does not emit a blur event').to.equal(0);
  });

  it('does not reclaim foreign focus when a controlled format change removes a segment', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-time-input hour-format="12" value="09:30"></lr-time-input>
        <button id="time-input-foreign-focus" type="button">Outside action</button>
      </div>
    `);
    const el = wrapper.querySelector('lr-time-input') as LyraTimeInput;
    const foreign = wrapper.querySelector('button')!;
    foreign.focus();

    el.hourFormat = '24';
    await el.updateComplete;

    expect(document.activeElement?.id).to.equal('time-input-foreign-focus');
  });

  it('closes the popup on Enter and otherwise triggers implicit form submission', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-time-input name="start" value="09:30" hour-format="24"></lr-time-input></form>
    `);
    const el = form.querySelector('lr-time-input') as LyraTimeInput;
    await el.show();
    key(segment(el, 'hour'), 'Enter');
    await el.updateComplete;
    expect(el.open, 'Enter closes the open popup first').to.equal(false);

    let submits = 0;
    form.addEventListener('submit', (event) => { event.preventDefault(); submits += 1; });
    key(segment(el, 'hour'), 'Enter');
    expect(submits, 'Enter with the popup closed submits the ancestor form').to.equal(1);

    const readonlyForm = await fixture<HTMLFormElement>(html`
      <form><lr-time-input name="start" readonly value="09:30"></lr-time-input></form>
    `);
    const readonlyEl = readonlyForm.querySelector('lr-time-input') as LyraTimeInput;
    let readonlySubmits = 0;
    readonlyForm.addEventListener('submit', (event) => { event.preventDefault(); readonlySubmits += 1; });
    key(segment(readonlyEl, 'hour'), 'Enter');
    expect(readonlySubmits, 'readonly never submits on Enter').to.equal(0);
  });

  it('ignores a forced click on Now/Clear while readonly or disabled', async () => {
    const readonly = await fixture<LyraTimeInput>(
      html`<lr-time-input with-now with-clear readonly value="09:30"></lr-time-input>`,
    );
    await readonly.show();
    readonly.shadowRoot!
      .querySelector<HTMLButtonElement>('[part="now-button"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(readonly.value).to.equal('09:30');
    readonly.shadowRoot!
      .querySelector<HTMLButtonElement>('[part="clear-button"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(readonly.value, 'the native disabled attribute already blocks .click(); this forces the listener').to.equal(
      '09:30',
    );

    const disabled = await fixture<LyraTimeInput>(html`<lr-time-input with-now disabled value="09:30"></lr-time-input>`);
    disabled.shadowRoot!
      .querySelector<HTMLButtonElement>('[part="now-button"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(disabled.value).to.equal('09:30');

    disabled.shadowRoot!
      .querySelector<HTMLButtonElement>('[part="expand-button"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(disabled.open, 'a forced click on the expand button never opens a disabled control').to.equal(false);
  });
});

describe('lr-time-input validity, value coercion, and slots', () => {
  it('reports NaN from valueAsNumber while blank', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    expect(Number.isNaN(el.valueAsNumber)).to.equal(true);
  });

  it('normalizes a minute-precision value to include seconds under a sub-minute step', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input step="1"></lr-time-input>`);
    el.value = '09:30';
    expect(el.value).to.equal('09:30:00');
  });

  it('reports ordinary range underflow and overflow with distinct messages', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input min="09:00" max="17:00" hour-format="24"></lr-time-input>`,
    );
    el.value = '08:00';
    expect(el.validity.rangeUnderflow).to.equal(true);
    const underflowMessage = el.validationMessage;
    expect(underflowMessage.length).to.be.greaterThan(0);

    el.value = '18:00';
    expect(el.validity.rangeOverflow).to.equal(true);
    expect(el.validationMessage.length).to.be.greaterThan(0);
    expect(el.validationMessage).to.not.equal(underflowMessage);
  });

  it('renders a seconds-precision min/max constraint through the same locale pattern in range messages', async () => {
    // `displayTime()` derives `includeSeconds` from the *constraint* value's own parsed precision,
    // not from the component's visible-seconds state -- exercising its `second` pattern-part arm.
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input hour-format="24" min="09:00:30" max="17:00:45"></lr-time-input>`,
    );
    el.value = '08:00:00';
    expect(el.validity.rangeUnderflow).to.equal(true);
    expect(el.validationMessage).to.include('30');

    el.value = '18:00:00';
    expect(el.validity.rangeOverflow).to.equal(true);
    expect(el.validationMessage).to.include('45');
  });

  it('tracks dynamic label/hint/error/start/end slot content and updates aria-describedby', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input required value="09:30"></lr-time-input>`);
    el.reportValidity(); // touches the control so its (currently valid) message state is live
    await el.updateComplete;

    const makeSlotted = (name: string): HTMLSpanElement => {
      const span = document.createElement('span');
      span.slot = name;
      span.textContent = name;
      return span;
    };
    const label = makeSlotted('label');
    const hint = makeSlotted('hint');
    const error = makeSlotted('error');
    const start = makeSlotted('start');
    const end = makeSlotted('end');
    el.append(label, hint, error, start, end);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part~="form-control-label"]')!.hasAttribute('hidden')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="hint"]')!.hasAttribute('hidden')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="error"]')!.hasAttribute('hidden')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="start"]')!.hasAttribute('hidden')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="end"]')!.hasAttribute('hidden')).to.equal(false);

    const describedBy = el.shadowRoot!.querySelector('[part="input"]')!.getAttribute('aria-describedby')?.split(' ');
    expect(describedBy, 'both the error and hint ids are referenced once both are shown').to.include.members([
      el.shadowRoot!.querySelector('[part="error"]')!.id,
      el.shadowRoot!.querySelector('[part="hint"]')!.id,
    ]);
    const group = el.shadowRoot!.querySelector('[part="input"]')!;
    expect(group.getAttribute('aria-invalid')).to.equal('true');
    expect(
      [...el.shadowRoot!.querySelectorAll('[role="spinbutton"]')].map((segment) => segment.getAttribute('aria-invalid')),
    ).to.deep.equal([...el.shadowRoot!.querySelectorAll('[role="spinbutton"]')].map(() => 'true'));
    expect(el.checkValidity(), 'visible consumer error chrome does not rewrite FACE validity').to.be.true;
  });

  it('projects explicit required state to every supported segment owner without erasing it when disabled', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    const requiredStates = (): Array<string | null> =>
      [...el.shadowRoot!.querySelectorAll('[role="spinbutton"]')]
        .map((segment) => segment.getAttribute('aria-required'));

    expect(requiredStates()).to.deep.equal(requiredStates().map(() => 'false'));
    el.required = true;
    await el.updateComplete;
    expect(requiredStates()).to.deep.equal(requiredStates().map(() => 'true'));

    el.disabled = true;
    await el.updateComplete;
    expect(requiredStates()).to.deep.equal(requiredStates().map(() => 'true'));
  });

  it('adds a localized group-level required description without replacing hint or error relationships', async () => {
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input
        required
        hint="Enter local time"
        error-text="Time missing"
        .strings=${{ fieldRequired: 'Heure obligatoire.' }}
      ></lr-time-input>
    `);
    const group = el.shadowRoot!.querySelector<HTMLElement>('[part="input"]')!;
    const description = el.shadowRoot!.querySelector<HTMLElement>('[data-required-description]')!;
    const ids = group.getAttribute('aria-describedby')?.match(/\S+/g) ?? [];

    expect(description.textContent?.trim()).to.equal('Heure obligatoire.');
    expect(ids).to.include(description.id);
    expect(ids).to.include(el.shadowRoot!.querySelector('[part="hint"]')!.id);
    expect(ids).to.include(el.shadowRoot!.querySelector('[part="error"]')!.id);

    el.required = false;
    await el.updateComplete;
    const optionalIds = group.getAttribute('aria-describedby')?.match(/\S+/g) ?? [];
    expect(optionalIds).not.to.include(description.id);
    expect(optionalIds).to.include(el.shadowRoot!.querySelector('[part="hint"]')!.id);
    expect(optionalIds).to.include(el.shadowRoot!.querySelector('[part="error"]')!.id);
  });
});

// A segment is <span part="segment" role="spinbutton">, which can never itself match :disabled --
// only the host's own disabled content attribute (or an ancestor <fieldset disabled>'s cascade)
// does, the same way lr-time-range's handles are gated. Driven through the real pointer rather
// than the stylesheet text, the same way lr-checkbox's/lr-time-range's hover-feedback tests are:
// reading the painted background back is the only assertion that can tell a guarded rule from an
// unguarded one that happens not to be reached by keyboard-only coverage. Colour STRINGS are
// compared, never elements -- a DOM node as chai's actual/expected hangs the whole file.
describe('lr-time-input disabled segment hover/press feedback', () => {
  const centerOf = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  };

  it('does not tint a segment on hover or press while disabled', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input disabled value="10:00" style="--lr-transition-fast: 0s"></lr-time-input>`,
    );
    const target = segment(el, 'hour');
    const resting = getComputedStyle(target).backgroundColor;
    try {
      await sendMouse({ type: 'move', position: centerOf(target) });
      expect(getComputedStyle(target).backgroundColor, 'hover must not tint a disabled segment').to.equal(
        resting,
      );
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(target).backgroundColor, 'press must not tint a disabled segment').to.equal(
        resting,
      );
      await sendMouse({ type: 'up' });
    } finally {
      await resetMouse();
    }
  });

  it('does not tint a segment on hover or press while disabled purely via an ancestor fieldset', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <fieldset disabled>
          <lr-time-input value="10:00" style="--lr-transition-fast: 0s"></lr-time-input>
        </fieldset>
      </form>
    `);
    const el = form.querySelector('lr-time-input') as LyraTimeInput;
    await el.updateComplete;
    const target = segment(el, 'hour');
    const resting = getComputedStyle(target).backgroundColor;
    try {
      await sendMouse({ type: 'move', position: centerOf(target) });
      expect(
        getComputedStyle(target).backgroundColor,
        'hover must not tint a segment disabled via an ancestor fieldset',
      ).to.equal(resting);
      await sendMouse({ type: 'down' });
      expect(
        getComputedStyle(target).backgroundColor,
        'press must not tint a segment disabled via an ancestor fieldset',
      ).to.equal(resting);
      await sendMouse({ type: 'up' });
    } finally {
      await resetMouse();
    }
  });

  it('still tints a segment on hover and press while enabled (control)', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input value="10:00" style="--lr-transition-fast: 0s"></lr-time-input>`,
    );
    const target = segment(el, 'hour');
    const resting = getComputedStyle(target).backgroundColor;
    try {
      await sendMouse({ type: 'move', position: centerOf(target) });
      const hovered = getComputedStyle(target).backgroundColor;
      expect(hovered, 'hover must move the fill off its resting colour').to.not.equal(resting);
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(target).backgroundColor, 'press vs hover').to.not.equal(hovered);
      await sendMouse({ type: 'up' });
    } finally {
      await resetMouse();
    }
  });
});
