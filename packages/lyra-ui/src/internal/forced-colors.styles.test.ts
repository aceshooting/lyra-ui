import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../test/wtr-media.js';
import { forcedColorsDataFill, forcedColorsPart, forcedColorsSelected } from './forced-colors.styles.js';

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
      .tint { background-color: rgb(200, 220, 255); color: rgb(0, 0, 80); }
      .fill { background-color: rgb(255, 0, 0); }
      ${forcedColorsSelected.cssText}
      ${forcedColorsDataFill.cssText}
      ${forcedColorsPart('.custom').cssText}
    </style>
    <div class="tint plain"></div>
    <div class="tint" aria-selected="true" id="selected"></div>
    <div class="tint" aria-current="page" id="current"></div>
    <div class="tint" data-active id="active"></div>
    <div class="tint custom" id="custom"></div>
    <div class="fill" data-fill id="fill"></div>
  </div>`);
}

const paint = (root: HTMLElement, selector: string) => getComputedStyle(root.querySelector(selector)!);

it('leaves authored paint alone while forced colors are off', async () => {
  const root = await mount();
  expect(paint(root, '#selected').backgroundColor).to.equal(paint(root, '.plain').backgroundColor);
  expect(paint(root, '#fill').backgroundColor).to.equal('rgb(255, 0, 0)');
});

it('gives selected, current, active and part-targeted states a distinguishable system paint', async function () {
  const root = await mount();
  if (!(await enterForcedColors())) return;
  try {
    const plain = paint(root, '.plain');
    for (const id of ['#selected', '#current', '#active', '#custom']) {
      const state = paint(root, id);
      expect(state.backgroundColor, `${id} fill`).not.to.equal(plain.backgroundColor);
      expect(state.outlineStyle, `${id} outline`).to.equal('solid');
    }
    expect(plain.outlineStyle).to.equal('none');
  } finally {
    await setForcedColors('none');
  }
});

it('keeps a data fill filled and edged under forced colors', async () => {
  const root = await mount();
  if (!(await enterForcedColors())) return;
  try {
    const fill = paint(root, '#fill');
    expect(fill.backgroundColor).not.to.equal('rgba(0, 0, 0, 0)');
    expect(fill.borderTopStyle).to.equal('solid');
  } finally {
    await setForcedColors('none');
  }
});
