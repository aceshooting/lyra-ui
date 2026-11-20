import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-time-range.js';
import type { LyraTimeRange } from './time-range.class.js';

it('tints a hovered unselected preset away from its resting fill by default', async () => {
  const el = await fixture<LyraTimeRange>(html`
    <lr-time-range min="0" max="100" start="10" end="90" style="--lr-transition-interactive: none"></lr-time-range>
  `);
  el.presets = [{ label: 'Quarter', start: 0, end: 25 }] as LyraTimeRange['presets'];
  await el.updateComplete;
  const preset = el.shadowRoot!.querySelector<HTMLElement>('[part="preset-button"]')!;
  const resting = getComputedStyle(preset).backgroundColor;
  try {
    await hoverUntilMatched(preset, 'the preset button never took the pointer');
    await waitUntil(() => getComputedStyle(preset).backgroundColor !== resting, 'hover fill never differed from rest');
  } finally {
    await resetMouse();
  }
});

it('eases the handle paint with the interactive transition', async () => {
  const range = await fixture<LyraTimeRange>(html`<lr-time-range min="0" max="100" start="10" end="90"></lr-time-range>`);
  const handle = range.shadowRoot!.querySelector<HTMLElement>('[part^="handle"]')!;
  expect(getComputedStyle(handle).transitionProperty).to.contain('background-color');
});
