import { expect, fixture, html } from '@open-wc/testing';
import './button.js';
import type { LyraButton } from './button.class.js';
import { gemstoneGlyph, gemstoneSelectedGlyphStyles } from '../../../theme/gemstones.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

/** The rendered content box of `[part~="base"]`: the row the label, adornments and caret share. */
function contentBox(el: LyraButton): { start: number; end: number; width: number } {
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const rect = base.getBoundingClientRect();
  const style = getComputedStyle(base);
  const startInset =
    Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth);
  const endInset =
    Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderRightWidth);
  return {
    start: rect.left + startInset,
    end: rect.right - endInset,
    width: rect.width - startInset - endInset,
  };
}

function partRect(el: LyraButton, part: string): DOMRect {
  return (el.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement).getBoundingClientRect();
}

/** Where the label's own rendered glyphs actually sit. The `[part="label"]` wrapper is NOT a
 *  proxy for this: while the wrapper grows, its box reaches the trailing content edge even though
 *  the text inside it stays packed against the leading one — which is the whole defect. */
function labelTextRect(el: LyraButton): DOMRect {
  return el.querySelector<HTMLElement>('[data-label-text]')!.getBoundingClientRect();
}

/** The rendered width of the button's own gap token, read live rather than hardcoded. */
function gapPx(el: LyraButton): number {
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  return Number.parseFloat(getComputedStyle(base).columnGap);
}

describe('lr-button: label layout', () => {
  it('centres icon+label in a stretched button instead of stretching the label', async () => {
    const el = (await fixture(html`
      <lr-button appearance="outlined" style="inline-size: 320px;">
        <svg slot="start" width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span data-label-text>Copy</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const start = partRect(el, 'start');
    const text = labelTextRect(el);
    const leadingSlack = start.left - row.start;
    const trailingSlack = row.end - text.right;

    expect(
      Math.abs(leadingSlack - trailingSlack),
      `leading slack ${leadingSlack} and trailing slack ${trailingSlack} must match`
    ).to.be.at.most(1.5);
    expect(
      Math.abs(text.left - start.right - gapPx(el)),
      `icon-to-label spacing ${text.left - start.right} must equal the gap token ${gapPx(el)}`
    ).to.be.at.most(1.5);
  });

  it('still pins a caret to the trailing edge of a stretched button', async () => {
    const el = (await fixture(html`
      <lr-button with-caret style="inline-size: 320px;"><span data-label-text>Menu</span></lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const text = labelTextRect(el);
    const caret = partRect(el, 'caret');
    expect(row.end - caret.right, 'the caret stays at the trailing content edge').to.be.at.most(1.5);
    expect(text.left - row.start, 'the label stays at the leading content edge').to.be.at.most(1.5);
  });

  it('still pins an end adornment to the trailing edge of a stretched button', async () => {
    const el = (await fixture(html`
      <lr-button style="inline-size: 320px;">
        <span data-label-text>Details</span>
        <svg slot="end" width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const end = partRect(el, 'end');
    const text = labelTextRect(el);
    expect(row.end - end.right, 'the end adornment stays at the trailing content edge').to.be.at.most(1.5);
    expect(text.left - row.start, 'the label stays at the leading content edge').to.be.at.most(1.5);
  });

  it('restores the previous full-width stretch through --lr-button-label-grow', async () => {
    const el = (await fixture(html`
      <lr-button style="inline-size: 320px; --lr-button-label-grow: 1;">
        <svg slot="start" width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span data-label-text>Copy</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const start = partRect(el, 'start');
    const label = partRect(el, 'label');
    expect(start.left - row.start, 'the icon returns to the leading content edge').to.be.at.most(1.5);
    expect(row.end - label.right, 'the label again fills to the trailing content edge').to.be.at.most(1.5);
  });

  it('positions the centred row through --lr-button-justify', async () => {
    const el = (await fixture(html`
      <lr-button style="inline-size: 320px; --lr-button-justify: flex-end;">
        <svg slot="start" width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span data-label-text>Copy</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const text = labelTextRect(el);
    expect(row.end - text.right, 'the row is packed against the trailing edge').to.be.at.most(1.5);
  });

  it('centres a plain stretched label with symmetric slack under RTL', async () => {
    const el = (await fixture(html`
      <lr-button dir="rtl" style="inline-size: 320px;"><span data-label-text>القائمة</span></lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const text = labelTextRect(el);
    const leadingSlack = row.end - text.right;
    const trailingSlack = text.left - row.start;
    expect(
      Math.abs(leadingSlack - trailingSlack),
      `RTL slack must be symmetric: ${leadingSlack} vs ${trailingSlack}`
    ).to.be.at.most(1.5);
  });

  it('pins the caret to the inline end and the label to the inline start under RTL', async () => {
    const el = (await fixture(html`
      <lr-button dir="rtl" with-caret style="inline-size: 320px;"
        ><span data-label-text>القائمة</span></lr-button
      >
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const text = labelTextRect(el);
    const caret = partRect(el, 'caret');
    // Inline-end under RTL is physically to the LEFT, so the caret hugs the row's left edge and
    // the label's own glyphs hug the right one. A grown-but-centre-aligned label floated the text
    // in the middle of the row instead.
    expect(caret.left - row.start, 'the caret stays at the inline-end content edge').to.be.at.most(
      1.5
    );
    expect(row.end - text.right, 'the label stays at the inline-start content edge').to.be.at.most(
      1.5
    );
  });

  it('wraps a long label onto multiple lines when wrap is set', async () => {
    const singleLine = (await fixture(html`
      <lr-button style="inline-size: 140px;">A rather long multi word button label</lr-button>
    `)) as LyraButton;
    await singleLine.updateComplete;
    const singleLineHeight = (
      singleLine.shadowRoot!.querySelector('[part="label"]') as HTMLElement
    ).getBoundingClientRect().height;

    const el = (await fixture(html`
      <lr-button wrap style="inline-size: 140px;"
        >A rather long multi word button label</lr-button
      >
    `)) as LyraButton;
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(getComputedStyle(label).whiteSpace, 'wrap opts out of the single-line rule').to.equal(
      'normal'
    );
    expect(
      label.getBoundingClientRect().height,
      'the wrapped label is taller than the same text on one line'
    ).to.be.greaterThan(singleLineHeight * 1.5);
  });

  it('keeps the single-line ellipsis rule when wrap is unset (regression)', async () => {
    const el = (await fixture(html`
      <lr-button style="inline-size: 140px;">A rather long multi word button label</lr-button>
    `)) as LyraButton;
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(el.wrap, 'wrap defaults to false').to.equal(false);
    expect(getComputedStyle(label).whiteSpace).to.equal('nowrap');
    expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
  });

  it('treats a visually hidden label as no label at all for icon-only detection', async () => {
    const el = (await fixture(html`
      <lr-button>
        <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span
          style="position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;"
          >Close</span
        >
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.hasAttribute('data-icon-button'), 'the square icon-only treatment applies').to.equal(
      true
    );
    const box = base.getBoundingClientRect();
    expect(Math.abs(box.width - box.height), 'the control renders square').to.be.at.most(1.5);
  });

  it('still counts a visible text label as content (regression)', async () => {
    const el = (await fixture(html`
      <lr-button>
        <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span>Close</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.hasAttribute('data-icon-button')).to.equal(false);
  });
});

// A slotted text adornment is a flex item of the inline-flex start/end part, so the part's own
// `text-overflow` never fires: the span needs its own shrinkable block, the lr-input pattern.
describe('lr-button slotted adornment truncation', () => {
  const LONG = 'Adornment text that is far too long.';

  function expectTruncatedInside(adornment: HTMLElement, part: HTMLElement, label: string): void {
    const box = adornment.getBoundingClientRect();
    const partBox = part.getBoundingClientRect();
    expect(box.left, `${label}: start edge stays inside the part`).to.be.at.least(partBox.left - 0.5);
    expect(box.right, `${label}: end edge stays inside the part`).to.be.at.most(partBox.right + 0.5);
    expect(getComputedStyle(adornment).textOverflow, `${label}: ellipsis on the adornment`).to.equal(
      'ellipsis'
    );
    expect(adornment.scrollWidth > adornment.clientWidth, `${label}: text overflows its box`).to.equal(
      true
    );
  }

  for (const slot of ['start', 'end'] as const) {
    it(`truncates a long slotted ${slot} text adornment with an ellipsis`, async () => {
      const el = (await fixture(html`
        <lr-button style="inline-size: 240px"
          >Save<span slot=${slot} id="adornment">${LONG}</span></lr-button
        >
      `)) as LyraButton;
      await el.updateComplete;
      const part = el.shadowRoot!.querySelector(`[part~="${slot}"]`) as HTMLElement;
      expectTruncatedInside(el.querySelector('#adornment') as HTMLElement, part, slot);
    });
  }
});

// A detected icon-only label holds a glyph, not text, so it has nothing to ellipsize. Clipping it
// cut every glow painted around the glyph -- gemstoneSelectedGlyphStyles' drop-shadow halo
// among them -- to the label's own rectangle, which read as a square background behind the gem.
describe('lr-button: icon-only label paint overflow', () => {
  const HALO = '0.42rem';
  let sheet: HTMLStyleElement;

  before(() => {
    // The consumer composition: the shared halo stylesheet, applied to the light-DOM wrapper the
    // consumer slots. The glyph fills its wrapper, as the gemstoneAccentPicker guide sizes it.
    sheet = document.createElement('style');
    sheet.textContent = `${gemstoneSelectedGlyphStyles.cssText}
      [data-glyph] svg { inline-size: 100%; block-size: 100%; }`;
    document.head.append(sheet);
  });

  after(() => {
    sheet.remove();
  });

  /** A glowing gem in the default slot. `filter` is invisible to hit testing, so `[data-halo]` --
   *  an absolutely positioned, paint-free child spanning the halo's extent -- is the geometry
   *  probe: an ancestor's overflow clip removes whatever part of it falls outside the clip
   *  rectangle from hit testing exactly as it removes the halo from painting. */
  async function glowingIconButton(dir: 'ltr' | 'rtl'): Promise<LyraButton> {
    return (await fixture(html`
      <lr-button
        appearance="plain"
        aria-label="Accent: sapphire"
        dir=${dir}
        style=${`--lr-gemstone-selected-color: rgb(37 99 235); --lr-gemstone-selected-blur: ${HALO};`}
        ><span
          data-glyph
          data-lr-gemstone-selected
          aria-hidden="true"
          style="display: inline-flex; position: relative; inline-size: 1.15rem; block-size: 1.15rem;"
          >${gemstoneGlyph('rgb(37 99 235)')}<i
            data-halo
            style=${`position: absolute; inset: calc(-1 * ${HALO});`}
          ></i></span
      ></lr-button>
    `)) as LyraButton;
  }

  function shadowPart(el: LyraButton, selector: string): HTMLElement {
    return el.shadowRoot!.querySelector(selector) as HTMLElement;
  }

  for (const dir of ['ltr', 'rtl'] as const) {
    it(`lets a detected icon-only label paint its glyph's glow past the label box (${dir})`, async () => {
      const el = await glowingIconButton(dir);
      await el.updateComplete;
      const base = shadowPart(el, '[part~="base"]');
      const label = shadowPart(el, '[part="label"]');
      const glyph = el.querySelector<HTMLElement>('[data-glyph]')!;

      expect(base.hasAttribute('data-icon-button'), 'the gem is detected as icon-only').to.equal(
        true
      );
      expect(getComputedStyle(glyph).filter, 'the shared halo is applied').to.contain(
        'drop-shadow'
      );
      expect(getComputedStyle(label).overflowX, 'no inline clip on an icon-only label').to.equal(
        'visible'
      );
      expect(getComputedStyle(label).overflowY, 'no block clip on an icon-only label').to.equal(
        'visible'
      );

      // Both physical sides, so the inline-start and inline-end halves are each proved in both
      // directions. Each point sits outside the label box, inside the halo, and inside the
      // control's own box -- the only clip an icon-only label is still meant to answer to.
      const labelBox = label.getBoundingClientRect();
      const glyphBox = glyph.getBoundingClientRect();
      const baseBox = base.getBoundingClientRect();
      const y = glyphBox.top + glyphBox.height / 2;
      for (const [side, x] of [
        ['left', labelBox.left - 3],
        ['right', labelBox.right + 3],
      ] as const) {
        expect(x > baseBox.left && x < baseBox.right, `${side} probe lies inside the control`).to.equal(
          true
        );
        const hit = document.elementFromPoint(x, y);
        expect(
          hit?.hasAttribute('data-halo') ?? false,
          `${side} halo is not clipped to the label (hit ${hit?.localName ?? 'nothing'})`
        ).to.equal(true);
      }
    });
  }

  it('keeps the square icon-only hit area and the focus ring with the glow unclipped', async () => {
    const el = await glowingIconButton('ltr');
    await el.updateComplete;
    const base = shadowPart(el, '[part~="base"]');
    const box = base.getBoundingClientRect();
    const floor = Number.parseFloat(getComputedStyle(base).minInlineSize);
    expect(floor, 'the icon-button floor resolves to a length').to.be.greaterThan(0);
    expect(box.width, 'inline hit area keeps the icon-button floor').to.be.at.least(floor - 0.5);
    expect(box.height, 'block hit area keeps the icon-button floor').to.be.at.least(floor - 0.5);
    expect(Math.abs(box.width - box.height), 'the control stays square').to.be.at.most(1.5);

    await focusByKeyboard(el);
    expect(base.matches(':focus-visible'), 'keyboard focus lands on the native control').to.equal(
      true
    );
    expect(getComputedStyle(base).outlineStyle, 'the focus ring still paints').to.equal('solid');
  });

  it('still clips and ellipsizes a text label that overflows', async () => {
    const el = (await fixture(html`
      <lr-button appearance="plain" style="inline-size: 120px;"
        >An accent colour label far too long to fit</lr-button
      >
    `)) as LyraButton;
    await el.updateComplete;
    const base = shadowPart(el, '[part~="base"]');
    const label = shadowPart(el, '[part="label"]');
    expect(base.hasAttribute('data-icon-button'), 'text is not icon-only').to.equal(false);
    expect(getComputedStyle(label).overflowX).to.equal('hidden');
    expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
    expect(label.scrollWidth > label.clientWidth, 'the text really is truncated').to.equal(true);
  });

  it('still clips a glowing glyph that sits beside a visible text label', async () => {
    const el = (await fixture(html`
      <lr-button appearance="plain"
        ><span data-glyph data-lr-gemstone-selected aria-hidden="true"
          style="display: inline-flex; inline-size: 1.15rem; block-size: 1.15rem;"
          >${gemstoneGlyph('rgb(37 99 235)')}</span
        >Sapphire</lr-button
      >
    `)) as LyraButton;
    await el.updateComplete;
    const base = shadowPart(el, '[part~="base"]');
    const label = shadowPart(el, '[part="label"]');
    expect(base.hasAttribute('data-icon-button'), 'visible text is a real label').to.equal(false);
    expect(getComputedStyle(label).overflowX, 'a text label keeps its truncation clip').to.equal(
      'hidden'
    );
  });
});
