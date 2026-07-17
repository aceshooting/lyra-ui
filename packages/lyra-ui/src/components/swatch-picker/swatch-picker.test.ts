import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './swatch-picker.js';
import type { LyraSwatchPicker } from './swatch-picker.js';
import { styles } from './swatch-picker.styles.js';

const options = () => [
  { value: 'blue', color: '#0969da', label: 'Blue' },
  { value: 'green', color: '#1a7f37', label: 'Green' },
  { value: 'red', color: '#cf222e', label: 'Red' },
];

function swatches(el: LyraSwatchPicker): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part="swatch"]')] as HTMLButtonElement[];
}

describe('lyra-swatch-picker', () => {
  it('renders role=radiogroup with one role=radio per option, aria-checked on the selected one', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${options()} value="green"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('radiogroup');
    const buttons = swatches(el);
    expect(buttons).to.have.lengthOf(3);
    expect(buttons.map((b) => b.getAttribute('role'))).to.deep.equal(['radio', 'radio', 'radio']);
    expect(buttons[1]!.getAttribute('aria-checked')).to.equal('true');
    expect(buttons[0]!.getAttribute('aria-checked')).to.equal('false');
    expect(buttons[2]!.getAttribute('aria-checked')).to.equal('false');
  });

  it('names each swatch and applies the option color as its fill', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${options()} value="blue"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    const first = swatches(el)[0]!;
    expect(first.getAttribute('aria-label')).to.equal('Blue');
    expect(first.getAttribute('title')).to.equal('Blue');
    expect(first.style.getPropertyValue('--lyra-swatch-color')).to.equal('#0969da');
  });

  it('uses roving tabindex -- only the selected swatch is tabbable', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${options()} value="green"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    expect(swatches(el).map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
  });

  it('makes the first swatch tabbable when nothing is selected, so the radiogroup stays keyboard-reachable', async () => {
    const el = (await fixture(html`<lyra-swatch-picker .options=${options()}></lyra-swatch-picker>`)) as LyraSwatchPicker;
    expect(el.value).to.equal(null);
    expect(swatches(el).map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1', '-1']);
  });

  it('selects on click and emits lyra-change with the option value', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${options()} value="blue"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    const buttons = swatches(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, 'lyra-change');
    expect(ev.detail).to.deep.equal({ value: 'red' });
    expect(el.value).to.equal('red');
    await el.updateComplete;
    expect(buttons[2]!.getAttribute('aria-checked')).to.equal('true');
  });

  it('does not emit lyra-change when re-selecting the already-selected swatch', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${options()} value="green"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    let fired = 0;
    el.addEventListener('lyra-change', () => (fired += 1));
    swatches(el)[1]!.click();
    await el.updateComplete;
    expect(fired).to.equal(0);
    expect(el.value).to.equal('green');
  });

  it('selects on ArrowRight (automatic activation) and wraps cyclically at the end', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${options()} value="red"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    const buttons = swatches(el);
    buttons[2]!.focus();
    buttons[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('blue'); // wrapped from the last swatch back to the first
  });

  it('moves selection backward with ArrowLeft and to the ends with Home/End', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${options()} value="green"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('blue');
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('red');
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('blue');
  });

  it('treats ArrowLeft as "next" under RTL', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker dir="rtl" .options=${options()} value="blue"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('green');
  });

  it('sets aria-label on the radiogroup from the label prop, falling back to a forwarded host aria-label', async () => {
    const labeled = (await fixture(
      html`<lyra-swatch-picker label="Accent" .options=${options()}></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    expect(
      (labeled.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label'),
    ).to.equal('Accent');

    const forwarded = (await fixture(
      html`<lyra-swatch-picker aria-label="Forwarded" .options=${options()}></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    expect(
      (forwarded.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label'),
    ).to.equal('Forwarded');
  });

  it('renders a custom icon in place of the plain circle when the option provides one', async () => {
    const withIcon = [
      { value: 'blue', color: '#0969da', label: 'Blue' },
      { value: 'green', color: '#1a7f37', label: 'Green', icon: html`<svg data-testid="gem-icon"></svg>` },
    ];
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${withIcon} value="blue"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    const buttons = swatches(el);
    expect(buttons[0]!.querySelector('[part="swatch-icon"]')).to.equal(null);
    const iconSpan = buttons[1]!.querySelector('[part="swatch-icon"]');
    expect(iconSpan).to.not.equal(null);
    expect(iconSpan!.getAttribute('aria-hidden')).to.equal('true');
    expect(iconSpan!.querySelector('[data-testid="gem-icon"]')).to.not.equal(null);
    // Still wired for currentColor: the option's color stays on the custom property the icon inherits.
    expect(buttons[1]!.style.getPropertyValue('--lyra-swatch-color')).to.equal('#1a7f37');
  });

  it('exposes the swatch color through `color` for currentColor icons, and suppresses fill/border when an icon is present', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('color: var(--lyra-swatch-color); cursor: pointer;');
    expect(css).to.include("[part='swatch']:has([part='swatch-icon']) { background-color: transparent");
  });

  it('draws the selected ring through the --lyra-swatch-picker-selected-color token', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(
      /\[part='swatch'\]\[aria-checked='true'\]\s*\{[^}]*var\(--lyra-swatch-picker-selected-color\)/,
    );
  });

  it('defaults --lyra-swatch-picker-shine-duration to 0s (no-op) and pulses brightness via a dedicated keyframe when set', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('--lyra-swatch-picker-shine-duration: 0s;');
    expect(css).to.match(
      /\[part='swatch'\]\[aria-checked='true'\]\s*\{[^}]*animation:\s*lyra-swatch-picker-shine var\(--lyra-swatch-picker-shine-duration\)/,
    );
    expect(css).to.match(/@keyframes lyra-swatch-picker-shine\s*\{[\s\S]*?50%\s*\{[^}]*filter:\s*brightness\(1\.4\)/);
  });

  it('disables the shine animation outright under prefers-reduced-motion, independent of the transform-easing rule', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(
      /@media \(prefers-reduced-motion: reduce\) \{[^]*\[part='swatch'\]\[aria-checked='true'\]\s*\{[^}]*animation:\s*none[^}]*\}[^]*\}/,
    );
  });

  it('is accessible', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker label="Accent" .options=${options()} value="blue"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    await expect(el).to.be.accessible();
  });

  it('is accessible when nothing is selected', async () => {
    const el = (await fixture(
      html`<lyra-swatch-picker label="Accent" .options=${options()}></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    await expect(el).to.be.accessible();
  });

  it('moves focus to the target swatch when its value contains a double-quote character', async () => {
    const withQuote = [
      { value: 'a', color: '#0969da', label: 'A' },
      { value: 'b"c', color: '#1a7f37', label: 'B' },
      { value: 'd', color: '#cf222e', label: 'D' },
    ];
    const el = (await fixture(
      html`<lyra-swatch-picker .options=${withQuote} value="a"></lyra-swatch-picker>`,
    )) as LyraSwatchPicker;
    const buttons = swatches(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('b"c');
    // Without CSS.escape in the attribute-selector lookup, focusSwatch() throws before reaching
    // .focus(), so the target swatch never receives focus even though `value` updated.
    expect(el.shadowRoot!.activeElement!.getAttribute('data-value')).to.equal('b"c');
  });
});
