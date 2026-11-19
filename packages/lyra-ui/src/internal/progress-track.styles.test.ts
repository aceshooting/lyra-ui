import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../test/wtr-media.js';
import { progressIndicatorPaint, progressTrackPaint } from './progress-track.styles.js';

async function enterForcedColors(): Promise<boolean> {
  try {
    await setForcedColors('active');
  } catch {
    return false;
  }
  if (matchMedia('(forced-colors: active)').matches) return true;
  await setForcedColors('none');
  return false;
}

async function mount() {
  return fixture<HTMLDivElement>(html`<div style="--lr-border-width-thin: 1px">
    <style>
      .track { block-size: 8px; inline-size: 100px; ${progressTrackPaint.cssText} }
      .indicator { block-size: 100%; inline-size: 40%; ${progressIndicatorPaint.cssText} }
    </style>
    <div class="track"><div class="indicator"></div></div>
  </div>`);
}

it('paints the authored track and indicator outside forced colors', async () => {
  const root = await mount();
  expect(getComputedStyle(root.querySelector('.track')!).outlineStyle).to.equal('none');
  if (CSS.supports('forced-color-adjust', 'none')) {
    expect(getComputedStyle(root.querySelector('.indicator')!).forcedColorAdjust).to.equal('auto');
  }
});

it('keeps the value fill and the track edge visible under forced colors', async () => {
  const root = await mount();
  if (!(await enterForcedColors())) return;
  try {
    const track = getComputedStyle(root.querySelector('.track')!);
    const indicator = getComputedStyle(root.querySelector('.indicator')!);
    expect(track.outlineStyle).to.equal('solid');
    if (CSS.supports('forced-color-adjust', 'none')) expect(indicator.forcedColorAdjust).to.equal('none');
    expect(indicator.backgroundColor).not.to.equal(track.backgroundColor);
  } finally {
    await setForcedColors('none');
  }
});
