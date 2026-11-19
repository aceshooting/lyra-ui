import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../test/wtr-media.js';
import { iconAction, iconActionActive, iconActionHover } from './icon-action.styles.js';

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
