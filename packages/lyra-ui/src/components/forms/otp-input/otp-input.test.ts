import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './otp-input.js';
import type { LyraOtpInput } from './otp-input.class.js';

const controlOf = (el: Element): HTMLInputElement => el.shadowRoot!.querySelector('[part="control"]') as HTMLInputElement;
const segmentsOf = (el: Element): HTMLElement[] => [...el.shadowRoot!.querySelectorAll('[part~="segment"]')] as HTMLElement[];
/** The glyph a segment actually paints through its `::after`, or `''` when it paints nothing.
 *  Computed style, not stylesheet text — a rule that never matches reads as `''` here. */
const maskGlyphOf = (segment: HTMLElement): string => {
  const content = getComputedStyle(segment, '::after').content;
  if (content === 'none' || content === 'normal' || content === '') return '';
  return content.replace(/^["']|["']$/g, '');
};

const type = async (el: LyraOtpInput, text: string): Promise<void> => {
  const control = controlOf(el);
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;
};

it('renders six segments and one focusable control by default', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Verification code"></lr-otp-input>`);
  expect(segmentsOf(el)).to.have.lengthOf(6);
  // One tab stop, not one per character.
  expect(el.shadowRoot!.querySelectorAll('input')).to.have.lengthOf(1);
  await expect(el).to.be.accessible();
});

it('honours length', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4"></lr-otp-input>`);
  expect(segmentsOf(el)).to.have.lengthOf(4);
  expect(controlOf(el).maxLength).to.equal(4);
});

it('derives segments and separators from format, overriding length', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Key" length="9" format="###-###"></lr-otp-input>`);
  expect(segmentsOf(el)).to.have.lengthOf(6);
  const separators = el.shadowRoot!.querySelectorAll('[part="separator"]');
  expect(separators).to.have.lengthOf(1);
  expect(separators[0].textContent).to.equal('-');
});

it('drops characters the type rejects', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code"></lr-otp-input>`);
  await type(el, 'A1B2');
  expect(el.value).to.equal('12');
  expect(controlOf(el).value).to.equal('12');
});

it('accepts letters when type is alphanumeric and applies the case transform', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" type="alphanumeric" case="upper"></lr-otp-input>`);
  await type(el, 'ab1');
  expect(el.value).to.equal('AB1');
});

it('re-sanitizes an existing value when type narrows', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" type="alphanumeric"></lr-otp-input>`);
  await type(el, 'a1b2');
  expect(el.value).to.equal('a1b2');
  el.type = 'numeric';
  await el.updateComplete;
  expect(el.value).to.equal('12');
});

it('emits input and then lr-complete once every segment is filled', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="3"></lr-otp-input>`);
  const complete = oneEvent(el, 'lr-complete');
  await type(el, '123');
  const event = await complete;
  expect(event.detail.value).to.equal('123');
});

it('does not emit lr-complete while the code is short', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="3"></lr-otp-input>`);
  let fired = false;
  el.addEventListener('lr-complete', () => { fired = true; });
  await type(el, '12');
  expect(fired).to.equal(false);
});

it('submits its value through an ancestor form under its name', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  await type(el, '1234');
  expect(new FormData(form).get('code')).to.equal('1234');
});

it('reports a partial code as invalid and a full one as valid', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
  await type(el, '12');
  expect(el.validity.valid).to.equal(false);
  await type(el, '1234');
  expect(el.validity.valid).to.equal(true);
});

it('reports valueMissing only when required and empty', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4" required></lr-otp-input>`);
  expect(el.validity.valueMissing).to.equal(true);
  await type(el, '1234');
  expect(el.validity.valid).to.equal(true);
});

it('restores the attribute value on form reset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="1111"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  await type(el, '2222');
  expect(el.value).to.equal('2222');
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('1111');
});

it('masks the displayed characters without changing the value', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4" mask></lr-otp-input>`);
  await type(el, '1234');
  expect(el.value).to.equal('1234');
  const filled = segmentsOf(el);
  expect(filled[0].textContent).to.equal('');
  expect(filled[0].getAttribute('part')!.split(/\s+/)).to.include('masked');
});

it('renders the mask glyph in empty segments under with-mask', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4" mask with-mask></lr-otp-input>`);
  const [first] = segmentsOf(el);
  expect(first.getAttribute('part')!.split(/\s+/)).to.include('placeholder-mask');
  // Rendered result, not stylesheet text: an empty segment must actually paint the glyph, so the
  // field reads as a fixed-length code before any entry.
  expect(maskGlyphOf(first), 'empty segment under with-mask').to.equal('•');
  // The real value stays empty -- the glyph is generated content on an aria-hidden box, so it
  // can never be read back as part of the field's value.
  expect(el.value).to.equal('');
  expect(first.textContent).to.equal('');
  expect(controlOf(el).value).to.equal('');
  await expect(el).to.be.accessible();
});

it('keeps empty segments blank when with-mask is not set', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4" mask></lr-otp-input>`);
  const [first] = segmentsOf(el);
  expect(first.getAttribute('part')!.split(/\s+/)).to.not.include('placeholder-mask');
  expect(maskGlyphOf(first), 'empty segment without with-mask').to.equal('');
});

it('paints the mask glyph on filled segments too', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4" mask with-mask></lr-otp-input>`);
  await type(el, '12');
  const segments = segmentsOf(el);
  expect(maskGlyphOf(segments[0]), 'filled segment').to.equal('•');
  expect(maskGlyphOf(segments[2]), 'still-empty segment').to.equal('•');
});

it('honours a custom mask glyph on both filled and empty segments', async () => {
  const el = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="PIN" length="4" mask with-mask style="--lr-otp-input-mask-char: '*'"></lr-otp-input>
  `);
  await type(el, '1');
  const segments = segmentsOf(el);
  expect(maskGlyphOf(segments[0]), 'filled segment').to.equal('*');
  expect(maskGlyphOf(segments[1]), 'empty segment').to.equal('*');
});

it('dims the segments and disables the control inside a disabled fieldset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <fieldset disabled><lr-otp-input name="code" label="Code" length="4"></lr-otp-input></fieldset>
    </form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  await el.updateComplete;
  // A fieldset never mutates the control's own `disabled`, exactly like a native <input>.
  expect(el.disabled, 'own disabled property').to.equal(false);
  expect(el.effectiveDisabled, 'effective disabled state').to.equal(true);
  expect(controlOf(el).disabled, 'the real input').to.equal(true);
  const [first] = segmentsOf(el);
  expect(Number(getComputedStyle(first).opacity), 'segment opacity').to.be.lessThan(1);
  expect(getComputedStyle(controlOf(el)).cursor, 'control cursor').to.equal('not-allowed');
});

it('dims the segments for its own disabled attribute too', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4" disabled></lr-otp-input>`);
  expect(controlOf(el).disabled).to.equal(true);
  expect(Number(getComputedStyle(segmentsOf(el)[0]).opacity), 'segment opacity').to.be.lessThan(1);
  expect(getComputedStyle(controlOf(el)).cursor, 'control cursor').to.equal('not-allowed');
});

it('marks the next segment active only while focused', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
  await type(el, '12');
  expect(segmentsOf(el).some((s) => s.getAttribute('part')!.includes('active'))).to.equal(false);
  controlOf(el).focus();
  await el.updateComplete;
  const active = segmentsOf(el).findIndex((s) => s.getAttribute('part')!.includes('active'));
  expect(active).to.equal(2);
});

it('renders the English fallback label with no locale registered', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input></lr-otp-input>`);
  expect(controlOf(el).getAttribute('aria-label')).to.equal('Verification code');
});

it('lets a strings override reach the DOM', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input></lr-otp-input>`);
  el.strings = { otpInputLabel: 'Code de vérification' };
  await el.updateComplete;
  expect(controlOf(el).getAttribute('aria-label')).to.equal('Code de vérification');
});

it('prefers a host aria-label over the computed name', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" aria-label="Two-factor code"></lr-otp-input>`);
  expect(controlOf(el).getAttribute('aria-label')).to.equal('Two-factor code');
});

it('is not editable while readonly but still submits', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="4321" readonly></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  expect(controlOf(el).readOnly).to.equal(true);
  expect(new FormData(form).get('code')).to.equal('4321');
});

describe('lr-otp-input custom validity', () => {
  it('raises and clears a consumer-supplied error', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
    await type(el, '1234');
    expect(el.validity.valid).to.equal(true);

    el.setCustomValidity('That code has expired.');
    expect(el.validity.customError, 'customError').to.equal(true);
    expect(el.validationMessage).to.equal('That code has expired.');
    expect(el.checkValidity()).to.equal(false);

    el.setCustomValidity('');
    expect(el.validity.valid, 'cleared').to.equal(true);
  });

  it('keeps the custom error across the intrinsic recomputation every keystroke runs', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
    el.setCustomValidity('That code has expired.');
    await type(el, '12');
    expect(el.validity.customError, 'survives an incomplete entry').to.equal(true);
    await type(el, '1234');
    expect(el.validity.customError, 'survives a complete entry').to.equal(true);
    expect(el.validationMessage).to.equal('That code has expired.');
  });

  it('does not let a cleared custom error mark an intrinsically invalid control valid', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4" required></lr-otp-input>`);
    el.setCustomValidity('Server said no.');
    el.setCustomValidity('');
    expect(el.validity.valueMissing, 'still required and empty').to.equal(true);
    expect(el.validity.valid).to.equal(false);
  });
});

// `internals.states` (CustomStateSet) reached Chromium 125 / Safari 17.4 / Firefox 126, and the
// `:state()` SELECTOR landed separately from the API. Both are guarded because the states are a
// styling convenience that no-ops where either is missing -- an unguarded assertion fails on
// WebKit rather than skipping.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement('div').matches(':state(x)');
    return true;
  } catch {
    return false;
  }
})();

describe('lr-otp-input validity custom states', () => {
  it('publishes required/optional and valid/invalid from the first render', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4" required></lr-otp-input>`);
    expect(el.matches(':state(required)'), 'required').to.equal(true);
    expect(el.matches(':state(optional)'), 'optional').to.equal(false);
    expect(el.matches(':state(invalid)'), 'invalid').to.equal(true);
    expect(el.matches(':state(valid)'), 'valid').to.equal(false);

    const optional = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
    expect(optional.matches(':state(optional)'), 'optional').to.equal(true);
    expect(optional.matches(':state(required)'), 'required').to.equal(false);
    expect(optional.matches(':state(valid)'), 'valid').to.equal(true);
  });

  it('withholds user-valid/user-invalid until the user has actually typed', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4" required></lr-otp-input>`);
    expect(el.matches(':state(invalid)')).to.equal(true);
    expect(el.matches(':state(user-invalid)'), 'pristine required must not read as an error').to.equal(false);

    await type(el, '12');
    expect(el.matches(':state(user-invalid)'), 'an incomplete code after typing').to.equal(true);
    await type(el, '1234');
    expect(el.matches(':state(user-valid)'), 'user-valid once complete').to.equal(true);
    expect(el.matches(':state(user-invalid)')).to.equal(false);
  });

  it('counts a reportValidity() call -- what a submit attempt runs -- as interaction', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4" required></lr-otp-input>`);
    expect(el.matches(':state(user-invalid)')).to.equal(false);
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.equal(true);
  });

  it('tracks a custom error in valid/invalid', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
    await type(el, '1234');
    expect(el.matches(':state(valid)')).to.equal(true);
    el.setCustomValidity('Server said no.');
    expect(el.matches(':state(invalid)'), 'a custom error is an invalid control').to.equal(true);
    expect(el.matches(':state(user-invalid)'), 'the user has already typed').to.equal(true);
  });
});
