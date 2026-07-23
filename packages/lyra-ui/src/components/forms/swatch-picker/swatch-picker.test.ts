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

describe('lr-swatch-picker', () => {
  it('renders role=radiogroup with one role=radio per option, aria-checked on the selected one', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker .options=${options()} value="green"></lr-swatch-picker>`,
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
      html`<lr-swatch-picker .options=${options()} value="blue"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    const first = swatches(el)[0]!;
    expect(first.getAttribute('aria-label')).to.equal('Blue');
    expect(first.getAttribute('title')).to.equal('Blue');
    expect(first.style.getPropertyValue('--lr-swatch-color')).to.equal('#0969da');
  });

  it('uses roving tabindex -- only the selected swatch is tabbable', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker .options=${options()} value="green"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    expect(swatches(el).map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
  });

  it('makes the first swatch tabbable when nothing is selected, so the radiogroup stays keyboard-reachable', async () => {
    const el = (await fixture(html`<lr-swatch-picker .options=${options()}></lr-swatch-picker>`)) as LyraSwatchPicker;
    expect(el.value).to.equal(null);
    expect(swatches(el).map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1', '-1']);
  });

  it('selects on click and emits lr-change with the option value', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker .options=${options()} value="blue"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    const buttons = swatches(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, 'lr-change');
    expect(ev.detail).to.deep.equal({ value: 'red' });
    expect(el.value).to.equal('red');
    await el.updateComplete;
    expect(buttons[2]!.getAttribute('aria-checked')).to.equal('true');
  });

  it('does not emit lr-change when re-selecting the already-selected swatch', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker .options=${options()} value="green"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    let fired = 0;
    el.addEventListener('lr-change', () => (fired += 1));
    swatches(el)[1]!.click();
    await el.updateComplete;
    expect(fired).to.equal(0);
    expect(el.value).to.equal('green');
  });

  it('selects on ArrowRight (automatic activation) and wraps cyclically at the end', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker .options=${options()} value="red"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    const buttons = swatches(el);
    buttons[2]!.focus();
    buttons[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('blue'); // wrapped from the last swatch back to the first
  });

  it('moves selection backward with ArrowLeft and to the ends with Home/End', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker .options=${options()} value="green"></lr-swatch-picker>`,
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
      html`<lr-swatch-picker dir="rtl" .options=${options()} value="blue"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('green');
  });

  it('sets aria-label on the radiogroup from the label prop, falling back to a forwarded host aria-label', async () => {
    const labeled = (await fixture(
      html`<lr-swatch-picker label="Accent" .options=${options()}></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    expect(
      (labeled.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label'),
    ).to.equal('Accent');

    const forwarded = (await fixture(
      html`<lr-swatch-picker aria-label="Forwarded" .options=${options()}></lr-swatch-picker>`,
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
      html`<lr-swatch-picker .options=${withIcon} value="blue"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    const buttons = swatches(el);
    expect(buttons[0]!.querySelector('[part="swatch-icon"]')).to.equal(null);
    const iconSpan = buttons[1]!.querySelector('[part="swatch-icon"]');
    expect(iconSpan).to.not.equal(null);
    expect(iconSpan!.getAttribute('aria-hidden')).to.equal('true');
    expect(iconSpan!.querySelector('[data-testid="gem-icon"]')).to.not.equal(null);
    // Still wired for currentColor: the option's color stays on the custom property the icon inherits.
    expect(buttons[1]!.style.getPropertyValue('--lr-swatch-color')).to.equal('#1a7f37');
  });

  it('renders the shared gemstone glyph automatically in gemstone mode', async () => {
    const el = (await fixture(html`
      <lr-swatch-picker
        mode="gemstone"
        .options=${[
          { value: 'ruby', color: '#e63950', label: 'Ruby', gemstone: 'ruby' as const },
          { value: 'emerald', color: '#34d399', label: 'Emerald', gemstone: 'emerald' as const },
        ]}
        value="emerald"
      ></lr-swatch-picker>
    `)) as LyraSwatchPicker;
    const selected = swatches(el)[1]!;
    expect(selected.querySelector('[part="swatch-fill"]')).to.equal(null);
    expect(selected.querySelector('[part="swatch-icon"] svg')).to.not.equal(null);
    expect(selected.querySelector('[part="swatch-icon"] svg')?.getAttribute('viewBox')).to.equal('0 0 24 24');
  });

  it('sizes the gemstone glyph to the visible fill box instead of the button UA font size', async () => {
    const el = (await fixture(html`
      <lr-swatch-picker
        mode="gemstone"
        .options=${[
          { value: 'ruby', color: '#e63950', label: 'Ruby', gemstone: 'ruby' as const },
        ]}
      ></lr-swatch-picker>
    `)) as LyraSwatchPicker;
    const icon = swatches(el)[0]!.querySelector('[part="swatch-icon"]') as HTMLElement;
    const glyph = icon.querySelector('svg') as SVGElement;

    expect(getComputedStyle(icon).inlineSize).to.equal('24px');
    expect(glyph.getBoundingClientRect().width).to.equal(24);
    expect(glyph.getBoundingClientRect().height).to.equal(24);
  });

  it('exposes the swatch color through `color` for currentColor icons, and paints the fill circle\'s background from it', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('color: var(--lr-swatch-color); cursor: pointer;');
    expect(css).to.include("[part='swatch-fill'] { box-sizing: border-box; display: block;");
    expect(css).to.match(/\[part='swatch-fill'\]\s*\{[^}]*background-color:\s*var\(--lr-swatch-color\)/);
  });

  it('actually paints the rendered fill circle background-color from the option color (not just declared in the stylesheet source)', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker .options=${options()} value="blue"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    const fill = swatches(el)[0]!.querySelector('[part="swatch-fill"]') as HTMLElement;
    // options()[0].color === '#0969da' === rgb(9, 105, 218)
    expect(getComputedStyle(fill).backgroundColor).to.equal('rgb(9, 105, 218)');
  });

  it('gives the swatch hit target the shared minimum touch-target size without inflating the visible fill', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker .options=${options()} value="blue"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    const swatch = swatches(el)[0]!;
    const fill = swatch.querySelector('[part="swatch-fill"]') as HTMLElement;
    expect(getComputedStyle(swatch).minInlineSize).to.equal('40px');
    expect(getComputedStyle(swatch).minBlockSize).to.equal('40px');
    // The visible fill itself stays compact (--lr-size-1-5rem = 24px), not blown up to 40px --
    // the button's own box grows around it via flex centering instead.
    expect(getComputedStyle(fill).inlineSize).to.equal('24px');
    expect(getComputedStyle(fill).blockSize).to.equal('24px');
  });

  it('draws the selected ring through the --lr-swatch-picker-selected-color token', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    // The ring lives on [part='swatch-fill'], a descendant of the checked [part='swatch'] -- split
    // out of the interactive hit target so the hit box can grow to the shared minimum tappable size
    // without inflating the visible ring/fill (see [part='swatch']'s own styles.ts comment).
    expect(css).to.match(
      /\[part='swatch'\]\[aria-checked='true'\]\s*\[part='swatch-fill'\]\s*\{[^}]*var\(--lr-swatch-picker-selected-color\)/,
    );
  });

  it('actually draws the selected ring on the checked swatch\'s rendered fill via --lr-swatch-picker-selected-color, and not on an unchecked one', async () => {
    const el = (await fixture(html`
      <lr-swatch-picker
        .options=${options()}
        value="green"
        style="--lr-swatch-picker-selected-color: rgb(10, 20, 30);"
      ></lr-swatch-picker>
    `)) as LyraSwatchPicker;
    const buttons = swatches(el);
    const checkedFill = buttons[1]!.querySelector('[part="swatch-fill"]') as HTMLElement;
    const uncheckedFill = buttons[0]!.querySelector('[part="swatch-fill"]') as HTMLElement;
    expect(getComputedStyle(checkedFill).boxShadow).to.contain('rgb(10, 20, 30)');
    expect(getComputedStyle(uncheckedFill).boxShadow).to.equal('none');
  });

  it('defaults --lr-swatch-picker-shine-duration to 0s (no-op) and pulses brightness via a dedicated keyframe when set', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('--lr-swatch-picker-shine-duration: 0s;');
    expect(css).to.match(
      /\[part='swatch'\]\[aria-checked='true'\]\s*\[part='swatch-fill'\]\s*\{[^}]*animation:\s*lr-swatch-picker-shine var\(--lr-swatch-picker-shine-duration\)/,
    );
    expect(css).to.match(/@keyframes lr-swatch-picker-shine\s*\{[\s\S]*?50%\s*\{[^}]*filter:\s*brightness\(1\.4\)/);
    // An icon swatch runs a distinct keyframe that composes the selected glow with the brightness
    // pulse -- sharing the fill's brightness-only one would blank the glow out (see styles.ts).
    expect(css).to.match(
      /\[part='swatch'\]\[aria-checked='true'\]\s*\[part='swatch-icon'\]\s*\{[^}]*animation:\s*lr-swatch-picker-shine-icon var\(--lr-swatch-picker-shine-duration\)/,
    );
    expect(css).to.match(
      /@keyframes lr-swatch-picker-shine-icon\s*\{[\s\S]*?50%\s*\{[^}]*filter:\s*drop-shadow\([^}]*brightness\(1\.4\)/,
    );
  });

  it('actually applies the lr-swatch-picker-shine animation to the checked swatch\'s rendered fill', async () => {
    const el = (await fixture(html`
      <lr-swatch-picker
        .options=${options()}
        value="green"
        style="--lr-swatch-picker-shine-duration: 1.6s;"
      ></lr-swatch-picker>
    `)) as LyraSwatchPicker;
    const buttons = swatches(el);
    const checkedFill = buttons[1]!.querySelector('[part="swatch-fill"]') as HTMLElement;
    const uncheckedFill = buttons[0]!.querySelector('[part="swatch-fill"]') as HTMLElement;
    expect(getComputedStyle(checkedFill).animationName).to.equal('lr-swatch-picker-shine');
    expect(getComputedStyle(checkedFill).animationDuration).to.equal('1.6s');
    expect(getComputedStyle(uncheckedFill).animationName).to.equal('none');
  });

  it('applies the lr-swatch-picker-shine-icon animation to a checked custom icon', async () => {
    const el = (await fixture(html`
      <lr-swatch-picker
        .options=${[
          { value: 'blue', color: '#0969da', label: 'Blue', icon: html`<svg></svg>` },
          { value: 'green', color: '#1a7f37', label: 'Green', icon: html`<svg></svg>` },
        ]}
        value="green"
        style="--lr-swatch-picker-shine-duration: 1.6s;"
      ></lr-swatch-picker>
    `)) as LyraSwatchPicker;
    const buttons = swatches(el);
    const checkedIcon = buttons[1]!.querySelector('[part="swatch-icon"]') as HTMLElement;
    const uncheckedIcon = buttons[0]!.querySelector('[part="swatch-icon"]') as HTMLElement;
    expect(getComputedStyle(checkedIcon).animationName).to.equal('lr-swatch-picker-shine-icon');
    expect(getComputedStyle(checkedIcon).animationDuration).to.equal('1.6s');
    expect(getComputedStyle(uncheckedIcon).animationName).to.equal('none');
  });

  it('keeps the selected glow on a checked icon while the shine animation is running', async () => {
    // Regression: the shine keyframes and the selected-glow rule both target `filter` on
    // [part='swatch-icon']. A running animation wins the cascade over an author-normal
    // declaration, so a shared brightness-only keyframe silently blanked the glow out for every
    // icon swatch -- which is every swatch in mode="gemstone", where the shine is on by default.
    const el = (await fixture(html`
      <lr-swatch-picker
        .options=${[
          { value: 'blue', color: '#0969da', label: 'Blue', icon: html`<svg></svg>` },
          { value: 'green', color: '#1a7f37', label: 'Green', icon: html`<svg></svg>` },
        ]}
        value="green"
        style="--lr-swatch-picker-selected-color: rgb(10, 20, 30); --lr-swatch-picker-selected-blur: 0.5rem; --lr-swatch-picker-shine-duration: 1.6s;"
      ></lr-swatch-picker>
    `)) as LyraSwatchPicker;
    const checkedIcon = swatches(el)[1]!.querySelector('[part="swatch-icon"]') as HTMLElement;
    const filter = getComputedStyle(checkedIcon).filter;
    expect(filter).to.contain('drop-shadow');
    expect(filter).to.contain('rgb(10, 20, 30)');
    expect(filter).to.contain('brightness');
  });

  it('disables the shine animation outright under prefers-reduced-motion, independent of the transform-easing rule', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(
      /@media \(prefers-reduced-motion: reduce\) \{[^]*\[part='swatch'\]\[aria-checked='true'\]\s*\[part='swatch-fill'\][^]*\[part='swatch-icon'\]\s*\{[^}]*animation:\s*none[^}]*\}[^]*\}/,
    );
  });

  it('is accessible', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker label="Accent" .options=${options()} value="blue"></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    await expect(el).to.be.accessible();
  });

  it('is accessible when nothing is selected', async () => {
    const el = (await fixture(
      html`<lr-swatch-picker label="Accent" .options=${options()}></lr-swatch-picker>`,
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
      html`<lr-swatch-picker .options=${withQuote} value="a"></lr-swatch-picker>`,
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

  it('scales the swatch hit-area and fill diameter across every tier, hit-area floored at 24px', async () => {
    const expectedHit: Record<string, string> = {
      '2xs': '24px',
      xs: '28px',
      s: '32px',
      m: '40px',
      l: '48px',
      xl: '56px',
    };
    const expectedFill: Record<string, string> = {
      '2xs': '12px',
      xs: '16px',
      s: '20px',
      m: '24px',
      l: '28px',
      xl: '32px',
    };
    for (const size of Object.keys(expectedHit)) {
      const el = await fixture(
        html`<lr-swatch-picker size=${size} .options=${options()}></lr-swatch-picker>`,
      );
      const swatch = el.shadowRoot!.querySelector('[part="swatch"]') as HTMLElement;
      const fill = el.shadowRoot!.querySelector('[part="swatch-fill"]') as HTMLElement;
      expect(getComputedStyle(swatch).minBlockSize, `hit size=${size}`).to.equal(expectedHit[size]);
      expect(getComputedStyle(fill).blockSize, `fill size=${size}`).to.equal(expectedFill[size]);
    }
  });

  it('defaults to size "m" and reflects a size attribute', async () => {
    const defaultEl = (await fixture(
      html`<lr-swatch-picker .options=${options()}></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    expect(defaultEl.size).to.equal('m');
    const el = (await fixture(
      html`<lr-swatch-picker size="s" .options=${options()}></lr-swatch-picker>`,
    )) as LyraSwatchPicker;
    expect(el.getAttribute('size')).to.equal('s');
    expect(el.size).to.equal('s');
  });
});
