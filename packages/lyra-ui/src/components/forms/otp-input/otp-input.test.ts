import { aTimeout, fixture, expect, html, oneEvent } from '@open-wc/testing';
import './otp-input.js';
import '../button/button.js';
import type { LyraOtpInput } from './otp-input.class.js';

const controlOf = (el: Element): HTMLInputElement =>
  el.shadowRoot!.querySelector('[part="control"]') as HTMLInputElement;
const segmentsOf = (el: Element): HTMLElement[] =>
  [...el.shadowRoot!.querySelectorAll('[part~="segment"]')] as HTMLElement[];
const fieldOf = (el: Element): HTMLElement => el.shadowRoot!.querySelector('[part~="segments"]') as HTMLElement;
const partOf = (el: Element, name: string): HTMLElement =>
  el.shadowRoot!.querySelector(`[part~="${name}"]`) as HTMLElement;
const activeIndexOf = (el: Element): number =>
  segmentsOf(el).findIndex((segment) => segment.getAttribute('part')!.split(/\s+/).includes('active'));

it('inherits public segment paint and radius across an appearance fallback', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-otp-input-segment-fill: rgb(1, 2, 3); --lr-otp-input-segment-border-color: rgb(4, 5, 6); --lr-otp-input-segment-radius: 17px">
      <lr-otp-input appearance="filled-outlined" length="4"></lr-otp-input>
    </div>
  `);
  const el = wrapper.querySelector('lr-otp-input') as LyraOtpInput;
  const segment = segmentsOf(el)[0];
  const computed = getComputedStyle(segment);
  expect(computed.backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(computed.borderTopColor).to.equal('rgb(4, 5, 6)');
  expect(computed.borderTopLeftRadius).to.equal('17px');
});

it("restores every nonempty declared default when its attribute is removed", async () => {
  const el = (await fixture(html`
    <lr-otp-input
      appearance="contained"
      length="8"
      type="alphanumeric"
      case="upper"
      autocomplete="off"
    ></lr-otp-input>
  `)) as LyraOtpInput;
  for (const name of ["appearance", "length", "type", "case", "autocomplete"])
    el.removeAttribute(name);
  await el.updateComplete;
  expect(el.appearance).to.equal("outlined");
  expect(el.length).to.equal(6);
  expect(el.type).to.equal("numeric");
  expect(el.case).to.equal("preserve");
  expect(el.autocomplete).to.equal("one-time-code");
});

it('uses scoped active and invalid segment paint inherited from an ancestor', async () => {
  const activeWrapper = await fixture<HTMLElement>(html`
    <div style="--lr-transition-fast: 0ms; --lr-otp-input-active-border-color: rgb(1, 2, 3); --lr-otp-input-active-ring-color: rgb(4, 5, 6)">
      <lr-otp-input></lr-otp-input>
    </div>
  `);
  const activeEl = activeWrapper.querySelector('lr-otp-input') as LyraOtpInput;
  for (const segment of segmentsOf(activeEl)) segment.style.transition = 'none';
  controlOf(activeEl).focus();
  await activeEl.updateComplete;
  const active = partOf(activeEl, 'active');
  const activeStyle = getComputedStyle(active);
  expect(activeStyle.getPropertyValue('--lr-otp-input-active-border-color').trim()).to.equal('rgb(1, 2, 3)');
  expect(activeStyle.borderTopColor).to.equal('rgb(1, 2, 3)');
  expect(activeStyle.boxShadow).to.contain('rgb(4, 5, 6)');

  const invalidWrapper = await fixture<HTMLElement>(html`
    <div style="--lr-transition-fast: 0ms; --lr-otp-input-invalid-border-color: rgb(7, 8, 9)">
      <lr-otp-input required></lr-otp-input>
    </div>
  `);
  const invalidEl = invalidWrapper.querySelector('lr-otp-input') as LyraOtpInput;
  for (const segment of segmentsOf(invalidEl)) segment.style.transition = 'none';
  invalidEl.reportValidity();
  await invalidEl.updateComplete;
  const invalid = partOf(invalidEl, 'invalid');
  expect(getComputedStyle(invalid).borderTopColor).to.equal('rgb(7, 8, 9)');
});
const key = (el: Element, value: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key: value,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  controlOf(el).dispatchEvent(event);
  return event;
};
const paste = (el: Element, value: string): Event => {
  const event = new Event('paste', { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text' ? value : '') },
  });
  controlOf(el).dispatchEvent(event);
  return event;
};
/** The glyph a segment actually paints through its `::after`, or `''` when it paints nothing.
 *  Computed style, not stylesheet text — a rule that never matches reads as `''` here. */
const maskGlyphOf = (segment: HTMLElement): string => {
  const content = getComputedStyle(segment, '::after').content;
  if (content === 'none' || content === 'normal' || content === '') return '';
  return content.replace(/^["']|["']$/g, '');
};

interface OtpInputEditingFacade {
  readonly input: HTMLInputElement | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  selectionDirection: 'forward' | 'backward' | 'none' | null;
  setSelectionRange(start: number | null, end: number | null, direction?: 'forward' | 'backward' | 'none'): void;
  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
}

it('emits one cancelable lr-invalid alias when a validity check fails', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input required label="Code"></lr-otp-input>`);
  const aliases: CustomEvent[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].target === el).to.equal(true);
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable).to.be.true;
});

it('forwards preventDefault() on lr-invalid to the native invalid event', async () => {
  // The alias is a real veto point: cancelling it cancels the native `invalid` it aliases, which is
  // what suppresses the browser's own validation bubble. The host's alias listener is installed in
  // the constructor, so it runs before this recorder and its preventDefault() is visible here.
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input required label="Code"></lr-otp-input>`);
  el.addEventListener('lr-invalid', (event) => event.preventDefault());
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].cancelable, 'the native invalid event is cancelable').to.be.true;
  expect(natives[0].defaultPrevented).to.be.true;
});

it('leaves the native invalid event alone when the lr-invalid alias is not cancelled', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input required label="Code"></lr-otp-input>`);
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.false;
});

it('bars constraint validation while disabled or fieldset-disabled, not only while readonly', async () => {
  // `readonly` was already suspended (see the readonly suspension test below); `disabled` was not,
  // so a <lr-otp-input required disabled> reported valueMissing and published :state(invalid)
  // while no barred native control does.
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input required label="Code" length="4" disabled></lr-otp-input>`);
  expect(el.validity.valueMissing, 'disabled + required').to.equal(false);
  expect(el.validity.valid).to.equal(true);
  expect(el.matches(':state(invalid)'), 'disabled must not be :state(invalid)').to.equal(false);
  el.reportValidity();
  expect(el.matches(':state(user-invalid)'), 'disabled must not be :state(user-invalid)').to.equal(false);

  el.disabled = false;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'enabled again').to.equal(true);

  const form = await fixture<HTMLFormElement>(html`
    <form>
      <fieldset disabled>
        <lr-otp-input required label="Nested" length="4" name="nested"></lr-otp-input>
      </fieldset>
    </form>
  `);
  const nested = form.querySelector('lr-otp-input') as LyraOtpInput;
  await nested.updateComplete;
  expect(nested.disabled, 'a fieldset never mutates the control own disabled').to.equal(false);
  expect(nested.validity.valueMissing, 'fieldset-disabled + required').to.equal(false);
  expect(nested.matches(':state(invalid)')).to.equal(false);
});

const type = async (el: LyraOtpInput, text: string): Promise<void> => {
  const control = controlOf(el);
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;
};

it('renders six segments and one focusable control by default', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Verification code"></lr-otp-input>`);
  expect(segmentsOf(el)).to.have.lengthOf(6);
  expect(el.effectiveLength).to.equal(6);
  expect('segmentCount' in el).to.equal(false);
  expect(el.appearance).to.equal('outlined');
  expect(el.autofocus).to.be.false;
  expect(el.autosubmit).to.be.false;
  expect(el.size).to.equal('m');
  expect(fieldOf(el).getAttribute('part')!.split(/\s+/)).to.include.members(['field', 'segments']);
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
  expect(el.effectiveLength).to.equal(6);
  const separators = el.shadowRoot!.querySelectorAll('[part~="segment-literal"]');
  expect(separators).to.have.lengthOf(1);
  expect(separators[0].getAttribute('part')!.split(/\s+/)).to.include.members(['separator', 'segment-literal']);
  expect(separators[0].textContent).to.equal('-');
});

it('treats a nonempty format with no segment markers as unset and falls back to length', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Key" length="4" format="---"></lr-otp-input> `);
  expect(segmentsOf(el)).to.have.lengthOf(4);
  expect(el.effectiveLength).to.equal(4);
  expect(controlOf(el).maxLength).to.equal(4);
  expect(el.shadowRoot!.querySelectorAll('[part~="segment-literal"]')).to.have.lengthOf(0);
});

it('keeps programmatic format assignment attribute-silent while still updating the layout', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Key" length="6"></lr-otp-input>`);
  expect(el.hasAttribute('format')).to.equal(false);

  el.format = '##-##';
  await el.updateComplete;

  expect(el.hasAttribute('format')).to.equal(false);
  expect(el.effectiveLength).to.equal(4);
  expect(segmentsOf(el)).to.have.lengthOf(4);
});

it('coalesces an adversarial literal run so format cannot render an unbounded cell count', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Key"></lr-otp-input>`);
  el.format = `#${'-'.repeat(100_000)}`;
  await el.updateComplete;

  expect(el.effectiveLength).to.equal(1);
  expect(controlOf(el).maxLength).to.equal(1);
  expect(segmentsOf(el)).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('[part~="segment-literal"]')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelector('[part~="segment-literal"]')!.textContent).to.have.lengthOf(4_095);
  expect(fieldOf(el).children.length, 'one segment, one coalesced literal, and one input').to.equal(3);
});

it('bounds value and format preprocessing before scanning adversarial source strings', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Key" length="4"></lr-otp-input>`);
  el.value = `${'x'.repeat(1_000_000)}1234`;
  el.format = `${'-'.repeat(1_000_000)}####`;
  await el.updateComplete;

  expect(el.value).to.equal('');
  expect(el.effectiveLength).to.equal(4);
  expect(segmentsOf(el)).to.have.length(4);
  expect(el.shadowRoot!.querySelectorAll('[part~="segment-literal"]')).to.have.length(0);
});

it('enforces the exact value-source boundary', () => {
  const el = document.createElement('lr-otp-input') as LyraOtpInput;
  el.length = 4;

  el.value = `${'x'.repeat(4_095)}7`;
  expect(el.value).to.equal('7');

  el.value = `${'x'.repeat(4_096)}7`;
  expect(el.value).to.equal('');
});

it('stops value normalization as soon as the effective segment cap is filled', () => {
  const el = document.createElement('lr-otp-input') as LyraOtpInput;
  el.length = 4;
  const originalTest = RegExp.prototype.test;
  let characterChecks = 0;
  try {
    RegExp.prototype.test = function (this: RegExp, value: string): boolean {
      if (this.source === '[0-9]') characterChecks += 1;
      return originalTest.call(this, value);
    };
    el.value = `1234${'9'.repeat(1_000_000)}`;
  } finally {
    RegExp.prototype.test = originalTest;
  }

  expect(el.value).to.equal('1234');
  expect(characterChecks).to.equal(4);
});

it('reuses one bounded format projection until the public format string changes', () => {
  const el = document.createElement('lr-otp-input') as LyraOtpInput;
  const withFormatCache = el as unknown as { readonly formattedCells: readonly unknown[] | null;
  };
  el.format = '##-##';
  const first = withFormatCache.formattedCells;
  const second = withFormatCache.formattedCells;
  expect(second).to.equal(first);

  el.format = '###-###';
  const replacement = withFormatCache.formattedCells;
  expect(replacement).to.not.equal(first);
  expect(replacement).to.have.lengthOf(7);
});

it('bounds range replacements and the existing native value before invoking setRangeText()', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Key" length="4"></lr-otp-input>`);
  const native = controlOf(el);
  native.value = '1'.repeat(1_000_000);

  const originalSetRangeText = native.setRangeText;
  let receivedReplacementLength = 0;
  let receivedValueLength = 0;
  native.setRangeText = function (
    this: HTMLInputElement,
    replacement: string,
    start?: number,
    end?: number,
    selectMode?: SelectionMode,
  ): void {
    receivedReplacementLength = replacement.length;
    receivedValueLength = this.value.length;
    if (start === undefined || end === undefined) Reflect.apply(originalSetRangeText, this, [replacement]);
    else Reflect.apply(originalSetRangeText, this, [replacement, start, end, selectMode]);
  } as HTMLInputElement['setRangeText'];

  try {
    el.setRangeText(`34${'9'.repeat(1_000_000)}`, 0, 0, 'end');
  } finally {
    native.setRangeText = originalSetRangeText;
  }

  expect(receivedReplacementLength).to.be.at.most(4);
  expect(receivedValueLength).to.be.at.most(4);
  expect(el.value).to.equal('3499');
});

it('supports the mapped appearances and shared size ladder', async () => {
  const outlined = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Outlined" appearance="outlined" size="xs"></lr-otp-input>
  `);
  const filled = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Filled" appearance="filled" size="xl"></lr-otp-input>
  `);
  const filledOutlined = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Filled outlined" appearance="filled-outlined"></lr-otp-input>
  `);
  const contained = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Contained" appearance="contained"></lr-otp-input>
  `);

  expect(outlined.appearance).to.equal('outlined');
  expect(outlined.size).to.equal('xs');
  expect(filled.appearance).to.equal('filled');
  expect(filledOutlined.appearance).to.equal('filled-outlined');
  expect(contained.appearance).to.equal('contained');
  expect(getComputedStyle(segmentsOf(filled)[0]).backgroundColor).to.not.equal(
    getComputedStyle(segmentsOf(outlined)[0]).backgroundColor
  );
  expect(segmentsOf(filled)[0].getBoundingClientRect().height).to.be.greaterThan(
    segmentsOf(outlined)[0].getBoundingClientRect().height
  );
  expect(getComputedStyle(fieldOf(contained)).gap).to.equal('0px');
  expect(getComputedStyle(fieldOf(contained)).borderStyle).to.equal('solid');
});

it('uses standalone m fallbacks while an unset size inherits a nested outer size context', async () => {
  const standalone = await fixture<LyraOtpInput>(html` <lr-otp-input label="Standalone"></lr-otp-input> `);
  const explicitMedium = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Explicit medium" size="m"></lr-otp-input>
  `);
  const outer = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Outer" size="xs">
      <lr-otp-input slot="hint" label="Nested"></lr-otp-input>
    </lr-otp-input>
  `);
  const nested = outer.querySelector('lr-otp-input') as LyraOtpInput;
  await nested.updateComplete;
  const standaloneStyle = getComputedStyle(segmentsOf(standalone)[0]);
  const explicitStyle = getComputedStyle(segmentsOf(explicitMedium)[0]);
  const outerStyle = getComputedStyle(segmentsOf(outer)[0]);
  const nestedStyle = getComputedStyle(segmentsOf(nested)[0]);

  expect(standalone.size).to.equal('m');
  expect(standalone.hasAttribute('size')).to.equal(false);
  expect(standaloneStyle.fontSize).to.equal(explicitStyle.fontSize);
  expect(standaloneStyle.borderRadius).to.equal(explicitStyle.borderRadius);
  expect(nested.size).to.equal('m');
  expect(nested.hasAttribute('size')).to.equal(false);
  expect(nestedStyle.fontSize).to.equal(outerStyle.fontSize);
  expect(nestedStyle.borderRadius).to.equal(outerStyle.borderRadius);
  expect(getComputedStyle(nested).getPropertyValue('--lr-form-control-height').trim()).to.equal(
    getComputedStyle(outer).getPropertyValue('--lr-form-control-height').trim()
  );
  expect(nestedStyle.fontSize).to.not.equal(standaloneStyle.fontSize);
  expect(nestedStyle.borderRadius).to.not.equal(standaloneStyle.borderRadius);
});

it('lets explicit same-default m property and attribute writes override inherited size context', async () => {
  const outer = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Outer" size="xs">
      <lr-otp-input slot="hint" label="Property override" style="--lr-form-control-height-m: 73px;"></lr-otp-input>
      <lr-otp-input slot="hint" label="Attribute override" size="m"></lr-otp-input>
    </lr-otp-input>
  `);
  const inners = outer.querySelectorAll<LyraOtpInput>('lr-otp-input');
  const propertyOverride = inners[0];
  const attributeOverride = inners[1];
  await propertyOverride.updateComplete;
  await attributeOverride.updateComplete;

  expect(propertyOverride.size).to.equal('m');
  expect(propertyOverride.hasAttribute('size')).to.equal(false);
  propertyOverride.size = 'm';
  await propertyOverride.updateComplete;

  expect(propertyOverride.getAttribute('size')).to.equal('m');
  expect(attributeOverride.getAttribute('size')).to.equal('m');
  const propertyStyle = getComputedStyle(segmentsOf(propertyOverride)[0]);
  const attributeStyle = getComputedStyle(segmentsOf(attributeOverride)[0]);
  const outerStyle = getComputedStyle(segmentsOf(outer)[0]);
  expect(propertyStyle.fontSize).to.equal(attributeStyle.fontSize);
  expect(propertyStyle.borderRadius).to.equal(attributeStyle.borderRadius);
  expect(getComputedStyle(propertyOverride).getPropertyValue('--lr-form-control-height').trim()).to.equal('73px');
  expect(propertyStyle.fontSize).to.not.equal(outerStyle.fontSize);
  expect(propertyStyle.borderRadius).to.not.equal(outerStyle.borderRadius);
});

it('restores inherited size context when an explicit size attribute is removed', async () => {
  const outer = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Outer" size="xs">
      <lr-otp-input slot="hint" label="Nested" size="m"></lr-otp-input>
    </lr-otp-input>
  `);
  const nested = outer.querySelector('lr-otp-input') as LyraOtpInput;
  await nested.updateComplete;
  const explicitFontSize = getComputedStyle(segmentsOf(nested)[0]).fontSize;

  nested.removeAttribute('size');
  await nested.updateComplete;

  expect(nested.size).to.equal('m');
  expect(nested.hasAttribute('size')).to.equal(false);
  const restoredStyle = getComputedStyle(segmentsOf(nested)[0]);
  const outerStyle = getComputedStyle(segmentsOf(outer)[0]);
  expect(restoredStyle.fontSize).to.equal(outerStyle.fontSize);
  expect(restoredStyle.borderRadius).to.equal(outerStyle.borderRadius);
  expect(restoredStyle.fontSize).to.not.equal(explicitFontSize);
});

it('tracks dynamic ancestor size changes while its own size stays unset', async () => {
  const outer = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Outer" size="xs">
      <lr-otp-input slot="hint" label="Nested"></lr-otp-input>
    </lr-otp-input>
  `);
  const nested = outer.querySelector('lr-otp-input') as LyraOtpInput;
  await nested.updateComplete;
  const initialStyle = getComputedStyle(segmentsOf(nested)[0]);
  const initialFontSize = initialStyle.fontSize;
  const initialRadius = initialStyle.borderRadius;
  const initialHeight = getComputedStyle(nested).getPropertyValue('--lr-form-control-height').trim();

  outer.size = 'xl';
  await outer.updateComplete;

  expect(nested.hasAttribute('size')).to.equal(false);
  const nestedStyle = getComputedStyle(segmentsOf(nested)[0]);
  const outerStyle = getComputedStyle(segmentsOf(outer)[0]);
  const nestedHeight = getComputedStyle(nested).getPropertyValue('--lr-form-control-height').trim();
  const outerHeight = getComputedStyle(outer).getPropertyValue('--lr-form-control-height').trim();
  expect(nestedStyle.fontSize).to.equal(outerStyle.fontSize);
  expect(nestedStyle.borderRadius).to.equal(outerStyle.borderRadius);
  expect(nestedHeight).to.equal(outerHeight);
  expect(nestedStyle.fontSize).to.not.equal(initialFontSize);
  expect(nestedStyle.borderRadius).to.not.equal(initialRadius);
  expect(nestedHeight).to.not.equal(initialHeight);
});

it('applies the mapped segment custom properties while retaining the Lyra mask alias', async () => {
  const el = await fixture<LyraOtpInput>(html`
    <lr-otp-input
      label="Styled PIN"
      length="4"
      mask
      with-mask
      style="--mask-char: '*'; --segment-size: 4rem; --segment-gap: 1rem; --segment-border-radius: 1rem;"
    ></lr-otp-input>
  `);
  const [first] = segmentsOf(el);
  expect(maskGlyphOf(first)).to.equal('*');
  expect(first.getBoundingClientRect().width).to.be.closeTo(64, 1);
  expect(first.getBoundingClientRect().height).to.be.closeTo(64, 1);
  expect(getComputedStyle(first).borderRadius).to.equal('16px');
  expect(getComputedStyle(fieldOf(el)).gap).to.equal('16px');
});

it('uses the pinned 2.5em default independently of the shared control-height token', async () => {
  const el = await fixture<LyraOtpInput>(html`
    <lr-otp-input
      label="Code"
      style="--lr-form-control-font-size: 20px; --lr-form-control-height: 7rem;"
    ></lr-otp-input>
  `);
  const segment = segmentsOf(el)[0];
  const style = getComputedStyle(segment);
  const expected = Number.parseFloat(style.fontSize) * 2.5;
  expect(segment.getBoundingClientRect().width).to.be.closeTo(expected, 1);
  expect(segment.getBoundingClientRect().height).to.be.closeTo(expected, 1);
});

it('honors a compact segment-size exactly while keeping the combined input target large enough', async () => {
  const compact = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Compact" length="1" style="--segment-size: 1rem;"></lr-otp-input>
  `);
  const xs = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Extra small" length="1" size="xs"></lr-otp-input>
  `);
  const medium = await fixture<LyraOtpInput>(html` <lr-otp-input label="Medium" length="1" size="m"></lr-otp-input> `);
  const cellRect = segmentsOf(compact)[0].getBoundingClientRect();
  const targetRect = fieldOf(compact).getBoundingClientRect();
  const inputRect = controlOf(compact).getBoundingClientRect();
  expect(cellRect.width).to.be.closeTo(16, 1);
  expect(cellRect.height).to.be.closeTo(16, 1);
  expect(targetRect.width).to.be.at.least(40);
  expect(targetRect.height).to.be.at.least(40);
  expect(inputRect.width).to.be.closeTo(targetRect.width, 1);
  expect(inputRect.height).to.be.closeTo(targetRect.height, 1);
  expect(segmentsOf(medium)[0].getBoundingClientRect().height).to.be.greaterThan(
    segmentsOf(xs)[0].getBoundingClientRect().height
  );
});

it('contains a long RTL fixed-cell row in a 320px allocation while keeping every cell reachable', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 320px;">
      <lr-otp-input
        label="InternationalizedUnbrokenVerificationCodeLabelThatMustWrapInsideItsAllocatedContainer"
        hint="A very long supporting hint that must also wrap without widening the containing page"
        length="8"
      ></lr-otp-input>
    </div>
  `);
  const el = wrapper.querySelector('lr-otp-input') as LyraOtpInput;
  const row = fieldOf(el);
  const cells = segmentsOf(el);
  const wrapperRect = wrapper.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  expect(wrapper.scrollWidth).to.be.at.most(320);
  expect(el.getBoundingClientRect().width).to.be.at.most(wrapperRect.width);
  expect(row.clientWidth).to.be.at.most(320);
  expect(row.scrollWidth).to.be.greaterThan(row.clientWidth);
  expect(cells[0].getBoundingClientRect().left).to.be.at.least(rowRect.left - 1);

  row.scrollLeft = row.scrollWidth;
  await aTimeout(0);
  expect(cells.at(-1)!.getBoundingClientRect().right).to.be.at.most(rowRect.right + 1);
  expect(partOf(el, 'label').getBoundingClientRect().width).to.be.at.most(wrapperRect.width);
  expect(partOf(el, 'hint').getBoundingClientRect().width).to.be.at.most(wrapperRect.width);
});

it('forwards autofocus to the real input and focuses it after first render', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" autofocus></lr-otp-input> `);
  await aTimeout(0);
  expect(el.autofocus).to.be.true;
  expect(controlOf(el).autofocus).to.be.true;
  expect(el.shadowRoot!.activeElement === controlOf(el)).to.be.true;
});

it('drops characters the type rejects', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code"></lr-otp-input>`);
  await type(el, 'A1B2');
  expect(el.value).to.equal('12');
  expect(controlOf(el).value).to.equal('12');
});

it('accepts letters when type is alphanumeric and applies the case transform', async () => {
  const el = await fixture<LyraOtpInput>(
    html`<lr-otp-input label="Code" type="alphanumeric" case="upper"></lr-otp-input>`
  );
  await type(el, 'ab1');
  expect(el.value).to.equal('AB1');
});

it('keeps the declared ASCII alpha vocabulary under a Turkish locale case transform', async () => {
  const upper = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Code" locale="tr" type="alpha" case="upper"></lr-otp-input>
  `);
  await type(upper, 'i');
  expect(upper.value).to.equal('I');

  const lower = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Code" locale="tr" type="alpha" case="lower"></lr-otp-input>
  `);
  await type(lower, 'I');
  expect(lower.value).to.equal('i');
});

it('defers sanitization and public editing events while IME composition is in progress', async () => {
  const el = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Code" type="alphanumeric" case="upper"></lr-otp-input>
  `);
  const control = controlOf(el);
  const inputs: InputEvent[] = [];
  const completions: CustomEvent[] = [];
  el.addEventListener('input', (event) => inputs.push(event as InputEvent));
  el.addEventListener('lr-complete', (event) => completions.push(event as CustomEvent));

  control.value = 'あ';
  control.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'あ',
      inputType: 'insertCompositionText',
      isComposing: true,
    })
  );
  expect(el.value).to.equal('');
  expect(control.value).to.equal('あ');
  expect(inputs).to.have.lengthOf(0);
  expect(completions).to.have.lengthOf(0);

  control.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true, data: 'a1' }));
  control.value = 'a1';
  control.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'a1',
      inputType: 'insertCompositionText',
      isComposing: false,
    })
  );
  await el.updateComplete;
  expect(el.value).to.equal('A1');
  expect(control.value).to.equal('A1');
  expect(inputs).to.have.lengthOf(1);
  expect(completions).to.have.lengthOf(0);
});

it('defers a genuinely foreign composing InputEvent after adoption', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;
  const el = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Code" type="alphanumeric" case="upper"></lr-otp-input>
  `);

  try {
    el.remove();
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    const control = controlOf(el);
    const publicInputs: InputEvent[] = [];
    el.addEventListener('input', (event) => publicInputs.push(event as InputEvent));
    const composing = new frameWindow.InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'あ',
      inputType: 'insertCompositionText',
      isComposing: true,
    });
    expect(composing instanceof InputEvent, 'the composition event is not ambient-branded').to.be.false;

    control.value = 'あ';
    control.dispatchEvent(composing);

    expect(el.value, 'composition text is not sanitized into the public value early').to.equal('');
    expect(control.value, 'the native editor retains its composition text').to.equal('あ');
    expect(publicInputs.length, 'no public edit is published before composition ends').to.equal(0);
  } finally {
    el.remove();
    iframe.remove();
  }
});

it('re-sanitizes an existing value when type narrows', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" type="alphanumeric"></lr-otp-input>`);
  await type(el, 'a1b2');
  expect(el.value).to.equal('a1b2');
  el.type = 'numeric';
  await el.updateComplete;
  expect(el.value).to.equal('12');
});

it('moves the active segment with clamped physical arrows in LTR and RTL', async () => {
  const ltr = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
  ltr.focus();
  await ltr.updateComplete;
  expect(activeIndexOf(ltr)).to.equal(3);
  expect(key(ltr, 'ArrowLeft').defaultPrevented).to.equal(true);
  await ltr.updateComplete;
  expect(activeIndexOf(ltr)).to.equal(2);
  key(ltr, 'ArrowRight');
  key(ltr, 'ArrowRight');
  await ltr.updateComplete;
  expect(activeIndexOf(ltr), 'right edge clamps').to.equal(3);

  const rtl = await fixture<LyraOtpInput>(html`
    <div dir="rtl"><lr-otp-input label="Code" length="4" value="12"></lr-otp-input></div>
  `).then((wrapper) => wrapper.querySelector('lr-otp-input') as LyraOtpInput);
  rtl.focus();
  await rtl.updateComplete;
  expect(activeIndexOf(rtl)).to.equal(2);
  key(rtl, 'ArrowLeft');
  key(rtl, 'ArrowLeft');
  await rtl.updateComplete;
  expect(activeIndexOf(rtl), 'visually-left edge clamps').to.equal(3);
  key(rtl, 'ArrowRight');
  await rtl.updateComplete;
  expect(activeIndexOf(rtl)).to.equal(2);
});

it('clears fixed cells with Backspace and Delete without shifting trailing characters', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
  const inputs: InputEvent[] = [];
  el.addEventListener('input', (event) => inputs.push(event as InputEvent));
  el.focus();
  key(el, 'ArrowLeft');
  await el.updateComplete;
  expect(activeIndexOf(el)).to.equal(2);

  expect(key(el, 'Backspace').defaultPrevented).to.equal(true);
  await el.updateComplete;
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '2', '', '4']);
  expect(el.value).to.equal('124');
  expect(activeIndexOf(el)).to.equal(1);
  expect(inputs).to.have.lengthOf(1);
  expect(inputs[0].inputType).to.equal('deleteContentBackward');

  key(el, 'Delete');
  await el.updateComplete;
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '', '', '4']);
  expect(el.value).to.equal('14');
  expect(activeIndexOf(el)).to.equal(1);
  expect(inputs).to.have.lengthOf(2);
  expect(inputs[1].inputType).to.equal('deleteContentForward');

  key(el, 'Backspace');
  await el.updateComplete;
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '', '', '4']);
  expect(activeIndexOf(el), 'an empty current cell still moves back without clearing another').to.equal(0);
  expect(inputs, 'an empty-cell no-op emits no edit').to.have.lengthOf(2);
});

it('emits lr-clear once when fixed-cell Backspace clears the last occupied cell', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="1" value="7"></lr-otp-input> `);
  const order: string[] = [];
  el.addEventListener('input', () => order.push('input'));
  el.addEventListener('lr-clear', () => order.push('lr-clear'));
  el.focus();

  expect(key(el, 'Backspace').defaultPrevented).to.equal(true);
  await el.updateComplete;

  expect(el.value).to.equal('');
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['']);
  expect(activeIndexOf(el)).to.equal(0);
  expect(order).to.deep.equal(['input', 'lr-clear']);
});

it('makes select-all replacement part of fixed-cell keyboard editing', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
  el.select();

  key(el, '9');
  await el.updateComplete;

  expect(el.value).to.equal('9');
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['9', '', '', '']);
  expect(activeIndexOf(el)).to.equal(1);
  expect(controlOf(el).selectionStart).to.equal(1);
  expect(controlOf(el).selectionEnd).to.equal(1);
});

it('exposes a silent compact-string selection and range-editing facade', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-otp-input
        name="code"
        label="Code"
        length="4"
        type="alphanumeric"
        case="upper"
        required
        value="12AB"
      ></lr-otp-input>
    </form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  const facade = el as LyraOtpInput & OtpInputEditingFacade;
  const native = controlOf(el);
  const events: string[] = [];
  for (const type of ['input', 'change', 'lr-clear', 'lr-complete']) {
    el.addEventListener(type, () => events.push(type));
  }

  expect(facade.input === native).to.equal(true);
  facade.setSelectionRange(1, 3, 'forward');
  expect(facade.selectionStart).to.equal(1);
  expect(facade.selectionEnd).to.equal(3);
  expect(facade.selectionDirection).to.equal('forward');

  facade.setRangeText('z-', 1, 3, 'select');
  await el.updateComplete;
  expect(el.value).to.equal('1ZB');
  expect(native.value).to.equal('1ZB');
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', 'Z', 'B', '']);
  expect(facade.selectionStart).to.equal(1);
  expect(facade.selectionEnd).to.equal(2);
  expect(el.validity.tooShort).to.equal(true);
  expect(new FormData(form).get('code')).to.equal('1ZB');

  facade.selectionStart = 1;
  facade.selectionEnd = 2;
  facade.selectionDirection = 'backward';
  facade.setRangeText('99');
  await el.updateComplete;
  expect(el.value).to.equal('199B');
  expect(el.validity.valid).to.equal(true);
  expect(new FormData(form).get('code')).to.equal('199B');
  expect(events).to.deep.equal([]);
});

it('maps a collapsed host selection to the fixed-cell keyboard target', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
  const facade = el as LyraOtpInput & OtpInputEditingFacade;

  el.focus();
  facade.setSelectionRange(1, 1);
  key(el, '9');
  await el.updateComplete;

  expect(el.value).to.equal('1934');
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '9', '3', '4']);
  expect(activeIndexOf(el)).to.equal(2);
});

it('synchronizes printable and deletion edits from native Home, End, and pointer-like caret changes', async () => {
  const setNativeCaret = (el: LyraOtpInput, offset: number, eventType: 'click' | 'keyup' | 'select'): void => {
    const native = controlOf(el);
    native.setSelectionRange(offset, offset);
    native.dispatchEvent(eventType === 'keyup'
      ? new KeyboardEvent('keyup', { key: offset === 0 ? 'Home' : 'End', bubbles: true, composed: true })
      : new Event(eventType, { bubbles: true, composed: true }));
  };

  const home = await fixture<LyraOtpInput>(html`<lr-otp-input length="4" value="1234"></lr-otp-input>`);
  home.focus();
  setNativeCaret(home, 0, 'keyup');
  key(home, '9');
  await home.updateComplete;
  expect(home.value).to.equal('9234');

  const end = await fixture<LyraOtpInput>(html`<lr-otp-input length="4" value="1234"></lr-otp-input>`);
  end.focus();
  setNativeCaret(end, 4, 'select');
  key(end, '9');
  await end.updateComplete;
  expect(end.value).to.equal('1239');

  const pointer = await fixture<LyraOtpInput>(html`<lr-otp-input length="4" value="1234"></lr-otp-input>`);
  pointer.focus();
  setNativeCaret(pointer, 1, 'click');
  key(pointer, 'Delete');
  await pointer.updateComplete;
  expect(segmentsOf(pointer).map((segment) => segment.textContent)).to.deep.equal(['1', '', '3', '4']);

  setNativeCaret(pointer, 0, 'select');
  key(pointer, 'Backspace');
  await pointer.updateComplete;
  expect(segmentsOf(pointer).map((segment) => segment.textContent)).to.deep.equal(['', '', '3', '4']);
});

it('makes the selection facade safe before the native input renders', () => {
  const facade = document.createElement('lr-otp-input') as LyraOtpInput & OtpInputEditingFacade;

  expect(facade.input === null).to.equal(true);
  expect(facade.selectionStart).to.equal(null);
  expect(facade.selectionEnd).to.equal(null);
  expect(facade.selectionDirection).to.equal(null);
  expect(() => {
    facade.selectionStart = 0;
    facade.selectionEnd = 0;
    facade.selectionDirection = 'forward';
    facade.select();
    facade.setSelectionRange(0, 0);
    facade.setRangeText('ignored');
  }).to.not.throw();
  expect(facade.value).to.equal('');
});

it('clears a select-all range with either deletion key in one input operation', async () => {
  for (const deletionKey of ['Backspace', 'Delete']) {
    const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
    const inputs: InputEvent[] = [];
    let clears = 0;
    el.addEventListener('input', (event) => inputs.push(event as InputEvent));
    el.addEventListener('lr-clear', () => {
      clears += 1;
    });
    el.select();

    key(el, deletionKey);
    await el.updateComplete;

    expect(el.value, deletionKey).to.equal('');
    expect(
      segmentsOf(el).map((segment) => segment.textContent),
      deletionKey
    ).to.deep.equal(['', '', '', '']);
    expect(inputs, deletionKey).to.have.lengthOf(1);
    expect(inputs[0].inputType).to.equal(
      deletionKey === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward'
    );
    expect(clears, deletionKey).to.equal(1);
    expect(activeIndexOf(el), deletionKey).to.equal(0);
    expect(controlOf(el).selectionStart, deletionKey).to.equal(0);
    expect(controlOf(el).selectionEnd, deletionKey).to.equal(0);
  }
});

it('maps a compact native selection range back onto occupied fixed cells', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
  el.focus();
  key(el, 'ArrowLeft');
  key(el, 'Delete');
  await el.updateComplete;
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '2', '', '4']);
  expect(controlOf(el).value).to.equal('124');

  controlOf(el).setSelectionRange(1, 3);
  key(el, '9');
  await el.updateComplete;

  expect(el.value).to.equal('19');
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '9', '', '']);
  expect(activeIndexOf(el)).to.equal(2);
  expect(controlOf(el).selectionStart).to.equal(2);
  expect(controlOf(el).selectionEnd).to.equal(2);
});

it('replaces a fixed cell and advances when typing after a middle deletion', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
  el.focus();
  key(el, 'ArrowLeft');
  key(el, 'Delete');
  await el.updateComplete;
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '2', '', '4']);

  key(el, '9');
  await el.updateComplete;
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '2', '9', '4']);
  expect(el.value).to.equal('1294');
  expect(activeIndexOf(el)).to.equal(3);
});

it('emits one native change when a fixed-cell keyboard edit settles on blur', async () => {
  const wrapper = await fixture<HTMLElement>(html` <div><lr-otp-input label="Code" length="4"></lr-otp-input></div> `);
  const el = wrapper.querySelector('lr-otp-input') as LyraOtpInput;
  const changes: Event[] = [];
  wrapper.addEventListener('change', (event) => changes.push(event));

  el.focus();
  key(el, '1');
  el.blur();

  expect(changes).to.have.lengthOf(1);
  expect(changes[0].target === el).to.equal(true);
  expect(changes[0].bubbles && changes[0].composed).to.equal(true);
  expect(changes[0].cancelable).to.equal(false);
});

it('submits its owning form exactly once on Enter, leaving the keystroke uncancelled', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="1234"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });

  // The internal input has no form owner, so the keystroke has no default action to cancel here;
  // cancelling it would only suppress unrelated handlers downstream.
  expect(key(el, 'Enter').defaultPrevented).to.equal(false);
  expect(submits).to.equal(1);
});

it('never submits on an Enter that commits an IME candidate', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="1234"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });

  const composing = key(el, 'Enter', { isComposing: true });
  expect(submits, 'Enter commits the highlighted candidate, it does not submit').to.equal(0);
  expect(composing.defaultPrevented, 'and the keystroke is left to the IME').to.equal(false);

  key(el, 'Enter', { keyCode: 229 });
  expect(submits, 'keyCode 229 is the fallback for engines that under-report isComposing').to.equal(0);

  key(el, 'Enter');
  expect(submits, 'a bare Enter still submits').to.equal(1);
});

it('never submits on a modifier-held Enter', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="1234"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });

  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const) {
    const event = key(el, 'Enter', { [modifier]: true });
    expect(submits, `${modifier}+Enter is an application shortcut, never a submission`).to.equal(0);
    expect(event.defaultPrevented, `${modifier}+Enter stays available to the application`).to.equal(false);
  }

  key(el, 'Enter');
  expect(submits).to.equal(1);
});

it('leaves an already-vetoed Enter keydown vetoed', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="1234"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });

  const veto = (event: Event): void => event.preventDefault();
  el.addEventListener('keydown', veto, true);
  key(el, 'Enter');
  el.removeEventListener('keydown', veto, true);
  expect(submits).to.equal(0);

  key(el, 'Enter');
  expect(submits).to.equal(1);
});

it('does not submit on Enter while readonly', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="1234" readonly></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });

  key(el, 'Enter');
  expect(submits, 'a non-interactive control stays inert, as every sibling control does').to.equal(0);

  el.readonly = false;
  await el.updateComplete;
  key(el, 'Enter');
  expect(submits).to.equal(1);
});

it("names the form's first enabled native submit button as SubmitEvent.submitter", async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-otp-input name="code" label="Code" length="4" value="1234"></lr-otp-input>
      <button type="submit" id="off" disabled>Off</button>
      <button type="submit" id="go" name="action" value="save">Go</button>
    </form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submitterId = '';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitterId = ((event as SubmitEvent).submitter as HTMLElement | null)?.id ?? '';
  });

  key(el, 'Enter');
  expect(submitterId, 'the default button carries its own name/value into the submission').to.equal('go');
});

it('activates an lr-button submitter, which requestSubmit() itself would reject', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-otp-input name="code" label="Code" length="4" value="1234"></lr-otp-input>
      <lr-button id="go" type="submit" name="action" value="save">Go</lr-button>
    </form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submits = 0;
  let submitterName = '';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
    // lr-button routes its own submission through a transient named native submitter, so the name
    // proves the button was activated rather than the form being submitted behind it.
    submitterName = ((event as SubmitEvent).submitter as HTMLButtonElement | null)?.name ?? '';
  });

  key(el, 'Enter');
  expect(submits).to.equal(1);
  expect(submitterName, 'the lr-button was the submitter').to.equal('action');
});

it('autosubmits through the resolved default button rather than behind it', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-otp-input name="code" label="Code" length="3" autosubmit></lr-otp-input>
      <button type="submit" id="go">Go</button>
    </form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submitterId = '';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitterId = ((event as SubmitEvent).submitter as HTMLElement | null)?.id ?? '';
  });

  await type(el, '123');
  await aTimeout(0);
  expect(submitterId).to.equal('go');
});

it('passes a foreign native autosubmit button to requestSubmit instead of clicking it', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="1" autosubmit></lr-otp-input></form>
  `);
  const button = frameDocument.createElement('button');
  button.type = 'submit';
  form.append(button);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  const requested: Array<HTMLElement | undefined> = [];
  let clicks = 0;
  form.requestSubmit = ((submitter?: HTMLElement) => requested.push(submitter)) as typeof form.requestSubmit;
  button.click = (() => {
    clicks += 1;
  }) as typeof button.click;

  try {
    expect(button instanceof HTMLButtonElement, 'the submitter is genuinely foreign').to.be.false;
    const control = controlOf(el);
    control.value = '7';
    control.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        data: '7',
        inputType: 'insertText',
      })
    );
    await aTimeout(0);

    expect(requested.length).to.equal(1);
    expect(requested[0] === button).to.be.true;
    expect(clicks, 'native submitters do not take the FACE activation branch').to.equal(0);
  } finally {
    iframe.remove();
  }
});

it('lets a listener that vetoes lr-complete asynchronously suppress the autosubmission', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="3" autosubmit></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  // The veto point is real, so it has to survive one await — a listener that checks the code
  // before letting the form go cannot decide synchronously.
  el.addEventListener(
    'lr-complete',
    async (event) => {
      await Promise.resolve();
      event.preventDefault();
    },
    { once: true }
  );

  await type(el, '123');
  await aTimeout(0);
  expect(submits).to.equal(0);
});

it('fills an empty field from a full sanitized paste with one input and one completion', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4"></lr-otp-input> `);
  const inputs: InputEvent[] = [];
  const completions: CustomEvent<{ value: string }>[] = [];
  el.addEventListener('input', (event) => inputs.push(event as InputEvent));
  el.addEventListener('lr-complete', (event) => completions.push(event as CustomEvent<{ value: string }>));

  const event = paste(el, 'ABC-1234');
  await el.updateComplete;

  expect(event.defaultPrevented).to.equal(true);
  expect(el.value).to.equal('1234');
  expect(segmentsOf(el).map((segment) => segment.textContent)).to.deep.equal(['1', '2', '3', '4']);
  expect(inputs).to.have.lengthOf(1);
  expect(inputs[0].inputType).to.equal('insertFromPaste');
  expect(completions).to.have.lengthOf(1);
  expect(completions[0].detail.value).to.equal('1234');
});

it('emits completion and autosubmits only on an incomplete-to-complete transition', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" autosubmit></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let completions = 0;
  let submits = 0;
  el.addEventListener('lr-complete', () => {
    completions += 1;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });

  await type(el, '1234');
  await aTimeout(0);
  expect(completions).to.equal(1);
  expect(submits).to.equal(1);

  el.focus();
  key(el, 'ArrowLeft');
  key(el, '9');
  await el.updateComplete;
  await aTimeout(0);
  expect(el.value).to.equal('1294');
  expect(completions, 'a replacement kept the field complete').to.equal(1);
  expect(submits).to.equal(1);

  key(el, 'Delete');
  key(el, '8');
  await el.updateComplete;
  await aTimeout(0);
  expect(completions, 'refilling a cleared cell completes again').to.equal(2);
  expect(submits).to.equal(2);
});

it('sanitizes a direct value assignment synchronously for the IDL and FormData without events', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  const events: string[] = [];
  el.addEventListener('input', () => events.push('input'));
  el.addEventListener('change', () => events.push('change'));
  el.addEventListener('lr-complete', () => events.push('lr-complete'));

  el.value = 'a1b2c345';

  expect(el.value).to.equal('1234');
  expect(new FormData(form).get('code')).to.equal('1234');
  expect(events).to.deep.equal([]);
});

it('sanitizes a pristine declarative default while preserving dirty/default reset semantics', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-otp-input name="code" label="Code" length="4" value="a1b2c345"></lr-otp-input>
    </form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  expect(el.value).to.equal('1234');
  expect(new FormData(form).get('code')).to.equal('1234');

  await type(el, '9876');
  el.setAttribute('value', 'x5y6z789');
  await el.updateComplete;
  expect(el.value, 'a dirty live value is not overwritten by a changed default').to.equal('9876');

  form.reset();
  await el.updateComplete;
  expect(el.value, 'reset restores the sanitized current default').to.equal('5678');
  expect(controlOf(el).value).to.equal('5678');
});

it('sanitizes a defaultValue assignment into the live value while the control is pristine', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4"></lr-otp-input> `);

  el.defaultValue = 'a1b2c345';

  expect(el.defaultValue).to.equal('a1b2c345');
  expect(el.value).to.equal('1234');
  await el.updateComplete;
  expect(controlOf(el).value).to.equal('1234');
});

it('emits lr-complete on an incomplete-to-complete input transition', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="3"></lr-otp-input>`);
  const complete = oneEvent(el, 'lr-complete');
  await type(el, '123');
  const event = await complete;
  expect(event.detail.value).to.equal('123');
  expect(event.cancelable).to.be.true;
  expect(event.bubbles && event.composed).to.be.true;
});

it('clear() clears the live value, returns focus, and emits lr-clear once', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
  const cleared = oneEvent(el, 'lr-clear');
  el.clear();
  const event = await cleared;
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(controlOf(el).value).to.equal('');
  expect(el.shadowRoot!.activeElement === controlOf(el)).to.be.true;
  expect(event.bubbles && event.composed).to.be.true;
  expect(event.cancelable).to.be.false;
});

it('emits lr-clear when user editing clears the last entered character', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code"></lr-otp-input>`);
  await type(el, '1');
  const cleared = oneEvent(el, 'lr-clear');
  await type(el, '');
  await cleared;
  expect(el.value).to.equal('');
});

it('autosubmits only after the cancelable completion event and honors preventDefault()', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-otp-input name="code" label="Code" length="3" autosubmit></lr-otp-input>
    </form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  const order: string[] = [];
  el.addEventListener('lr-complete', () => order.push('complete'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    order.push('submit');
  });

  await type(el, '123');
  await aTimeout(0);
  expect(order).to.deep.equal(['complete', 'submit']);

  el.clear();
  order.length = 0;
  el.addEventListener('lr-complete', (event) => event.preventDefault(), { once: true });
  await type(el, '456');
  await aTimeout(0);
  expect(order).to.deep.equal(['complete']);
});

it('does not let one completion task submit a synchronously replaced full code', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-otp-input name="code" label="Code" length="3" autosubmit></lr-otp-input>
    </form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  const submittedCodes: string[] = [];
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submittedCodes.push(String(new FormData(form).get('code')));
  });
  el.addEventListener('lr-complete', () => {
    el.value = '456';
  }, { once: true });

  await type(el, '123');
  await aTimeout(0);

  expect(el.value).to.equal('456');
  expect(submittedCodes).to.deep.equal([]);
});

it('retires a queued autosubmit across default, reset, and state-restore mutations', async () => {
  const cases: Array<{
    name: string;
    mutate(el: LyraOtpInput, form: HTMLFormElement): void;
  }> = [
    { name: 'default write', mutate: (el) => { el.defaultValue = '456'; } },
    {
      name: 'form reset',
      mutate: (el, form) => {
        el.defaultValue = '456';
        form.reset();
      },
    },
    { name: 'state restore', mutate: (el) => { el.formStateRestoreCallback('456', 'restore'); } },
  ];

  for (const testCase of cases) {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <lr-otp-input name="code" label="Code" length="3" autosubmit></lr-otp-input>
      </form>
    `);
    const el = form.querySelector('lr-otp-input') as LyraOtpInput;
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });
    el.addEventListener('lr-complete', () => testCase.mutate(el, form), { once: true });

    await type(el, '123');
    await aTimeout(0);

    expect(submits, testCase.name).to.equal(0);
  }
});

it('does not submit on completion while autosubmit is unset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="3"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  await type(el, '123');
  await aTimeout(0);
  expect(submits).to.equal(0);
});

it('relays exactly one non-composing native InputEvent with its editing payload from the real input', async () => {
  const wrapper = await fixture<HTMLElement>(html` <div><lr-otp-input label="Code" length="4"></lr-otp-input></div> `);
  const el = wrapper.querySelector('lr-otp-input') as LyraOtpInput;
  const control = controlOf(el);
  const events: InputEvent[] = [];
  wrapper.addEventListener('input', (event) => events.push(event as InputEvent));

  control.value = '7';
  control.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: '7',
      inputType: 'insertText',
      isComposing: false,
    })
  );

  expect(events).to.have.lengthOf(1);
  expect(events[0] instanceof InputEvent).to.be.true;
  expect(events[0].target === el && events[0].bubbles && events[0].composed).to.be.true;
  expect(events[0].data).to.equal('7');
  expect(events[0].inputType).to.equal('insertText');
  expect(events[0].isComposing).to.be.false;
});

it('relays exactly one host-target native non-cancelable change event', async () => {
  const wrapper = await fixture<HTMLElement>(html` <div><lr-otp-input label="Code" length="4"></lr-otp-input></div> `);
  const el = wrapper.querySelector('lr-otp-input') as LyraOtpInput;
  const events: Event[] = [];
  wrapper.addEventListener('change', (event) => events.push(event));

  controlOf(el).dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  expect(events).to.have.lengthOf(1);
  expect(events[0] instanceof Event).to.be.true;
  expect(events[0].target === el).to.equal(true);
  expect(events[0].bubbles && events[0].composed).to.be.true;
  expect(events[0].cancelable).to.be.false;
});

it('does not emit lr-complete while the code is short', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="3"></lr-otp-input>`);
  let fired = false;
  el.addEventListener('lr-complete', () => {
    fired = true;
  });
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

it('returns intrinsic invalid rendering to pristine on form reset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" required></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  await type(el, '1');
  expect(controlOf(el).getAttribute('aria-invalid')).to.equal('true');
  expect(segmentsOf(el).some((segment) => segment.getAttribute('part')!.split(/\s+/).includes('invalid'))).to.equal(
    true
  );

  form.reset();
  await el.updateComplete;

  expect(el.value).to.equal('');
  expect(el.validity.valueMissing).to.equal(true);
  expect(controlOf(el).getAttribute('aria-invalid')).to.equal('false');
  expect(segmentsOf(el).some((segment) => segment.getAttribute('part')!.split(/\s+/).includes('invalid'))).to.equal(
    false
  );
});

it('sanitizes browser-restored state without emitting editing events', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4"></lr-otp-input> `);
  const events: string[] = [];
  el.addEventListener('input', () => events.push('input'));
  el.addEventListener('change', () => events.push('change'));

  el.formStateRestoreCallback('a1b2c345', 'restore');

  expect(el.value).to.equal('1234');
  expect(events).to.deep.equal([]);
});

it('masks the displayed characters without changing the value', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4" mask></lr-otp-input>`);
  await type(el, '1234');
  expect(el.value).to.equal('1234');
  const filled = segmentsOf(el);
  expect(filled[0].textContent).to.equal('');
  expect(filled[0].getAttribute('part')!.split(/\s+/)).to.include('masked');
});

it('renders the mask glyph in empty segments when with-mask is set on its own', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4" with-mask></lr-otp-input>`);
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

it('keeps entered characters visible when with-mask is set without mask', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4" with-mask></lr-otp-input>`);
  await type(el, '12');
  const segments = segmentsOf(el);
  expect(segments[0].textContent).to.equal('1');
  expect(maskGlyphOf(segments[0]), 'filled segment').to.equal('');
  expect(maskGlyphOf(segments[2]), 'empty segment').to.equal('•');
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
  let delegatedCalls = 0;
  controlOf(el).click = () => {
    delegatedCalls += 1;
  };
  controlOf(el).focus = () => {
    delegatedCalls += 1;
  };
  el.click();
  el.focus();
  expect(delegatedCalls, 'fieldset disablement gates host click/focus delegation').to.equal(0);
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

it('relays one native focus/blur pair from the real input, and never lr-focus/lr-blur', async () => {
  const wrapper = await fixture<HTMLElement>(html` <div><lr-otp-input label="Code" length="4"></lr-otp-input></div> `);
  const el = wrapper.querySelector('lr-otp-input') as LyraOtpInput;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  wrapper.addEventListener('focus', (event) => nativeEvents.push(event as FocusEvent));
  wrapper.addEventListener('blur', (event) => nativeEvents.push(event as FocusEvent));
  wrapper.addEventListener('lr-focus', () => aliases.push('lr-focus'));
  wrapper.addEventListener('lr-blur', () => aliases.push('lr-blur'));

  el.focus();
  el.blur();

  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
  expect(aliases).to.deep.equal([]);
});

it('does not mark touched from a blur caused by the control itself becoming disabled', async () => {
  // Disabling a focused native control blurs it as plain platform
  // behaviour, not a real user interaction — that forced blur must not flip `touched`.
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
  controlOf(el).focus();
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === controlOf(el), 'precondition: the real input is focused').to.equal(true);

  el.disabled = true;
  await el.updateComplete;

  expect(
    (el as unknown as { touched: boolean }).touched,
    'a platform-forced blur from becoming disabled must not count as user interaction'
  ).to.equal(false);
});

it('still marks touched from a real blur while enabled', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
  controlOf(el).focus();
  await el.updateComplete;

  controlOf(el).blur();
  await el.updateComplete;

  expect((el as unknown as { touched: boolean }).touched).to.equal(true);
});

it('select() forwards to the real input and selects the complete code', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" value="1234"></lr-otp-input> `);
  el.select();
  expect(controlOf(el).selectionStart).to.equal(0);
  expect(controlOf(el).selectionEnd).to.equal(4);
});

it('exposes form-control part aliases and paints the required marker on a populated label', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" required></lr-otp-input> `);
  const base = partOf(el, 'base');
  const label = partOf(el, 'label');
  expect(base.getAttribute('part')!.split(/\s+/)).to.include.members(['base', 'form-control']);
  expect(label.getAttribute('part')!.split(/\s+/)).to.include.members(['label', 'form-control-label']);
  expect(getComputedStyle(label, '::after').content).to.contain('*');
});

it('applies label/hint attribute precedence and error-slot precedence without concatenating sources', async () => {
  const el = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Attribute label" hint="Attribute hint" error-text="Attribute error">
      <span slot="label">Slot label</span>
      <span slot="hint">Slot hint</span>
      <span slot="error">Slot error</span>
    </lr-otp-input>
  `);
  await aTimeout(0);
  await el.updateComplete;

  const label = partOf(el, 'label');
  const hint = partOf(el, 'hint');
  const error = partOf(el, 'error');
  const labelSlot = label.querySelector('slot') as HTMLSlotElement;
  const hintSlot = hint.querySelector('slot') as HTMLSlotElement;
  const errorSlot = error.querySelector('slot') as HTMLSlotElement;
  expect(label.textContent!.trim()).to.equal('Attribute label');
  expect(hint.textContent!.trim()).to.equal('Attribute hint');
  expect(error.textContent!.trim()).to.equal('');
  expect(labelSlot.hidden).to.equal(true);
  expect(hintSlot.hidden).to.equal(true);
  expect(errorSlot.hidden).to.equal(false);
  expect(errorSlot.assignedElements()[0].textContent).to.equal('Slot error');
  expect(controlOf(el).getAttribute('aria-labelledby')).to.equal(label.id);
  expect(controlOf(el).getAttribute('aria-describedby')!.split(/\s+/)).to.include.members([error.id, hint.id]);
  expect(controlOf(el).getAttribute('aria-invalid')).to.equal('true');
  await expect(el).to.be.accessible();
});

it('uses populated label, hint, and error slots as the accessible chrome when attributes are empty', async () => {
  const el = await fixture<LyraOtpInput>(html`
    <lr-otp-input>
      <span slot="label">Slot label</span>
      <span slot="hint">Slot hint</span>
      <span slot="error">Slot error</span>
    </lr-otp-input>
  `);
  await aTimeout(0);
  await el.updateComplete;

  for (const name of ['label', 'hint', 'error']) {
    const part = partOf(el, name);
    const slot = part.querySelector('slot') as HTMLSlotElement;
    expect(slot.hidden, `${name} slot is rendered`).to.equal(false);
    expect(slot.assignedElements()[0].textContent).to.equal(`Slot ${name}`);
  }
  expect(controlOf(el).hasAttribute('aria-label')).to.equal(false);
  expect(controlOf(el).getAttribute('aria-labelledby')).to.equal(partOf(el, 'label').id);
  expect(controlOf(el).getAttribute('aria-invalid')).to.equal('true');
  await expect(el).to.be.accessible();
});

it('renders explicit errorText and its ARIA state immediately without faking intrinsic interaction', async () => {
  const el = await fixture<LyraOtpInput>(html`
    <lr-otp-input label="Code" error-text="That code is unavailable."></lr-otp-input>
  `);
  const error = partOf(el, 'error');
  expect(error.hidden).to.equal(false);
  expect(error.textContent!.trim()).to.equal('That code is unavailable.');
  expect(controlOf(el).getAttribute('aria-describedby')!.split(/\s+/)).to.include(error.id);
  expect(controlOf(el).getAttribute('aria-invalid')).to.equal('true');
  expect(segmentsOf(el).some((segment) => segment.getAttribute('part')!.split(/\s+/).includes('invalid'))).to.equal(
    false
  );
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

it('suspends intrinsic required/completeness validity while readonly and restores it when editable', async () => {
  const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" required></lr-otp-input> `);
  await type(el, '12');
  expect(el.validity.tooShort).to.equal(true);

  el.readonly = true;
  await el.updateComplete;
  expect(el.validity.valid).to.equal(true);

  el.readonly = false;
  await el.updateComplete;
  expect(el.validity.tooShort).to.equal(true);

  el.value = '';
  el.readonly = true;
  await el.updateComplete;
  expect(el.validity.valid).to.equal(true);
  el.readonly = false;
  await el.updateComplete;
  expect(el.validity.valueMissing).to.equal(true);
});

it('exposes the real input and validation target as public readonly views', async () => {
  const disconnected = document.createElement('lr-otp-input') as LyraOtpInput;
  expect(disconnected.input === null).to.equal(true);
  expect(disconnected.validationTarget === null).to.equal(true);

  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code"></lr-otp-input>`);
  expect(el.input === controlOf(el)).to.equal(true);
  expect(el.validationTarget === controlOf(el)).to.equal(true);
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

  it('resetValidity() clears the consumer error and restores intrinsic validity', async () => {
    const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" required></lr-otp-input> `);
    el.setCustomValidity('Server said no.');
    expect(el.validity.customError).to.equal(true);

    el.resetValidity();

    expect(el.validity.customError).to.equal(false);
    expect(el.validity.valueMissing).to.equal(true);
    expect(el.validationMessage).to.equal('This field is required.');
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
  it('publishes mapped blank/filled, disabled, and readonly states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = await fixture<LyraOtpInput>(html`
      <lr-otp-input label="Code" length="3" readonly disabled></lr-otp-input>
    `);
    expect(el.matches(':state(--blank)'), '--blank').to.equal(true);
    expect(el.matches(':state(--filled)'), '--filled').to.equal(false);
    expect(el.matches(':state(disabled)'), 'disabled').to.equal(true);
    expect(el.matches(':state(readonly)'), 'readonly').to.equal(true);

    el.disabled = false;
    el.readonly = false;
    el.value = '123';
    await el.updateComplete;
    expect(el.matches(':state(--blank)'), '--blank after fill').to.equal(false);
    expect(el.matches(':state(--filled)'), '--filled after fill').to.equal(true);
    expect(el.matches(':state(disabled)'), 'enabled').to.equal(false);
    expect(el.matches(':state(readonly)'), 'editable').to.equal(false);
  });

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

  it('reveals intrinsic ARIA and segment invalid styling after reportValidity()', async () => {
    const el = await fixture<LyraOtpInput>(html` <lr-otp-input label="Code" length="4" required></lr-otp-input> `);
    expect(controlOf(el).getAttribute('aria-invalid')).to.equal('false');
    expect(segmentsOf(el).some((segment) => segment.getAttribute('part')!.split(/\s+/).includes('invalid'))).to.equal(
      false
    );

    el.reportValidity();
    await el.updateComplete;

    expect(controlOf(el).getAttribute('aria-invalid')).to.equal('true');
    expect(segmentsOf(el).every((segment) => segment.getAttribute('part')!.split(/\s+/).includes('invalid'))).to.equal(
      true
    );
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
