import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../test/wtr-media.js';
import { iconAction, iconActionActive, iconActionHover, iconActionStyles } from './icon-action.styles.js';

const tokens = '--lr-color-surface: rgb(255, 255, 255); --lr-color-mix-partner: rgb(0, 0, 0); --lr-color-mix-hover: 10%; --lr-color-mix-active: 20%; --lr-transition-fast: 0s;';

async function mount() {
  return fixture<HTMLDivElement>(html`<div style=${tokens}>
    <style>
      .b { ${iconAction.cssText} }
      .b.hover { ${iconActionHover.cssText} }
      .b.active { ${iconActionActive.cssText} }
    </style>
    <button class="b" id="plain"></button>
    <button class="b hover" id="hover"></button>
    <button class="b active" id="active"></button>
    <button class="b hover" id="themed-hover" style="--lr-icon-button-bg: rgb(0, 128, 0)"></button>
    <button class="b active" id="themed-active" style="--lr-icon-button-bg: rgb(0, 128, 0)"></button>
  </div>`);
}

const bg = (root: HTMLElement, id: string) => getComputedStyle(root.querySelector(`#${id}`)!).backgroundColor;

it('mixes hover and press from the resting fill a theme sets, not from the page surface', async () => {
  const root = await mount();
  expect(bg(root, 'themed-hover')).not.to.equal(bg(root, 'hover'));
  expect(bg(root, 'themed-hover')).not.to.equal('rgb(0, 128, 0)');
  expect(bg(root, 'themed-active')).not.to.equal(bg(root, 'themed-hover'));
  expect(bg(root, 'active')).not.to.equal(bg(root, 'hover'));
});

it('paints hover and press with system colours under forced colors', async () => {
  const root = await mount();
  try {
    await setForcedColors('active');
  } catch {
    return;
  }
  try {
    if (!matchMedia('(forced-colors: active)').matches) return;
    const resting = bg(root, 'plain');
    expect(bg(root, 'hover')).not.to.equal(resting);
    expect(bg(root, 'active')).not.to.equal(resting);
  } finally {
    await setForcedColors('none');
  }
});

it('composes a complete icon action with per-control fallbacks that yield to the public tokens', async () => {
  const css = iconActionStyles('.act', { background: 'rgb(1, 2, 3)', color: 'rgb(4, 5, 6)' }).cssText;
  const root = await fixture<HTMLDivElement>(html`<div style=${`${tokens} --lr-icon-button-size: 40px; --lr-opacity-disabled: 0.5;`}>
    <style>${css}</style>
    <button class="act" id="fallback"></button>
    <button class="act" id="themed" style="--lr-icon-button-bg: rgb(7, 8, 9)"></button>
    <button class="act" id="disabled" disabled></button>
    <button class="act" id="aria-disabled" aria-disabled="true"></button>
  </div>`);
  const style = (id: string) => getComputedStyle(root.querySelector(`#${id}`)!);
  expect(style('fallback').backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(style('fallback').color).to.equal('rgb(4, 5, 6)');
  expect(style('fallback').minInlineSize).to.equal('40px');
  expect(style('themed').backgroundColor).to.equal('rgb(7, 8, 9)');
  expect(style('disabled').opacity).to.equal('0.5');
  expect(style('aria-disabled').cursor).to.equal('not-allowed');
  expect(iconActionStyles('.plain').cssText.includes('--_lr-icon-button-background-default:')).to.equal(false);
});
