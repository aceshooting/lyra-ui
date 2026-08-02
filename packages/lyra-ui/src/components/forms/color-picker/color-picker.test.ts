import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './color-picker.js';
import type { LyraColorPicker } from './color-picker.js';

const part = (el: LyraColorPicker, name: string): HTMLElement =>
  el.shadowRoot!.querySelector(`[part~="${name}"]`) as HTMLElement;
const parts = (el: LyraColorPicker, name: string): HTMLElement[] =>
  Array.from(el.shadowRoot!.querySelectorAll(`[part~="${name}"]`)) as HTMLElement[];
const count = (el: LyraColorPicker, name: string): number =>
  el.shadowRoot!.querySelectorAll(`[part~="${name}"]`).length;

async function opened(markup = html`<lr-color-picker label="Accent"></lr-color-picker>`): Promise<LyraColorPicker> {
  const el = (await fixture(markup)) as LyraColorPicker;
  el.open = true;
  await el.updateComplete;
  return el;
}

function press(target: HTMLElement, key: string, shiftKey = false): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, composed: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, shiftKey, bubbles: true, composed: true }));
}

// ---------------------------------------------------------------------------
// Form-control chrome (pre-existing contract, kept working)
// ---------------------------------------------------------------------------

it('renders a trigger button wired to the label and keeps the form value', async () => {
  const el = (await fixture(
    html`<lr-color-picker label="Accent" value="#ff0000"></lr-color-picker>`,
  )) as LyraColorPicker;
  await el.updateComplete;
  const trigger = part(el, 'trigger') as HTMLButtonElement;
  expect(trigger.localName).to.equal('button');
  expect(trigger.type).to.equal('button');
  expect(el.value).to.equal('#ff0000');
  const label = part(el, 'form-control-label');
  expect(label.getAttribute('for')).to.equal(trigger.id);
  expect(trigger.id.length > 0).to.be.true;
  await expect(el).to.be.accessible();
});

it('exposes the label under both the form-control-label and label part tokens', async () => {
  const el = (await fixture(html`<lr-color-picker label="Accent"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  const label = part(el, 'form-control-label');
  expect(label.getAttribute('part')).to.contain('label');
});

it('renders errorText and an error slot, wiring aria-describedby to the rendered hint/error ids', async () => {
  const el = (await fixture(
    html`<lr-color-picker label="Accent" hint="Pick a brand color" error-text="Not a valid color"></lr-color-picker>`,
  )) as LyraColorPicker;
  await el.updateComplete;
  const trigger = part(el, 'trigger');
  const errorPart = part(el, 'error');
  const hintPart = part(el, 'hint');

  expect(errorPart.hidden).to.be.false;
  expect(errorPart.textContent).to.contain('Not a valid color');
  const describedBy = (trigger.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
  expect(describedBy).to.include(errorPart.id);
  expect(describedBy).to.include(hintPart.id);
});

it('hides the error part when errorText is unset and no error slot content is assigned', async () => {
  const el = (await fixture(html`<lr-color-picker></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  expect(part(el, 'error').hidden).to.be.true;
});

it('shows a required-field asterisk after the label', async () => {
  const el = (await fixture(html`<lr-color-picker label="Accent" required></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  expect(getComputedStyle(part(el, 'form-control-label'), '::after').content).to.contain('*');
});

it('keeps a live slotted label idref as the trigger and panel name while host aria-label still wins', async () => {
  const el = (await fixture(html`
    <lr-color-picker><span slot="label">Brand colour</span></lr-color-picker>
  `)) as LyraColorPicker;
  await el.updateComplete;
  const label = part(el, 'form-control-label');
  const trigger = part(el, 'trigger');
  const panel = part(el, 'panel');
  expect(label.id.length > 0).to.equal(true);
  expect(trigger.getAttribute('aria-labelledby')).to.equal(label.id);
  expect(panel.getAttribute('aria-labelledby')).to.equal(label.id);
  expect(trigger.hasAttribute('aria-label')).to.equal(false);
  expect(panel.hasAttribute('aria-label')).to.equal(false);

  const slotted = el.querySelector('[slot="label"]') as HTMLElement;
  slotted.textContent = 'Updated brand colour';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(slotted.textContent).to.equal('Updated brand colour');
  expect(trigger.getAttribute('aria-labelledby')).to.equal(label.id);
  expect(panel.getAttribute('aria-labelledby')).to.equal(label.id);

  el.setAttribute('aria-label', 'Explicit picker name');
  await el.updateComplete;
  expect(trigger.getAttribute('aria-label')).to.equal('Explicit picker name');
  expect(panel.getAttribute('aria-label')).to.equal('Explicit picker name');
  expect(trigger.hasAttribute('aria-labelledby')).to.equal(false);
  expect(panel.hasAttribute('aria-labelledby')).to.equal(false);
});

it('shows slotted hint/label/error content on the very first render, not only after a later slotchange', async () => {
  const el = document.createElement('lr-color-picker') as LyraColorPicker;
  el.innerHTML =
    '<span slot="label">Accent</span><span slot="hint">Pick a color</span><span slot="error">Required</span>';
  document.body.append(el);
  await el.updateComplete;
  expect(part(el, 'form-control-label').hidden, 'label').to.be.false;
  expect(part(el, 'hint').hidden, 'hint').to.be.false;
  expect(part(el, 'error').hidden, 'error').to.be.false;
  el.remove();
});

it('keeps the black preview separate from the empty public default, validity, reset value, and FormData', async () => {
  const form = (await fixture(html`
    <form><lr-color-picker name="accent" required></lr-color-picker></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-color-picker') as LyraColorPicker;
  await el.updateComplete;

  expect((part(el, 'input') as HTMLInputElement).value).to.equal('#000000');
  expect(el.value).to.equal('');
  expect(new FormData(form).get('accent')).to.equal('');
  expect(el.checkValidity()).to.be.false;

  el.value = '#ff0000';
  await el.updateComplete;
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(new FormData(form).get('accent')).to.equal('');
  expect(el.checkValidity()).to.be.false;
});

it('publishes pristine and user-invalid state on both accessibility owners and clears it again', async () => {
  const form = (await fixture(html`
    <form><lr-color-picker label="Accent" name="accent" required></lr-color-picker></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-color-picker') as LyraColorPicker;
  await el.updateComplete;
  const trigger = part(el, 'trigger');
  const input = part(el, 'input');

  expect(trigger.getAttribute('aria-invalid')).to.equal('false');
  expect(input.getAttribute('aria-invalid')).to.equal('false');

  trigger.focus();
  trigger.blur();
  await el.updateComplete;
  expect(trigger.getAttribute('aria-invalid')).to.equal('true');
  expect(input.getAttribute('aria-invalid')).to.equal('true');

  el.value = '#ff0000';
  await el.updateComplete;
  expect(trigger.getAttribute('aria-invalid')).to.equal('false');
  expect(input.getAttribute('aria-invalid')).to.equal('false');

  el.setCustomValidity('Rejected colour');
  await el.updateComplete;
  expect(trigger.getAttribute('aria-invalid')).to.equal('true');
  expect(input.getAttribute('aria-invalid')).to.equal('true');
  el.setCustomValidity('');
  await el.updateComplete;
  expect(trigger.getAttribute('aria-invalid')).to.equal('false');

  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(trigger.getAttribute('aria-invalid')).to.equal('false');
  expect(input.getAttribute('aria-invalid')).to.equal('false');

  el.errorText = 'Visible error';
  await el.updateComplete;
  expect(trigger.getAttribute('aria-invalid')).to.equal('true');
  expect(input.getAttribute('aria-invalid')).to.equal('true');
});

it('reportValidity marks an invalid picker for assistive technology', async () => {
  const el = (await fixture(
    html`<lr-color-picker label="Accent" required></lr-color-picker>`,
  )) as LyraColorPicker;
  await el.updateComplete;
  expect(part(el, 'trigger').getAttribute('aria-invalid')).to.equal('false');
  expect(el.reportValidity()).to.equal(false);
  await el.updateComplete;
  expect(part(el, 'trigger').getAttribute('aria-invalid')).to.equal('true');
  expect(part(el, 'input').getAttribute('aria-invalid')).to.equal('true');
});

it('accepts default-value as the Shoelace reset-default spelling', async () => {
  const form = (await fixture(html`
    <form><lr-color-picker name="accent" default-value="#ff0000"></lr-color-picker></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-color-picker') as LyraColorPicker;
  await el.updateComplete;

  expect(el.defaultValue).to.equal('#ff0000');
  expect(el.value).to.equal('#ff0000');
  el.value = '#0000ff';
  await el.updateComplete;
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('#ff0000');
  expect(new FormData(form).get('accent')).to.equal('#ff0000');
});

it('reflects with-label and with-hint as SSR slot-presence hints', async () => {
  const el = (await fixture(html`
    <lr-color-picker with-label with-hint>
      <span slot="label">Accent</span>
      <span slot="hint">Choose a colour</span>
    </lr-color-picker>
  `)) as LyraColorPicker;
  await el.updateComplete;

  expect(el.withLabel).to.equal(true);
  expect(el.withHint).to.equal(true);
  expect(el.getAttribute('with-label')).to.equal('');
  expect(el.getAttribute('with-hint')).to.equal('');
  expect(part(el, 'form-control-label').hidden).to.equal(false);
  expect(part(el, 'hint').hidden).to.equal(false);
});

it('forwards host click/focus/blur and suppresses click when effectively disabled', async () => {
  const form = (await fixture(html`
    <form><fieldset><lr-color-picker></lr-color-picker></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-color-picker') as LyraColorPicker;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;
  const trigger = part(el, 'trigger');
  let clicks = 0;
  trigger.addEventListener('click', () => clicks++);

  el.click();
  expect(clicks).to.equal(1);
  el.focus();
  expect(el.shadowRoot!.activeElement === trigger).to.be.true;
  el.blur();
  expect(el.shadowRoot!.activeElement === trigger).to.be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  el.click();
  expect(clicks).to.equal(1);
});

it('keeps direct and fieldset-disabled inline pickers out of programmatic focus', async () => {
  const direct = (await fixture(
    html`<lr-color-picker inline disabled label="Direct"></lr-color-picker>`,
  )) as LyraColorPicker;
  direct.focus();
  expect(direct.shadowRoot!.activeElement === null).to.equal(true);

  const form = (await fixture(html`
    <form><fieldset disabled><lr-color-picker inline label="Inherited"></lr-color-picker></fieldset></form>
  `)) as HTMLFormElement;
  const inherited = form.querySelector('lr-color-picker') as LyraColorPicker;
  await inherited.updateComplete;
  inherited.focus();
  expect(inherited.shadowRoot!.activeElement === null).to.equal(true);
});

it('visually marks direct and fieldset-cascaded disabled state across every pointer surface', async () => {
  const form = (await fixture(html`
    <form><fieldset disabled><lr-color-picker opacity swatches="#ff0000"></lr-color-picker></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-color-picker') as LyraColorPicker;
  await el.updateComplete;
  expect(getComputedStyle(el).opacity).to.equal(
    getComputedStyle(el).getPropertyValue('--lr-opacity-disabled').trim(),
  );
  const pointerParts = [
    'trigger',
    'grid',
    'grid-handle',
    'hue-slider',
    'hue-slider-handle',
    'opacity-slider',
    'opacity-slider-handle',
    'input',
    'format-button',
    'swatch',
  ];
  for (const name of pointerParts) {
    expect(getComputedStyle(part(el, name)).cursor, `fieldset ${name}`).to.equal('not-allowed');
  }

  (form.querySelector('fieldset') as HTMLFieldSetElement).disabled = false;
  el.disabled = true;
  await el.updateComplete;
  for (const name of pointerParts) {
    expect(getComputedStyle(part(el, name)).cursor, `direct ${name}`).to.equal('not-allowed');
  }
});

it('defaults to size "m", scales the visible swatch, and keeps every trigger at the shared hit-area floor', async () => {
  const expected: Record<string, string> = {
    '2xs': '20px',
    xs: '24px',
    s: '30px',
    m: '40px',
    l: '48px',
    xl: '56px',
  };
  const defaultEl = (await fixture(html`<lr-color-picker></lr-color-picker>`)) as LyraColorPicker;
  expect(defaultEl.size).to.equal('m');
  for (const [size, px] of Object.entries(expected)) {
    const el = (await fixture(
      html`<lr-color-picker size=${size} aria-label="Color"></lr-color-picker>`,
    )) as LyraColorPicker;
    await el.updateComplete;
    const trigger = part(el, 'trigger');
    expect(trigger.getBoundingClientRect().width, `target width size=${size}`).to.be.at.least(40);
    expect(trigger.getBoundingClientRect().height, `target height size=${size}`).to.be.at.least(40);
    expect(getComputedStyle(trigger, '::before').blockSize, `visible block-size size=${size}`).to.equal(px);
    expect(getComputedStyle(trigger, '::before').inlineSize, `visible inline-size size=${size}`).to.equal(px);
  }
});

it('accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l', async () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['small', 's'],
    ['medium', 'm'],
    ['large', 'l'],
  ];
  for (const [alias, step] of pairs) {
    const aliasEl = (await fixture(
      html`<lr-color-picker size=${alias} aria-label="Color"></lr-color-picker>`,
    )) as LyraColorPicker;
    const stepEl = (await fixture(
      html`<lr-color-picker size=${step} aria-label="Color"></lr-color-picker>`,
    )) as LyraColorPicker;
    await aliasEl.updateComplete;
    await stepEl.updateComplete;
    expect(getComputedStyle(part(aliasEl, 'trigger'), '::before').blockSize, `block-size for ${alias}`).to.equal(
      getComputedStyle(part(stepEl, 'trigger'), '::before').blockSize,
    );
    expect(getComputedStyle(part(aliasEl, 'trigger'), '::before').inlineSize, `inline-size for ${alias}`).to.equal(
      getComputedStyle(part(stepEl, 'trigger'), '::before').inlineSize,
    );
  }
});

it('lets a consumer hover rule override the trigger part without important', async () => {
  const frame = (await fixture(html`
    <div>
      <style>lr-color-picker::part(trigger):hover { border-color: rgb(1, 2, 3); }</style>
      <lr-color-picker label="A"></lr-color-picker>
    </div>
  `)) as HTMLElement;
  const el = frame.querySelector('lr-color-picker') as LyraColorPicker;
  const trigger = part(el, 'trigger');
  const rect = trigger.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(trigger).borderColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});

// ---------------------------------------------------------------------------
// format / uppercase / value round-tripping
// ---------------------------------------------------------------------------

it('defaults to lowercase hex and normalizes any parseable input to it', async () => {
  const el = (await fixture(html`<lr-color-picker value="#FF0000"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  expect(el.format).to.equal('hex');
  expect(el.value).to.equal('#ff0000');

  el.value = 'red';
  await el.updateComplete;
  expect(el.value).to.equal('#ff0000');

  el.value = 'rgb(0, 128, 255)';
  await el.updateComplete;
  expect(el.value).to.equal('#0080ff');
});

it('serializes the value in the requested format', async () => {
  const el = (await fixture(html`<lr-color-picker value="#ff0000"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;

  el.format = 'rgb';
  await el.updateComplete;
  expect(el.value).to.equal('rgb(255, 0, 0)');

  el.format = 'hsl';
  await el.updateComplete;
  expect(el.value).to.equal('hsl(0, 100%, 50%)');

  el.format = 'hsv';
  await el.updateComplete;
  expect(el.value).to.equal('hsv(0, 100%, 100%)');

  el.format = 'hex';
  await el.updateComplete;
  expect(el.value).to.equal('#ff0000');
});

it('parses every format it can emit, so a value survives a round trip', async () => {
  const el = (await fixture(html`<lr-color-picker></lr-color-picker>`)) as LyraColorPicker;
  for (const input of ['hsl(0, 100%, 50%)', 'hsv(0, 100%, 100%)', 'rgb(255, 0, 0)', '#f00', 'rgb(255 0 0)']) {
    el.value = input;
    await el.updateComplete;
    expect(el.value, input).to.equal('#ff0000');
  }
});

it('uppercases the serialized value when uppercase is set', async () => {
  const el = (await fixture(
    html`<lr-color-picker value="#ff00aa" uppercase></lr-color-picker>`,
  )) as LyraColorPicker;
  await el.updateComplete;
  expect(el.value).to.equal('#FF00AA');
  el.format = 'rgb';
  await el.updateComplete;
  expect(el.value).to.equal('RGB(255, 0, 170)');
});

it('exposes getFormattedValue() for a format other than the active one', async () => {
  const el = (await fixture(html`<lr-color-picker value="#ff0000"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  expect(el.getFormattedValue('rgb')).to.equal('rgb(255, 0, 0)');
  expect(el.getFormattedValue('hsla')).to.equal('hsla(0, 100%, 50%, 1.00)');
  expect(el.getFormattedValue('hexa')).to.equal('#ff0000ff');
  expect(el.value).to.equal('#ff0000');
});

it('exposes getHexString() for percent-scaled HSV and optional alpha', async () => {
  const el = (await fixture(html`<lr-color-picker uppercase></lr-color-picker>`)) as LyraColorPicker;
  expect(el.getHexString(0, 100, 100)).to.equal('#FF0000');
  expect(el.getHexString(120, 100, 100, 50)).to.equal('#00FF0080');
  expect(el.getHexString(Number.NaN, Number.POSITIVE_INFINITY, -1)).to.equal('#000000');
});

it('keeps an unparseable value verbatim instead of silently replacing it', async () => {
  const el = (await fixture(html`<lr-color-picker value="#ff0000"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  el.value = 'not-a-color';
  await el.updateComplete;
  expect(el.value).to.equal('not-a-color');
  expect(el.getFormattedValue('hex')).to.equal('#ff0000');
});

it('cycles the format with the format toggle and reports the active format on the button', async () => {
  const el = await opened();
  const button = part(el, 'format-button') as HTMLButtonElement;
  expect(button.textContent!.trim()).to.equal('HEX');
  button.click();
  await el.updateComplete;
  expect(el.format).to.equal('rgb');
  expect(part(el, 'format-button').textContent!.trim()).to.equal('RGB');
});

it('omits the format toggle when without-format-toggle is set', async () => {
  const el = await opened(html`<lr-color-picker label="A" without-format-toggle></lr-color-picker>`);
  expect(count(el, 'format-button')).to.equal(0);
});

it('also omits the format toggle for Shoelace no-format-toggle', async () => {
  const el = await opened(html`<lr-color-picker label="A" no-format-toggle></lr-color-picker>`);
  expect(el.noFormatToggle).to.equal(true);
  expect(count(el, 'format-button')).to.equal(0);
});

it('exposes the upstream button subparts and unprefixed sizing hooks', async () => {
  const globals = window as unknown as { EyeDropper?: unknown };
  const saved = globals.EyeDropper;
  try {
    globals.EyeDropper = class { open(): Promise<{ sRGBHex: string }> { return Promise.resolve({ sRGBHex: '#000000' }); } };
    const el = await opened(html`
      <lr-color-picker
        label="A"
        swatches="#ff0000"
        style="
          --grid-width: 222px;
          --grid-height: 111px;
          --grid-handle-size: 18px;
          --slider-height: 14px;
          --slider-handle-size: 22px;
          --swatch-size: 26px;
        "
      ></lr-color-picker>
    `);

    for (const name of [
      'format-button__base', 'format-button__start', 'format-button__prefix',
      'format-button__label', 'format-button__end', 'format-button__suffix',
      'format-button__caret', 'eyedropper-button__base', 'eyedropper-button__start',
      'eye-dropper-button__prefix', 'eyedropper-button__label', 'eyedropper-button__end',
      'eye-dropper-button__suffix', 'eyedropper-button__caret', 'eye-dropper-button',
    ]) expect(count(el, name), name).to.be.greaterThan(0);

    expect(getComputedStyle(part(el, 'grid')).inlineSize).to.equal('222px');
    expect(getComputedStyle(part(el, 'grid')).blockSize).to.equal('111px');
    expect(getComputedStyle(part(el, 'grid-handle')).inlineSize).to.equal('18px');
    expect(getComputedStyle(part(el, 'hue-slider'), '::before').blockSize).to.equal('14px');
    expect(getComputedStyle(part(el, 'hue-slider-handle')).inlineSize).to.equal('22px');
    expect(getComputedStyle(part(el, 'swatch')).inlineSize).to.equal('26px');
  } finally {
    if (saved === undefined) delete globals.EyeDropper;
    else globals.EyeDropper = saved;
  }
});

// ---------------------------------------------------------------------------
// opacity
// ---------------------------------------------------------------------------

it('renders no opacity slider and drops alpha unless opacity is enabled', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="rgba(255, 0, 0, 0.5)"></lr-color-picker>`);
  expect(count(el, 'opacity-slider')).to.equal(0);
  expect(el.value).to.equal('#ff0000');
});

it('keeps the alpha channel and renders an opacity slider when opacity is enabled', async () => {
  const el = await opened(
    html`<lr-color-picker label="A" opacity value="rgba(255, 0, 0, 0.5)"></lr-color-picker>`,
  );
  expect(count(el, 'opacity-slider')).to.equal(1);
  expect(el.value).to.equal('#ff000080');

  el.format = 'rgb';
  await el.updateComplete;
  expect(el.value).to.equal('rgba(255, 0, 0, 0.50)');
});

it('gives the opacity slider a real slider role with a full value contract', async () => {
  const el = await opened(html`<lr-color-picker label="A" opacity value="#ff0000"></lr-color-picker>`);
  const handle = part(el, 'opacity-slider-handle');
  expect(handle.getAttribute('role')).to.equal('slider');
  expect(handle.getAttribute('aria-valuemin')).to.equal('0');
  expect(handle.getAttribute('aria-valuemax')).to.equal('100');
  expect(handle.getAttribute('aria-valuenow')).to.equal('100');
  expect((handle.getAttribute('aria-valuetext') ?? '').length > 0).to.be.true;
  expect((handle.getAttribute('aria-label') ?? '').length > 0).to.be.true;

  press(handle, 'ArrowLeft');
  await el.updateComplete;
  expect(part(el, 'opacity-slider-handle').getAttribute('aria-valuenow')).to.equal('99');
});

// ---------------------------------------------------------------------------
// swatches
// ---------------------------------------------------------------------------

it('accepts a semicolon-separated swatch string, an array, and labelled objects', async () => {
  const el = await opened(
    html`<lr-color-picker label="A" swatches="#ff0000; #00ff00 ;#0000ff"></lr-color-picker>`,
  );
  expect(count(el, 'swatch')).to.equal(3);

  el.swatches = ['#ff0000', '#00ff00'];
  await el.updateComplete;
  expect(count(el, 'swatch')).to.equal(2);

  el.swatches = [{ color: '#ff0000', label: 'Brand red' }];
  await el.updateComplete;
  expect(parts(el, 'swatch')[0]!.getAttribute('aria-label')).to.equal('Brand red');
});

it('renders no swatch container at all when swatches is unset', async () => {
  const el = await opened();
  expect(count(el, 'swatches')).to.equal(0);
  expect(count(el, 'swatch')).to.equal(0);
});

it('selects a swatch on click and marks the active one with more than colour alone', async () => {
  const el = await opened(html`<lr-color-picker label="A" swatches="#ff0000;#00ff00"></lr-color-picker>`);
  const [red, green] = parts(el, 'swatch') as [HTMLElement, HTMLElement];
  expect(red.getAttribute('aria-pressed')).to.equal('false');

  const changed = oneEvent(el, 'lr-change');
  green.click();
  const event = await changed;
  expect((event as CustomEvent<{ value: string }>).detail.value).to.equal('#00ff00');
  await el.updateComplete;
  expect(el.value).to.equal('#00ff00');
  expect(parts(el, 'swatch')[1]!.getAttribute('aria-pressed')).to.equal('true');
  expect(parts(el, 'swatch')[0]!.getAttribute('aria-pressed')).to.equal('false');
});

// ---------------------------------------------------------------------------
// saturation/brightness grid + hue slider
// ---------------------------------------------------------------------------

it('gives the grid handle a keyboard-operable, ARIA-described control', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const handle = part(el, 'grid-handle');
  expect(handle.getAttribute('role')).to.equal('slider');
  expect(handle.getAttribute('tabindex')).to.equal('0');
  expect(handle.getAttribute('aria-valuemin')).to.equal('0');
  expect(handle.getAttribute('aria-valuemax')).to.equal('100');
  expect(handle.getAttribute('aria-valuenow')).to.equal('100');
  expect((handle.getAttribute('aria-valuetext') ?? '').length > 0).to.be.true;
  expect((handle.getAttribute('aria-label') ?? '').length > 0).to.be.true;
});

it('moves the grid by one step with an arrow key and ten with shift+arrow', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  press(part(el, 'grid-handle'), 'ArrowLeft');
  await el.updateComplete;
  expect(part(el, 'grid-handle').getAttribute('aria-valuenow')).to.equal('99');

  press(part(el, 'grid-handle'), 'ArrowLeft', true);
  await el.updateComplete;
  expect(part(el, 'grid-handle').getAttribute('aria-valuenow')).to.equal('89');

  press(part(el, 'grid-handle'), 'ArrowDown');
  await el.updateComplete;
  expect(el.getFormattedValue('hsv')).to.equal('hsv(0, 89%, 99%)');
});

it('swaps the horizontal grid arrows under RTL', async () => {
  const wrapper = (await fixture(html`
    <div dir="rtl"><lr-color-picker label="A" value="#ff0000"></lr-color-picker></div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-color-picker') as LyraColorPicker;
  el.open = true;
  await el.updateComplete;
  // Physical ArrowRight means "towards inline-start", i.e. less saturation, under RTL.
  press(part(el, 'grid-handle'), 'ArrowRight');
  await el.updateComplete;
  expect(part(el, 'grid-handle').getAttribute('aria-valuenow')).to.equal('99');
});

it('gives the hue slider a real slider role over the full 0-360 range', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const handle = part(el, 'hue-slider-handle');
  expect(handle.getAttribute('role')).to.equal('slider');
  expect(handle.getAttribute('aria-valuemin')).to.equal('0');
  expect(handle.getAttribute('aria-valuemax')).to.equal('360');
  expect(handle.getAttribute('aria-valuenow')).to.equal('0');

  press(handle, 'End');
  await el.updateComplete;
  expect(part(el, 'hue-slider-handle').getAttribute('aria-valuenow')).to.equal('360');
  press(part(el, 'hue-slider-handle'), 'Home');
  await el.updateComplete;
  expect(part(el, 'hue-slider-handle').getAttribute('aria-valuenow')).to.equal('0');
});

it('emits input/lr-input per step and change/lr-change once on release', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const handle = part(el, 'hue-slider-handle');
  let inputs = 0;
  let changes = 0;
  let lrInputs = 0;
  let lrChanges = 0;
  let committedValue = '';
  const nativeEvents: Event[] = [];
  el.addEventListener('input', (event) => {
    inputs++;
    nativeEvents.push(event);
  });
  el.addEventListener('change', (event) => {
    changes++;
    nativeEvents.push(event);
  });
  el.addEventListener('lr-input', () => lrInputs++);
  el.addEventListener('lr-change', (event) => {
    lrChanges++;
    committedValue = event.detail.value;
  });
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(lrInputs).to.equal(2);
  expect(lrChanges).to.equal(0);
  handle.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(inputs).to.equal(2);
  expect(changes).to.equal(1);
  expect(lrChanges).to.equal(1);
  expect(committedValue).to.equal(el.value);
  expect(nativeEvents.filter((event) => event.type === 'input').every((event) => event instanceof InputEvent)).to.be
    .true;
  expect(nativeEvents.find((event) => event.type === 'change')?.constructor === Event).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
});

it('tracks a pointer drag across the hue slider and ends cleanly on pointercancel', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const slider = part(el, 'hue-slider');
  const rect = slider.getBoundingClientRect();
  expect(rect.width > 0).to.be.true;

  slider.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      pointerId: 11,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }),
  );
  await el.updateComplete;
  expect(part(el, 'hue-slider-handle').getAttribute('aria-valuenow')).to.equal('180');

  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 11 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, clientX: rect.left }));
  await el.updateComplete;
  expect(part(el, 'hue-slider-handle').getAttribute('aria-valuenow')).to.equal('180');
});

it('reserves touch gestures for the two-dimensional grid while preserving vertical page pan on tracks', async () => {
  const el = await opened(html`<lr-color-picker label="A" opacity></lr-color-picker>`);
  expect(getComputedStyle(part(el, 'grid')).touchAction).to.equal('none');
  expect(getComputedStyle(part(el, 'hue-slider')).touchAction).to.equal('pan-y');
  expect(getComputedStyle(part(el, 'opacity-slider')).touchAction).to.equal('pan-y');
});

it('ignores right-button starts and a second pointer while a drag is active', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const slider = part(el, 'hue-slider');
  const rect = slider.getBoundingClientRect();
  let inputs = 0;
  el.addEventListener('input', () => inputs++);

  slider.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    composed: true,
    pointerId: 41,
    pointerType: 'mouse',
    button: 2,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }));
  await el.updateComplete;
  expect(el.value).to.equal('#ff0000');
  expect(inputs).to.equal(0);

  slider.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    composed: true,
    pointerId: 42,
    pointerType: 'touch',
    clientX: rect.left + rect.width / 4,
    clientY: rect.top + rect.height / 2,
  }));
  await el.updateComplete;
  const firstValue = el.value;
  slider.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    composed: true,
    pointerId: 43,
    pointerType: 'touch',
    clientX: rect.left + (rect.width * 3) / 4,
    clientY: rect.top + rect.height / 2,
  }));
  await el.updateComplete;
  expect(el.value).to.equal(firstValue);
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 42 }));
});

it('cancels an active drag when disabled before pointerup', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const slider = part(el, 'hue-slider');
  const rect = slider.getBoundingClientRect();
  slider.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    composed: true,
    pointerId: 44,
    pointerType: 'touch',
    clientX: rect.left + rect.width / 4,
    clientY: rect.top + rect.height / 2,
  }));
  await el.updateComplete;
  const valueAtDisable = el.value;
  let inputs = 0;
  let changes = 0;
  el.addEventListener('input', () => inputs++);
  el.addEventListener('change', () => changes++);

  el.disabled = true;
  window.dispatchEvent(new PointerEvent('pointerup', {
    pointerId: 44,
    pointerType: 'touch',
    clientX: rect.left + (rect.width * 3) / 4,
    clientY: rect.top + rect.height / 2,
  }));
  await el.updateComplete;

  expect(el.value).to.equal(valueAtDisable);
  expect(inputs).to.equal(0);
  expect(changes).to.equal(0);
});

it('commits a text entry typed into the panel input', async () => {
  const el = await opened(html`<lr-color-picker label="A"></lr-color-picker>`);
  const input = part(el, 'input') as HTMLInputElement;
  expect(input.value).to.equal('#000000');
  input.value = 'rebeccapurple';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await el.updateComplete;
  expect(el.value).to.equal('#663399');
  expect((part(el, 'input') as HTMLInputElement).value).to.equal('#663399');
});

it('canonicalizes modern browser-parseable CSS colors through the browser color pipeline', async () => {
  const el = await opened(html`<lr-color-picker label="A"></lr-color-picker>`);
  const input = part(el, 'input') as HTMLInputElement;
  const samples = [
    'lab(50% 40 30)',
    'oklch(60% 0.2 20)',
    'color(display-p3 1 0 0)',
    'color-mix(in srgb, red 25%, blue)',
  ].filter((value) => CSS.supports('color', value));
  expect(samples.length).to.be.greaterThan(0);

  for (const value of samples) {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    expect(el.value, value).to.match(/^#[0-9a-f]{6}$/i);
  }
});

// ---------------------------------------------------------------------------
// popover surface
// ---------------------------------------------------------------------------

it('opens and closes from the trigger, reflecting open and aria-expanded', async () => {
  const el = (await fixture(html`<lr-color-picker label="A"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  expect(part(el, 'trigger').getAttribute('aria-expanded')).to.equal('false');
  expect(part(el, 'panel').hidden).to.be.true;

  const shown = oneEvent(el, 'lr-show');
  (part(el, 'trigger') as HTMLButtonElement).click();
  await shown;
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
  expect(part(el, 'trigger').getAttribute('aria-expanded')).to.equal('true');
  expect(part(el, 'panel').hidden).to.be.false;
  expect(part(el, 'trigger').getAttribute('aria-controls')).to.equal(part(el, 'panel').id);

  const hidden = oneEvent(el, 'lr-hide');
  (part(el, 'trigger') as HTMLButtonElement).click();
  await hidden;
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('closes on an outside pointerdown but not on one inside the panel', async () => {
  const el = await opened();
  part(el, 'grid').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 21 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 21 }));
  await el.updateComplete;
  expect(el.open, 'inside').to.be.true;

  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 22 }));
  await el.updateComplete;
  expect(el.open, 'outside').to.be.false;
  expect(document.activeElement === outside, 'outside focus').to.equal(true);
  outside.remove();
});

it('keeps every slider pointer target at the WCAG 2.5.8 floor while the ramp stays slim', async () => {
  const el = await opened(html`<lr-color-picker label="A" opacity></lr-color-picker>`);
  for (const name of ['hue-slider', 'opacity-slider']) {
    expect(getComputedStyle(part(el, name)).blockSize, name).to.equal('24px');
  }
});

it('gives the full slider target distinct rendered hover and pressed feedback without tinting its ramp', async () => {
  const el = await opened();
  const slider = part(el, 'hue-slider');
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const rect = slider.getBoundingClientRect();
  const centre: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  const resting = getComputedStyle(slider).outlineWidth;
  try {
    await sendMouse({ type: 'move', position: centre });
    const hovered = getComputedStyle(slider).outlineWidth;
    await sendMouse({ type: 'down' });
    const pressed = getComputedStyle(slider).outlineWidth;
    expect(hovered).to.not.equal(resting);
    expect(pressed).to.not.equal(hovered);
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('marks the selected swatch with a check mark, not colour alone', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#00ff00" swatches="#ff0000;#00ff00"></lr-color-picker>`);
  const selected = parts(el, 'swatch')[1]!;
  expect(selected.getAttribute('part')).to.contain('swatch-selected');
  expect(getComputedStyle(selected, '::before').content).to.contain('✓');
  expect(getComputedStyle(parts(el, 'swatch')[0]!, '::before').content).to.not.contain('✓');
});

it('reflects placement and defaults to bottom-start', async () => {
  const el = (await fixture(html`<lr-color-picker></lr-color-picker>`)) as LyraColorPicker;
  expect(el.placement).to.equal('bottom-start');
  el.placement = 'top-end';
  await el.updateComplete;
  expect(el.getAttribute('placement')).to.equal('top-end');
});

it('supports inline rendering and chooses absolute versus hoisted fixed popup positioning', async () => {
  const inline = (await fixture(html`
    <lr-color-picker inline label="Inline colour"></lr-color-picker>
  `)) as LyraColorPicker;
  await inline.updateComplete;
  expect(inline.inline).to.equal(true);
  expect(count(inline, 'trigger')).to.equal(0);
  expect(part(inline, 'panel').hidden).to.equal(false);
  expect(getComputedStyle(part(inline, 'panel')).position).to.equal('static');
  await expect(inline).to.be.accessible();

  const anchored = await opened();
  expect(anchored.hoist).to.equal(false);
  expect(part(anchored, 'panel').style.position).to.equal('absolute');

  const hoisted = await opened(html`<lr-color-picker label="A" hoist></lr-color-picker>`);
  expect(hoisted.hoist).to.equal(true);
  expect(part(hoisted, 'panel').style.position).to.equal('fixed');
});

it('activates positioning and light-dismiss when an open inline panel changes to popup mode', async () => {
  const outside = document.createElement('button');
  document.body.append(outside);
  const el = (await fixture(
    html`<lr-color-picker inline open label="Inline colour"></lr-color-picker>`,
  )) as LyraColorPicker;
  await el.updateComplete;
  expect(part(el, 'panel').style.position).to.equal('');

  el.inline = false;
  await el.updateComplete;
  expect(part(el, 'panel').style.position).to.equal('absolute');

  outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.equal(false);
  outside.remove();
});

it('emits migrated focus/input and after-show/after-hide aliases exactly once', async () => {
  const el = (await fixture(
    html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`,
  )) as LyraColorPicker;
  const seen = new Map<string, number>();
  for (const name of ['lr-focus', 'lr-blur', 'lr-input', 'lr-after-show', 'lr-after-hide']) {
    el.addEventListener(name, () => seen.set(name, (seen.get(name) ?? 0) + 1));
  }
  const nativeFocusEvents: FocusEvent[] = [];
  for (const name of ['focus', 'blur'] as const) {
    el.addEventListener(name, (event) => {
      if (event instanceof FocusEvent) {
        nativeFocusEvents.push(event);
        seen.set(name, (seen.get(name) ?? 0) + 1);
      }
    });
  }

  const trigger = part(el, 'trigger') as HTMLButtonElement;
  trigger.focus();
  trigger.blur();
  el.show();
  await el.updateComplete;
  press(part(el, 'hue-slider-handle'), 'ArrowRight');
  await el.updateComplete;
  el.hide();
  await el.updateComplete;

  expect(seen.get('lr-focus')).to.equal(seen.get('focus'));
  expect(seen.get('lr-blur')).to.equal(seen.get('blur'));
  expect(nativeFocusEvents.length).to.equal((seen.get('focus') ?? 0) + (seen.get('blur') ?? 0));
  expect(nativeFocusEvents.every((event) => event.target === el)).to.equal(true);
  expect(nativeFocusEvents.every((event) => event.bubbles && event.composed)).to.equal(true);
  for (const name of ['lr-input', 'lr-after-show', 'lr-after-hide']) {
    expect(seen.get(name), name).to.equal(1);
  }
});

it('emits the composed focus/blur relays and migrated aliases in inline mode', async () => {
  const el = (await fixture(
    html`<lr-color-picker inline label="Inline colour"></lr-color-picker>`,
  )) as LyraColorPicker;
  const seen = new Map<string, number>();
  const nativeFocusEvents: FocusEvent[] = [];
  for (const name of ['focus', 'blur', 'lr-focus', 'lr-blur']) {
    el.addEventListener(name, (event) => {
      if (name.startsWith('lr-') || event instanceof FocusEvent) {
        if (event instanceof FocusEvent) nativeFocusEvents.push(event);
        seen.set(name, (seen.get(name) ?? 0) + 1);
      }
    });
  }

  el.focus();
  expect(el.shadowRoot!.activeElement === part(el, 'grid-handle')).to.equal(true);
  el.blur();
  for (const name of ['focus', 'blur', 'lr-focus', 'lr-blur']) {
    expect(seen.get(name), name).to.equal(1);
  }
  expect(nativeFocusEvents.every((event) => event.target === el)).to.equal(true);
  expect(nativeFocusEvents.every((event) => event.bubbles && event.composed)).to.equal(true);
});

it('preserves native FocusEvent payload while relaying exactly once from the control boundary', async () => {
  const el = (await fixture(html`<lr-color-picker label="A"></lr-color-picker>`)) as LyraColorPicker;
  const trigger = part(el, 'trigger');
  const relatedTarget = document.createElement('button');
  const received: FocusEvent[] = [];
  el.addEventListener('focus', (event) => received.push(event));

  trigger.dispatchEvent(new FocusEvent('focus', {
    bubbles: true,
    composed: true,
    relatedTarget,
    view: window,
    detail: 7,
  }));

  expect(received.length).to.equal(1);
  expect(received[0] instanceof CustomEvent).to.equal(false);
  expect(received[0]!.target === el).to.equal(true);
  expect(received[0]!.relatedTarget === relatedTarget).to.equal(true);
  expect(received[0]!.view === window).to.equal(true);
  expect(received[0]!.detail).to.equal(7);
});

it('closes on Escape and returns focus to the trigger', async () => {
  const el = (await fixture(html`<lr-color-picker label="A"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  (part(el, 'trigger') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.shadowRoot!.activeElement === part(el, 'trigger')).to.be.true;
});

it('never opens while effectively disabled, and closes when disabled mid-interaction', async () => {
  const el = (await fixture(html`<lr-color-picker label="A" disabled></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.false;

  const form = (await fixture(html`
    <form><fieldset><lr-color-picker label="A"></lr-color-picker></fieldset></form>
  `)) as HTMLFormElement;
  const live = form.querySelector('lr-color-picker') as LyraColorPicker;
  live.show();
  await live.updateComplete;
  expect(live.open).to.be.true;
  (form.querySelector('fieldset') as HTMLFieldSetElement).disabled = true;
  await live.updateComplete;
  expect(live.open).to.be.false;
});

it('resets the open panel across a disconnect/reconnect cycle', async () => {
  const el = await opened();
  expect(el.open).to.be.true;
  el.remove();
  await el.updateComplete;
  expect(el.open).to.be.false;
  document.body.append(el);
  await el.updateComplete;
  expect(el.open).to.be.false;
  el.remove();
});

it('keeps a synchronous open-panel reparent silent while clearing the disconnected open state', async () => {
  const el = await opened();
  const lifecycle: string[] = [];
  el.addEventListener('lr-hide', () => lifecycle.push('hide'));
  el.addEventListener('lr-after-hide', () => lifecycle.push('after-hide'));

  el.remove();
  document.body.append(el);
  await el.updateComplete;

  expect(el.open).to.equal(false);
  expect(lifecycle).to.deep.equal([]);
  el.remove();
});

it('clears an interrupted keyboard commit when an input listener reparents the picker', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  let changes = 0;
  el.addEventListener('change', () => changes++);
  el.addEventListener('input', () => {
    el.remove();
    document.body.append(el);
  }, { once: true });

  const handle = part(el, 'hue-slider-handle');
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  part(el, 'hue-slider-handle').dispatchEvent(
    new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, composed: true }),
  );
  await el.updateComplete;

  expect(changes).to.equal(0);
  el.remove();
});

// ---------------------------------------------------------------------------
// EyeDropper
// ---------------------------------------------------------------------------

it('omits the eyedropper button when the browser has no EyeDropper API', async () => {
  const globals = window as unknown as { EyeDropper?: unknown };
  const saved = globals.EyeDropper;
  try {
    delete globals.EyeDropper;
    const el = await opened();
    expect(count(el, 'eyedropper-button')).to.equal(0);
  } finally {
    if (saved === undefined) delete globals.EyeDropper;
    else globals.EyeDropper = saved;
  }
});

it('adopts the color returned by the EyeDropper API when it is available', async () => {
  const globals = window as unknown as { EyeDropper?: unknown };
  const saved = globals.EyeDropper;
  try {
    globals.EyeDropper = class {
      open(): Promise<{ sRGBHex: string }> {
        return Promise.resolve({ sRGBHex: '#00ff00' });
      }
    };
    const el = await opened();
    expect(count(el, 'eyedropper-button')).to.equal(1);
    const changed = oneEvent(el, 'lr-change');
    (part(el, 'eyedropper-button') as HTMLButtonElement).click();
    await changed;
    await el.updateComplete;
    expect(el.value).to.equal('#00ff00');
  } finally {
    if (saved === undefined) delete globals.EyeDropper;
    else globals.EyeDropper = saved;
  }
});

it('stays silent when the eyedropper selection is cancelled', async () => {
  const globals = window as unknown as { EyeDropper?: unknown };
  const saved = globals.EyeDropper;
  try {
    globals.EyeDropper = class {
      open(): Promise<{ sRGBHex: string }> {
        return Promise.reject(new DOMException('aborted', 'AbortError'));
      }
    };
    const el = await opened();
    let changes = 0;
    el.addEventListener('lr-change', () => changes++);
    (part(el, 'eyedropper-button') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(changes).to.equal(0);
    expect(el.value).to.equal('');
  } finally {
    if (saved === undefined) delete globals.EyeDropper;
    else globals.EyeDropper = saved;
  }
});

it('aborts and ignores an eyedropper result that resolves after disconnection', async () => {
  const globals = window as unknown as { EyeDropper?: unknown };
  const saved = globals.EyeDropper;
  let resolveSelection!: (value: { sRGBHex: string }) => void;
  let signal: AbortSignal | undefined;
  try {
    globals.EyeDropper = class {
      open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }> {
        signal = options?.signal;
        return new Promise((resolve) => {
          resolveSelection = resolve;
        });
      }
    };
    const el = await opened();
    let changes = 0;
    el.addEventListener('lr-change', () => changes++);
    (part(el, 'eyedropper-button') as HTMLButtonElement).click();
    el.remove();
    resolveSelection({ sRGBHex: '#00ff00' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;

    expect(signal?.aborted).to.equal(true);
    expect(el.value).to.equal('');
    expect(changes).to.equal(0);
  } finally {
    if (saved === undefined) delete globals.EyeDropper;
    else globals.EyeDropper = saved;
  }
});

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

it('uses a .strings override for the trigger name and every slider value description', async () => {
  const el = await opened(html`<lr-color-picker value="#ff0000" opacity></lr-color-picker>`);
  el.strings = {
    colorPicker: 'Sélecteur de couleur',
    colorPickerHueValue: '{hue} degrés',
    colorPickerOpacityValue: '{opacity} pour cent',
    colorPickerSaturationBrightnessValue: 'S {saturation} L {brightness}',
  };
  await el.updateComplete;
  expect(part(el, 'trigger').getAttribute('aria-label')).to.equal('Sélecteur de couleur');
  expect(part(el, 'hue-slider-handle').getAttribute('aria-valuetext')).to.equal('0 degrés');
  expect(part(el, 'opacity-slider-handle').getAttribute('aria-valuetext')).to.equal('100 pour cent');
  expect(part(el, 'grid-handle').getAttribute('aria-valuetext')).to.equal('S 100 L 100');
});

// ---------------------------------------------------------------------------
// accessibility
// ---------------------------------------------------------------------------

it('is accessible in its populated, open state', async () => {
  const el = await opened(html`
    <lr-color-picker
      label="Accent"
      hint="Used across every chart"
      opacity
      value="#3366ff"
      swatches="#ff0000;#00ff00;#0000ff"
    ></lr-color-picker>
  `);
  expect(count(el, 'swatch')).to.equal(3);
  expect(count(el, 'opacity-slider')).to.equal(1);
  expect(part(el, 'panel').hidden).to.be.false;
  await expect(el).to.be.accessible();
});

it('leaves the closed, unconfigured render free of every opt-in surface', async () => {
  const el = (await fixture(html`<lr-color-picker label="A"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  expect(el.opacity).to.be.false;
  expect(el.uppercase).to.be.false;
  expect(el.swatches).to.equal('');
  expect(el.open).to.be.false;
  expect(count(el, 'opacity-slider')).to.equal(0);
  expect(count(el, 'swatches')).to.equal(0);
  expect(part(el, 'panel').hidden).to.be.true;
});

it('paints the live colour on both slider handles, not just the trigger and preview', async () => {
  // The stylesheet fills `[part~='slider-handle']` from `--lr-color-picker-swatch-color`, but that
  // property is only ever written inline on the trigger, the preview and each parsed palette
  // swatch. Nothing set it on the handles, so they inherited the `transparent` declared on `:host`
  // and the documented "live colour painted on ... slider handles" never rendered.
  const el = await opened(html`<lr-color-picker label="Accent" opacity value="#e11d48"></lr-color-picker>`);
  // The preview paints the live colour on its ::after, so that pseudo-element -- not the preview
  // box itself, which stays on the checkerboard -- is the like-for-like baseline.
  const expected = getComputedStyle(part(el, 'preview'), '::after').backgroundColor;
  expect(expected).to.equal('rgb(225, 29, 72)');
  for (const name of ['hue-slider-handle', 'opacity-slider-handle']) {
    const handle = part(el, name);
    const painted = getComputedStyle(handle).backgroundColor;
    expect(painted, name).to.not.equal('rgba(0, 0, 0, 0)');
    expect(painted, name).to.equal(expected);
  }
});

it('tracks a pointer drag across the grid and abandons it when the control becomes disabled', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const grid = part(el, 'grid');
  const rect = grid.getBoundingClientRect();
  expect(rect.width > 0).to.be.true;

  grid.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    composed: true,
    pointerId: 31,
    clientX: rect.left,
    clientY: rect.top,
  }));
  await el.updateComplete;
  const atStart = el.value;

  window.dispatchEvent(new PointerEvent('pointermove', {
    pointerId: 31,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }));
  await el.updateComplete;
  expect(el.value).to.not.equal(atStart);

  // A stray pointer id belongs to some other gesture and must not steer this drag.
  const duringDrag = el.value;
  window.dispatchEvent(new PointerEvent('pointermove', {
    pointerId: 99,
    clientX: rect.right,
    clientY: rect.bottom,
  }));
  await el.updateComplete;
  expect(el.value).to.equal(duringDrag);

  // Window listeners keep firing for a captured pointer, so disabling must end the drag itself.
  el.disabled = true;
  await el.updateComplete;
  window.dispatchEvent(new PointerEvent('pointermove', {
    pointerId: 31,
    clientX: rect.right,
    clientY: rect.bottom,
  }));
  await el.updateComplete;
  expect(el.value).to.equal(duringDrag);
});

it('commits a typed color on Enter and keeps the draft until then', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const field = part(el, 'input') as HTMLInputElement;

  field.value = '#00ff00';
  field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.value).to.equal('#ff0000');

  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true });
  field.dispatchEvent(enter);
  await el.updateComplete;
  expect(enter.defaultPrevented).to.equal(true);
  expect(el.value.toLowerCase()).to.equal('#00ff00');

  const ignored = new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true, cancelable: true });
  field.dispatchEvent(ignored);
  await el.updateComplete;
  expect(ignored.defaultPrevented).to.equal(false);
  expect(el.value.toLowerCase()).to.equal('#00ff00');
});

it('drops a consumer validity message through resetValidity()', async () => {
  const el = (await fixture(
    html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`,
  )) as LyraColorPicker;
  el.setCustomValidity('Use a brand color');
  await el.updateComplete;
  expect(el.validity.customError).to.equal(true);
  expect(el.validationMessage).to.equal('Use a brand color');

  el.resetValidity();
  await el.updateComplete;
  expect(el.validity.customError).to.equal(false);
  expect(el.validationMessage).to.equal('');
});

// This control inherits the shared `FormAssociated` guard rather than overriding updateValidity(),
// so the bar arrives for free -- these lock that in, since a future override would silently drop it.
describe('lr-color-picker barred from constraint validation', () => {
  it('reports no violation while disabled, and restores it on re-enable', async () => {
    const el = (await fixture(
      html`<lr-color-picker required disabled></lr-color-picker>`,
    )) as LyraColorPicker;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing while disabled').to.be.false;
    expect(el.validationMessage, 'no message while disabled').to.equal('');

    el.disabled = false;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing once enabled').to.be.true;
  });

  it('reports no violation inside a disabled fieldset', async () => {
    const form = (await fixture(html`
      <form><fieldset disabled><lr-color-picker required></lr-color-picker></fieldset></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-color-picker') as LyraColorPicker;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing inside a disabled fieldset').to.be.false;
    expect(el.checkValidity(), 'checkValidity() inside a disabled fieldset').to.be.true;
  });
});

it('honours preventDefault() on lr-show and lr-hide', async () => {
  const el = (await fixture(html`<lr-color-picker label="Accent"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;

  el.addEventListener('lr-show', (event) => event.preventDefault(), { once: true });
  (part(el, 'trigger') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.open, 'a vetoed open never applies').to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(part(el, 'trigger').getAttribute('aria-expanded')).to.equal('false');

  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  el.addEventListener('lr-hide', (event) => event.preventDefault(), { once: true });
  el.open = false;
  await el.updateComplete;
  expect(el.open, 'a vetoed close stays open').to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
});

it('keeps the reflected open attribute in step when a veto arrives through the attribute', async () => {
  const el = (await fixture(html`<lr-color-picker label="Accent"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  el.addEventListener('lr-show', (event) => event.preventDefault());
  el.setAttribute('open', '');
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open'), 'the attribute cannot outlive the vetoed property').to.be.false;
});

it('does not let a listener hold a disabled picker open', async () => {
  const el = (await fixture(html`<lr-color-picker label="Accent" open></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  expect(el.open).to.be.true;
  el.addEventListener('lr-hide', (event) => event.preventDefault());
  el.disabled = true;
  await el.updateComplete;
  expect(el.open, 'disablement closes the panel regardless of any veto').to.be.false;
});

it('makes lr-show/lr-hide cancelable and the after-events not', async () => {
  const el = (await fixture(html`<lr-color-picker label="Accent"></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  const seen: CustomEvent[] = [];
  for (const type of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
    el.addEventListener(type, (event) => seen.push(event as CustomEvent));
  }
  el.open = true;
  await el.updateComplete;
  el.open = false;
  await el.updateComplete;
  expect(seen.map((event) => event.type)).to.deep.equal([
    'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide',
  ]);
  expect(seen.map((event) => event.cancelable)).to.deep.equal([true, false, true, false]);
});
