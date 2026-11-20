import { expect, fixture, html } from '@open-wc/testing';
import {
  activeFill,
  disabledControl,
  focusRingInset,
  focusRingInsetOffset,
  activeTint,
  hoverFill,
  hoverTint,
  interactiveTransition,
} from './interactive-control.styles.js';
import { blockHost, containerHost, inlineSizeContainer, wrapGuard } from './layout-fragments.styles.js';
import { dialogChrome } from './modal-surface.styles.js';
import { anchoredPopupOpen, anchoredPopupReveal } from './overlay-surface.styles.js';
import { brandVariantRow, neutralVariantRow, semanticVariantRows } from './semantic-variant-rows.styles.js';

const tokens = `--lr-focus-ring-width: 3px; --lr-focus-ring-color: rgb(1, 2, 3); --lr-focus-ring-offset: 2px;
  --lr-color-mix-partner: white; --lr-color-mix-hover: 10%; --lr-color-mix-active: 20%;
  --lr-transition-fast: 120ms ease-out;
  --lr-transition-interactive: background-color var(--lr-transition-fast), color var(--lr-transition-fast), border-color var(--lr-transition-fast);
  --lr-opacity-disabled: 0.4; --lr-space-l: 16px; --lr-safe-area-top: 40px; --lr-safe-area-bottom: 0px;
  --lr-safe-area-inline-start: 0px; --lr-safe-area-inline-end: 24px; --lr-size-20rem: 320px; --lr-size-neg-0-25rem: -4px;`;

let probeCount = 0;

/** Rules and markup address `#t` (and `#r`); both are renamed per probe so sheets never bleed between tests. */
async function probe(rules: string, markup = '<div id="t"></div>') {
  const suffix = `-${probeCount++}`;
  const rename = (text: string) => text.replaceAll(/#([tr])\b/g, `#$1${suffix}`).replaceAll(/id="([tr])"/g, `id="$1${suffix}"`);
  const root = await fixture<HTMLDivElement>(html`<div style=${tokens}>
    <style>${rename(rules)}</style>
    <div id="holder"></div>
  </div>`);
  root.querySelector('#holder')!.innerHTML = rename(markup);
  return root.querySelector<HTMLElement>(`#t${suffix}`)!;
}

it('draws the inset focus rings inside the box and absorbs the outer offset', async () => {
  const inset = await probe(`#t { ${focusRingInset.cssText} }`);
  expect(getComputedStyle(inset).outlineOffset).to.equal('-3px');
  expect(getComputedStyle(inset).outlineStyle).to.equal('solid');
  const absorbed = await probe(`#t { ${focusRingInsetOffset.cssText} }`);
  expect(getComputedStyle(absorbed).outlineOffset).to.equal('-5px');
  const negativeOffset = await probe(`#t { ${focusRingInsetOffset.cssText} }`);
  negativeOffset.parentElement!.parentElement!.style.setProperty('--lr-focus-ring-offset', '-4px');
  expect(getComputedStyle(negativeOffset).outlineOffset).to.equal('-3px');
});

it('mixes hover and press from the given fill, distinct per step', async () => {
  const base = 'rgb(0, 0, 255)';
  const hover = await probe(`#t { background: ${hoverFill(base).cssText}; } #r { background: color-mix(in oklab, ${base}, white 10%); }`, '<i id="t"></i><i id="r"></i>');
  const reference = hover.parentElement!.querySelector<HTMLElement>('[id^="r-"]')!;
  expect(getComputedStyle(hover).backgroundColor).to.equal(getComputedStyle(reference).backgroundColor);
  expect(getComputedStyle(hover).backgroundColor).not.to.equal(base);
  const press = await probe(`#t { background: ${activeFill(base).cssText}; }`);
  expect(getComputedStyle(press).backgroundColor).not.to.equal(getComputedStyle(hover).backgroundColor);
});

it('transitions fill, text and border together', async () => {
  const el = await probe(`#t { ${interactiveTransition.cssText} }`);
  const style = getComputedStyle(el);
  expect(style.transitionProperty).to.equal('background-color, color, border-color');
  expect(style.transitionDuration).to.equal('0.12s, 0.12s, 0.12s');
});

it('dims and blocks a disabled control', async () => {
  const el = await probe(`#t { ${disabledControl.cssText} }`);
  expect(getComputedStyle(el).opacity).to.equal('0.4');
  expect(getComputedStyle(el).cursor).to.equal('not-allowed');
});

it('provides the shared host shapes', async () => {
  const container = await probe(`#t { ${containerHost.cssText} }`);
  expect(getComputedStyle(container).display).to.equal('block');
  expect(getComputedStyle(container).containerType).to.equal('inline-size');
  const block = await probe(`#t { ${blockHost.cssText} }`);
  expect(getComputedStyle(block).minInlineSize).to.equal('0px');
  expect(getComputedStyle(block).maxInlineSize).to.equal('100%');
  const guard = await probe(`#t { ${wrapGuard.cssText} }`);
  expect(getComputedStyle(guard).overflowWrap).to.equal('break-word');
});

it('pads a dialog host by the larger of the gutter and the safe area', async () => {
  const el = await probe(`#t { display: flex; ${dialogChrome.cssText} }`);
  const style = getComputedStyle(el);
  expect(style.paddingBlockStart).to.equal('40px');
  expect(style.paddingBlockEnd).to.equal('16px');
  expect(style.paddingInlineEnd).to.equal('24px');
  expect(style.justifyContent).to.equal('center');
});

it('reveals an anchored popup from hidden to open', async () => {
  const el = await probe(`#t { ${anchoredPopupReveal.cssText} } #t[data-open] { ${anchoredPopupOpen.cssText} }`);
  expect(getComputedStyle(el).visibility).to.equal('hidden');
  expect(getComputedStyle(el).opacity).to.equal('0');
  el.setAttribute('data-open', '');
  el.style.transition = 'none';
  expect(getComputedStyle(el).visibility).to.equal('visible');
  expect(getComputedStyle(el).opacity).to.equal('1');
});

it('keeps the explicit semantic rows resolving to their own semantic grid row', async () => {
  const el = await probe(`${semanticVariantRows.cssText.replaceAll(':host(', '#t(').replaceAll(/#t\(\[variant='(\w+)'\]\)/g, "#t[variant='$1']")} #t { --lr-color-danger-fill-loud: rgb(9, 8, 7); }`, '<div id="t" variant="danger"></div>');
  expect(getComputedStyle(el).getPropertyValue('--lr-color-fill-loud').trim()).to.equal('rgb(9, 8, 7)');
});

it('tints the accent at the hover and press share over transparent', async () => {
  const accent = 'rgb(0, 0, 255)';
  const hover = await probe(`#t { background: ${hoverTint(accent).cssText}; } #r { background: color-mix(in srgb, ${accent} 10%, transparent); }`, '<i id="t"></i><i id="r"></i>');
  const reference = hover.parentElement!.querySelector<HTMLElement>('[id^="r-"]')!;
  expect(getComputedStyle(hover).backgroundColor).to.equal(getComputedStyle(reference).backgroundColor);
  const press = await probe(`#t { background: ${activeTint(accent).cssText}; } #r { background: color-mix(in srgb, ${accent} 20%, transparent); }`, '<i id="t"></i><i id="r"></i>');
  const pressReference = press.parentElement!.querySelector<HTMLElement>('[id^="r-"]')!;
  expect(getComputedStyle(press).backgroundColor).to.equal(getComputedStyle(pressReference).backgroundColor);
  expect(getComputedStyle(press).backgroundColor).not.to.equal(getComputedStyle(hover).backgroundColor);
});

it('makes the element an inline-size query container with the tokenized intrinsic fallback', async () => {
  const el = await probe(`#t { ${inlineSizeContainer.cssText} }`);
  expect(getComputedStyle(el).containerType).to.equal('inline-size');
  expect(getComputedStyle(el).containIntrinsicInlineSize).to.equal('320px');
});

it('points the generic colour slots at the neutral and brand rows', async () => {
  const palette = Object.fromEntries(
    ['neutral', 'brand'].flatMap(row => ['fill', 'border', 'on'].flatMap(axis => ['quiet', 'normal', 'loud'].map(tier => [`--lr-color-${row}-${axis}-${tier}`, `${row}-${axis}-${tier}`]))),
  );
  const declarations = Object.entries(palette).map(([name, value]) => `${name}: ${value};`).join(' ');
  const neutral = await probe(`#t { ${declarations} ${neutralVariantRow.cssText} } #r { ${declarations} ${brandVariantRow.cssText} }`, '<i id="t"></i><i id="r"></i>');
  const brand = neutral.parentElement!.querySelector<HTMLElement>('[id^="r-"]')!;
  for (const axis of ['fill', 'border', 'on']) {
    for (const tier of ['quiet', 'normal', 'loud']) {
      expect(getComputedStyle(neutral).getPropertyValue(`--lr-color-${axis}-${tier}`).trim()).to.equal(`neutral-${axis}-${tier}`);
      expect(getComputedStyle(brand).getPropertyValue(`--lr-color-${axis}-${tier}`).trim()).to.equal(`brand-${axis}-${tier}`);
    }
  }
});
