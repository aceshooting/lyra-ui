import { fixture, expect } from '@open-wc/testing';
import { html, LitElement, render } from 'lit';
import { property } from 'lit/decorators.js';
import { setReducedMotion } from '../../test/wtr-media.js';
import { tag } from '../internal/prefix.js';
import { tokens } from '../internal/tokens.styles.js';
import { palette } from '../internal/tokens/palette.styles.js';
import { gemstoneGlyph, gemstoneSelectedGlyphStyles } from './gemstones.js';
import { applyLyraPreferences } from './preferences.js';
import type { LyraSwatchPicker } from '../components/forms/swatch-picker/swatch-picker.class.js';
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
  describe('independent shine preference', () => {
    let previousSheets: CSSStyleSheet[];
    let preferenceSheet: CSSStyleSheet;

    before(async () => {
      const response = await fetch(new URL('../preferences.css', import.meta.url));
      if (!response.ok) throw new Error('Missing preference stylesheet fixture');
      preferenceSheet = new CSSStyleSheet();
      preferenceSheet.replaceSync(await response.text());
    });

    beforeEach(async () => {
      previousSheets = document.adoptedStyleSheets;
      document.adoptedStyleSheets = [...previousSheets, preferenceSheet];
      await setReducedMotion('no-preference');
    });

    afterEach(async () => {
      document.adoptedStyleSheets = previousSheets;
      await setReducedMotion('no-preference');
    });

    async function selectedGlyphs() {
      const scope = await fixture<HTMLElement>(html`
        <section style="--lr-gemstone-selected-color: rgb(10, 20, 30); --lr-gemstone-selected-blur: 3px;">
          <lr-gemstone-glyph-probe selected></lr-gemstone-glyph-probe>
          <lr-swatch-picker mode="gemstone" aria-label="Accent color"
            .items=${[
              { value: 'ruby', color: '#df2845', label: 'Ruby', gemstone: 'ruby' },
              { value: 'emerald', color: '#34d399', label: 'Emerald', gemstone: 'emerald' },
            ]}
            value="emerald"
          ></lr-swatch-picker>
        </section>
      `);
      const probe = scope.querySelector<GemstoneGlyphProbe>('lr-gemstone-glyph-probe')!;
      const picker = scope.querySelector<LyraSwatchPicker>('lr-swatch-picker')!;
      await Promise.all([probe.updateComplete, picker.updateComplete]);
      const glyphs = [
        probe.shadowRoot!.querySelector<HTMLElement>('[data-lr-gemstone-selected]')!,
        picker.shadowRoot!.querySelector<HTMLElement>('[data-lr-gemstone-selected]')!,
      ];
      return { scope, picker, glyphs };
    }

    for (const shine of ['unset', 'off', 'explicit-on'] as const) {
      for (const osMotion of ['no-preference', 'reduce'] as const) {
        for (const appMotion of ['system', 'reduce'] as const) {
          it(`inherits shine ${shine} into picker and external glyph with OS ${osMotion} and app ${appMotion}`, async () => {
            const { scope, picker, glyphs } = await selectedGlyphs();
            if (shine !== 'unset') {
              scope.style.setProperty('--lr-gemstone-selected-animation',
                shine === 'off' ? 'none' : 'lr-gemstone-selected-shine 2s infinite');
            }
            applyLyraPreferences(scope, { motion: appMotion });
            await setReducedMotion(osMotion);
            const stopped = shine === 'off' || osMotion === 'reduce' || appMotion === 'reduce';
            for (const glyph of glyphs) {
              const paint = getComputedStyle(glyph);
              expect(paint.animationName).to.equal(stopped ? 'none' : 'lr-gemstone-selected-shine');
              expect(glyph.getAnimations().length).to.equal(stopped ? 0 : 1);
              expect(paint.filter).to.contain('drop-shadow');
              expect(paint.filter).to.contain('rgb(10, 20, 30)');
              expect(paint.filter).to.contain('3px');
              if (stopped) expect(paint.filter).to.contain('brightness(1)');
              else {
                expect(paint.animationIterationCount).to.equal('infinite');
                expect(paint.animationDuration).to.equal(shine === 'explicit-on' ? '2s' : '1.8s');
              }
            }
            expect(picker.value).to.equal('emerald');
            expect(picker.shadowRoot!.querySelector('[data-value="emerald"]')!.getAttribute('aria-checked')).to.equal('true');
            expect(picker.shadowRoot!.querySelector('[data-value="ruby"]')!.getAttribute('aria-checked')).to.equal('false');
          });
        }
      }
    }

    it('restores the unchanged default shine when OFF is removed without changing selection or emitting changes', async () => {
      const { scope, picker, glyphs } = await selectedGlyphs();
      let changes = 0;
      picker.addEventListener('lr-change', () => { changes++; });
      for (const glyph of glyphs) {
        const paint = getComputedStyle(glyph);
        expect(paint.animationName).to.equal('lr-gemstone-selected-shine');
        expect(paint.animationDuration).to.equal('1.8s');
      }
      scope.style.setProperty('--lr-gemstone-selected-animation', 'none');
      for (const glyph of glyphs) {
        expect(getComputedStyle(glyph).animationName).to.equal('none');
        expect(glyph.getAnimations().length).to.equal(0);
        expect(getComputedStyle(glyph).filter).to.contain('brightness(1)');
      }
      scope.style.removeProperty('--lr-gemstone-selected-animation');
      for (const glyph of glyphs) {
        expect(getComputedStyle(glyph).animationName).to.equal('lr-gemstone-selected-shine');
        expect(getComputedStyle(glyph).animationDuration).to.equal('1.8s');
      }
      expect(picker.value).to.equal('emerald');
      expect(changes).to.equal(0);
    });
  });

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
  // to fork the treatment and could then drift from it. `lr-swatch-picker` now consumes this exact
  // export for its own automatic gemstone glyph (an item with a `gemstone` key and no `icon`
  // override): it includes `gemstoneSelectedGlyphStyles` in `static styles` and sets
  // `data-lr-gemstone-selected` on that swatch's checked icon, the same attribute this file's own
  // probe wires up above -- so this pins actual shared consumption, not merely coincidentally
  // matching values, by also asserting the two resolve to the identical named keyframe.
  it('paints the same halo and shine lr-swatch-picker gives its own selected gemstone swatch', async () => {
    const picker = await fixture<HTMLElement & { items: unknown; value: string | null }>(
      html`<lr-swatch-picker mode="gemstone"></lr-swatch-picker>`
    );
    picker.items = [
      { value: 'sapphire', color: '#035ec6', label: 'Sapphire', gemstone: 'sapphire' },
    ];
    picker.value = 'sapphire';
    await (picker as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const pickerIcon = picker.shadowRoot!.querySelector(
      '[part="swatch"][aria-checked="true"] [part="swatch-icon"]'
    ) as HTMLElement | null;
    expect(pickerIcon != null, 'expected a checked gemstone swatch icon').to.equal(true);
    expect(
      pickerIcon!.hasAttribute('data-lr-gemstone-selected'),
      'expected the picker to set the shared selector attribute, not repaint via a private rule'
    ).to.equal(true);
    const pickerPaint = getComputedStyle(pickerIcon!);

    const probe = await fixture<GemstoneGlyphProbe>(
      html`<lr-gemstone-glyph-probe selected></lr-gemstone-glyph-probe>`
    );
    const probePaint = getComputedStyle(
      probe.shadowRoot!.querySelector('span') as HTMLElement
    );

    // The SAME named keyframe, not merely one that happens to compute the same values -- proves
    // the picker's checked glyph is actually painted by the imported gemstoneSelectedGlyphStyles
    // rule rather than by a private lr-swatch-picker-* keyframe that was independently kept in
    // sync by hand.
    expect(
      pickerPaint.animationName,
      'expected the picker to run the shared gemstone keyframe'
    ).to.equal('lr-gemstone-selected-shine');
    expect(probePaint.animationName).to.equal(pickerPaint.animationName);

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
