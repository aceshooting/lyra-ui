import { fixture, expect } from '@open-wc/testing';
import { html, LitElement, render } from 'lit';
import { property } from 'lit/decorators.js';
import { setReducedMotion } from '../../test/wtr-media.js';
import { tag } from '../internal/prefix.js';
import { tokens } from '../internal/tokens.styles.js';
import { palette } from '../internal/tokens/palette.styles.js';
import { gemstoneGlyph, gemstoneSelectedGlyphStyles } from './gemstones.js';
import '../components/forms/swatch-picker/swatch-picker.js';

function renderGlyph(tpl: ReturnType<typeof gemstoneGlyph>): SVGElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(tpl, container);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('gemstoneGlyph did not render an <svg>');
  return svg;
}

// A minimal, non-swatch-picker host: proves `gemstoneSelectedGlyphStyles` is a portable
// presentation any component can consume alongside a bare `gemstoneGlyph()`, by wiring only the
// documented `data-lr-gemstone-selected` attribute -- the same attribute lr-swatch-picker itself
// sets on its own checked gemstone swatch icon.
class GemstoneGlyphProbe extends LitElement {
  // `palette` is included deliberately, not defensively. The halo colour falls back to
  // `--lr-color-brand`, which `tokens` defines as `var(--lr-color-brand-fill-loud)` -- a
  // PALETTE-layer token an application supplies, not something `tokens` resolves on its own.
  // Without the palette layer `--lr-color-brand` is invalid at computed-value time, which makes
  // the whole `filter` declaration invalid and computes it to `none`, so the probe would be
  // asserting against an unthemed environment no real consumer runs in. `lr-swatch-picker`'s own
  // halo resolves the identical `var(--lr-color-brand)` chain, so modelling a themed app here is
  // what makes this probe equivalent to the picker it is proving parity with.
  static override styles = [tokens, palette, gemstoneSelectedGlyphStyles];
  @property({ type: Boolean, reflect: true }) selected = false;
  override render() {
    return html`<span ?data-lr-gemstone-selected=${this.selected}
      >${gemstoneGlyph()}</span
    >`;
  }
}
customElements.define(tag('gemstone-glyph-probe'), GemstoneGlyphProbe);

it('gemstoneGlyph() with no argument defaults to a currentColor fill', () => {
  const svg = renderGlyph(gemstoneGlyph());
  const facetPath = svg.querySelector('path');
  expect(facetPath?.getAttribute('fill')).to.equal('currentColor');
});

it('gemstoneGlyph() with no argument carries a 1em x 1em intrinsic box', () => {
  const svg = renderGlyph(gemstoneGlyph());
  expect(svg.getAttribute('width')).to.equal('1em');
  expect(svg.getAttribute('height')).to.equal('1em');
});

it('gemstoneGlyph(color) still bakes in an explicit color (back-compat)', () => {
  const svg = renderGlyph(gemstoneGlyph('#34d399'));
  const facetPath = svg.querySelector('path');
  expect(facetPath?.getAttribute('fill')).to.equal('#34d399');
  expect(svg.getAttribute('width')).to.equal('1em');
  expect(svg.getAttribute('height')).to.equal('1em');
});

describe('gemstoneSelectedGlyphStyles', () => {
  it('unset-regression: a bare glyph with the attribute unset gets no filter or animation', async () => {
    const el = await fixture<GemstoneGlyphProbe>(
      html`<lr-gemstone-glyph-probe></lr-gemstone-glyph-probe>`
    );
    const wrapper = el.shadowRoot!.querySelector('span') as HTMLElement;
    expect(getComputedStyle(wrapper).filter).to.equal('none');
    expect(getComputedStyle(wrapper).animationName).to.equal('none');
  });

  it('applies the looping shine and coloured halo to a bare glyph outside any picker once the attribute is set', async () => {
    const el = await fixture<GemstoneGlyphProbe>(
      html`<lr-gemstone-glyph-probe selected></lr-gemstone-glyph-probe>`
    );
    const wrapper = el.shadowRoot!.querySelector('span') as HTMLElement;
    const filter = getComputedStyle(wrapper).filter;
    expect(filter).to.contain('drop-shadow');
    expect(getComputedStyle(wrapper).animationName).to.not.equal('none');
    expect(getComputedStyle(wrapper).animationIterationCount).to.equal(
      'infinite'
    );
  });

  it('themes the halo colour and blur through --lr-gemstone-selected-color/-blur', async () => {
    const el = await fixture<GemstoneGlyphProbe>(
      html`<lr-gemstone-glyph-probe
        selected
        style="--lr-gemstone-selected-color: rgb(10, 20, 30); --lr-gemstone-selected-blur: 3px;"
      ></lr-gemstone-glyph-probe>`
    );
    const wrapper = el.shadowRoot!.querySelector('span') as HTMLElement;
    const filter = getComputedStyle(wrapper).filter;
    expect(filter).to.contain('rgb(10, 20, 30)');
    expect(filter).to.contain('3px');
  });

  it('genuinely stops the loop under prefers-reduced-motion instead of merely speeding it up', async () => {
    try {
      await setReducedMotion('no-preference');
      const el = await fixture<GemstoneGlyphProbe>(
        html`<lr-gemstone-glyph-probe selected></lr-gemstone-glyph-probe>`
      );
      const wrapper = el.shadowRoot!.querySelector('span') as HTMLElement;
      expect(getComputedStyle(wrapper).animationName).to.not.equal('none');

      await setReducedMotion('reduce');
      await el.updateComplete;
      expect(getComputedStyle(wrapper).animationName).to.equal('none');
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  // The reason this export exists is that a consumer rendering the same glyph outside a picker had
  // to fork the treatment and could then drift from it. `lr-swatch-picker` does NOT import this
  // stylesheet: its own rule is a mode-parameterized treatment for ANY icon swatch (blur 0 and
  // shine 0s by default, overridden only for gemstone mode), so importing a fixed gemstone preset
  // would leave it needing both rules rather than one. What actually has to hold is that the two
  // resolve to the SAME gemstone values, which is what this pins -- both sides currently reach it
  // by referencing the same underlying tokens, so a change to either side alone fails here.
  it('paints the same halo and shine lr-swatch-picker gives its own selected gemstone swatch', async () => {
    const picker = await fixture<HTMLElement & { items: unknown; value: string | null }>(
      html`<lr-swatch-picker mode="gemstone"></lr-swatch-picker>`
    );
    picker.items = [
      { value: 'sapphire', color: '#035ec6', label: 'Sapphire', icon: gemstoneGlyph() },
    ];
    picker.value = 'sapphire';
    await (picker as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const pickerIcon = picker.shadowRoot!.querySelector(
      '[part="swatch"][aria-checked="true"] [part="swatch-icon"]'
    ) as HTMLElement | null;
    expect(pickerIcon != null, 'expected a checked gemstone swatch icon').to.equal(true);
    const pickerPaint = getComputedStyle(pickerIcon!);

    const probe = await fixture<GemstoneGlyphProbe>(
      html`<lr-gemstone-glyph-probe selected></lr-gemstone-glyph-probe>`
    );
    const probePaint = getComputedStyle(
      probe.shadowRoot!.querySelector('span') as HTMLElement
    );

    // Compare the WHOLE rendered filter, not the token names either side references and not a
    // substring of it. Reading the tokens directly would still pass if this export were repointed
    // at a different one, which is the drift being guarded. A partial extraction is just as
    // dangerous: an earlier version of this test matched `drop-shadow\(([^)]*)\)`, which stops at
    // the first `)` -- the one closing `rgb(...)` -- so it compared only the colour prefix and
    // stayed green when the blur radius was deliberately changed.
    expect(probePaint.filter, 'gemstone halo drifted from the picker').to.equal(
      pickerPaint.filter
    );
    expect(
      probePaint.animationDuration,
      'gemstone shine duration drifted from the picker'
    ).to.equal(pickerPaint.animationDuration);
    expect(probePaint.animationIterationCount).to.equal(
      pickerPaint.animationIterationCount
    );
  });
});
