import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-app-rail.js';
import type { LyraAppRail } from '../../lr-app-rail.js';

const edges = (el: LyraAppRail) => {
  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!);
  return [base.borderTopStyle, base.borderInlineStartStyle, base.borderInlineEndStyle, base.borderTopWidth];
};

it('borders a card-framed rail from --lr-app-rail-frame-border on every side, with the edge token still owning the inline end', async () => {
  const el = await fixture<LyraAppRail>(html`<lr-app-rail frame="card"></lr-app-rail>`);
  expect(edges(el)).to.deep.equal(['solid', 'solid', 'solid', '1px']);
  el.style.setProperty('--lr-app-rail-frame-border', '2px dashed rgb(1, 2, 3)');
  expect(edges(el)).to.deep.equal(['dashed', 'dashed', 'dashed', '2px']);
  el.style.setProperty('--lr-app-rail-edge-border', '0');
  expect(edges(el)).to.deep.equal(['dashed', 'dashed', 'none', '2px']);
});
