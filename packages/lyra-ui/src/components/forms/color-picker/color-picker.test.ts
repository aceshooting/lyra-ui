import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './color-picker.js';
import type { LyraColorPicker } from './color-picker.js';
import { styles } from './color-picker.styles.js';

it('renders a labeled native color input and forwards the form value', async () => {
  const el = (await fixture(html`<lr-color-picker label="Accent" value="#ff0000"></lr-color-picker>`)) as LyraColorPicker;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.type).to.equal('color');
  expect(input.value).to.equal('#ff0000');
  expect(input.id).to.equal('color');
  await expect(el).to.be.accessible();
});

it('exposes the label under both the form-control-label and label part tokens', async () => {
  const el = (await fixture(
    html`<lr-color-picker label="Accent"></lr-color-picker>`,
  )) as LyraColorPicker;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement;
  expect(label, 'expected a form-control-label part, matching every sibling form control').to.exist;
  expect(label.getAttribute('part')).to.contain('label');
});

it('renders errorText and an error slot, wiring aria-describedby to the rendered hint/error ids', async () => {
  const el = (await fixture(
    html`<lr-color-picker label="Accent" hint="Pick a brand color" error-text="Not a valid color"></lr-color-picker>`,
  )) as LyraColorPicker;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;

  expect(errorPart.hidden).to.be.false;
  expect(errorPart.textContent).to.contain('Not a valid color');
  const describedBy = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
  expect(describedBy).to.include(errorPart.id);
  expect(describedBy).to.include(hintPart.id);
});

it('hides the error part when errorText is unset and no error slot content is assigned', async () => {
  const el = (await fixture(html`<lr-color-picker></lr-color-picker>`)) as LyraColorPicker;
  await el.updateComplete;
  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(errorPart.hidden).to.be.true;
});

it('shows a required-field asterisk after the label', async () => {
  const el = (await fixture(
    html`<lr-color-picker label="Accent" required></lr-color-picker>`,
  )) as LyraColorPicker;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label, '::after').content).to.contain('*');
});

it('re-dispatches bubbling, composed focus/blur events from the internal color input', async () => {
  const el = (await fixture(html`<lr-color-picker></lr-color-picker>`)) as LyraColorPicker;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;

  const focusPromise = oneEvent(el, 'focus');
  input.focus();
  const focusEvent = await focusPromise;
  expect(focusEvent.bubbles).to.be.true;
  expect(focusEvent.composed).to.be.true;

  const blurPromise = oneEvent(el, 'blur');
  input.blur();
  const blurEvent = await blurPromise;
  expect(blurEvent.bubbles).to.be.true;
  expect(blurEvent.composed).to.be.true;
});

it('gives the native color swatch its own hover and focus-visible treatment', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='input'\]:hover\s*\{[^}]*border-color:/);
  expect(css).to.match(/\[part='input'\]:focus-visible\s*\{[^}]*outline:/);
});
