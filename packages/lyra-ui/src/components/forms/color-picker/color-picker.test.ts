import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './color-picker.js';
import type { LyraColorPicker } from './color-picker.js';
import { styles } from './color-picker.styles.js';

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

it('keeps the visible default, host value, validity, reset value, and FormData in sync', async () => {
  const form = (await fixture(html`
    <form><lr-color-picker name="accent" required></lr-color-picker></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-color-picker') as LyraColorPicker;
  await el.updateComplete;

  expect(el.value).to.equal('#000000');
  expect(new FormData(form).get('accent')).to.equal('#000000');
  expect(el.checkValidity()).to.be.true;

  el.value = '#ff0000';
  await el.updateComplete;
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('#000000');
  expect(new FormData(form).get('accent')).to.equal('#000000');
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

it('visually marks direct and fieldset-cascaded disabled state', async () => {
  const form = (await fixture(html`
    <form><fieldset disabled><lr-color-picker></lr-color-picker></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-color-picker') as LyraColorPicker;
  await el.updateComplete;
  expect(getComputedStyle(el).opacity).to.equal(
    getComputedStyle(el).getPropertyValue('--lr-opacity-disabled').trim(),
  );
  expect(getComputedStyle(part(el, 'trigger')).cursor).to.equal('not-allowed');
});

it('defaults to size "m" and scales the trigger across every tier', async () => {
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
    expect(getComputedStyle(trigger).blockSize, `size=${size}`).to.equal(px);
    expect(getComputedStyle(trigger).inlineSize, `size=${size}`).to.equal(px);
  }
});

it('gives every interactive part its own hover and focus-visible treatment', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  for (const name of ['trigger', 'swatch', 'format-button', 'eyedropper-button']) {
    expect(css, `${name}:hover`).to.contain(`[part~='${name}']:hover`);
    expect(css, `${name}:focus-visible`).to.contain(`[part~='${name}']:focus-visible`);
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

it('emits input and lr-change per step and a single change on release', async () => {
  const el = await opened(html`<lr-color-picker label="A" value="#ff0000"></lr-color-picker>`);
  const handle = part(el, 'hue-slider-handle');
  let inputs = 0;
  let changes = 0;
  el.addEventListener('input', () => inputs++);
  el.addEventListener('change', () => changes++);
  const lrChange = oneEvent(el, 'lr-change');
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await lrChange;
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  handle.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(inputs).to.equal(2);
  expect(changes).to.equal(1);
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

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 22 }));
  await el.updateComplete;
  expect(el.open, 'outside').to.be.false;
});

it('keeps every slider pointer target at the WCAG 2.5.8 floor while the ramp stays slim', async () => {
  const el = await opened(html`<lr-color-picker label="A" opacity></lr-color-picker>`);
  for (const name of ['hue-slider', 'opacity-slider']) {
    expect(getComputedStyle(part(el, name)).blockSize, name).to.equal('24px');
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
    expect(el.value).to.equal('#000000');
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
