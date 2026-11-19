import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './image-comparer.js';
import type { LyraImageComparer } from './image-comparer.js';

const comparer = (style = ''): Promise<LyraImageComparer> =>
  fixture<LyraImageComparer>(html`<lr-image-comparer style=${style}><div slot="before">a</div><div slot="after">b</div></lr-image-comparer>`);

it('retints the divider and handle through public tokens', async () => {
  const el = await comparer('--lr-image-comparer-divider-color: rgb(255, 0, 0); --lr-image-comparer-handle-bg: rgb(0, 0, 255); --lr-image-comparer-handle-color: rgb(0, 255, 0); --lr-image-comparer-handle-border-color: rgb(1, 2, 3)');
  const divider = getComputedStyle(el.shadowRoot!.querySelector('[part="divider"]')!);
  const handle = getComputedStyle(el.shadowRoot!.querySelector('.handle-visual')!);
  expect(divider.backgroundColor).to.equal('rgb(255, 0, 0)');
  expect(handle.backgroundColor).to.equal('rgb(0, 0, 255)');
  expect(handle.color).to.equal('rgb(0, 255, 0)');
  expect(handle.borderTopColor).to.equal('rgb(1, 2, 3)');
});

it('keeps the divider distinguishable from the canvas in forced colors', async () => {
  const el = await comparer();
  await setForcedColors('active');
  try {
    const divider = el.shadowRoot!.querySelector('[part="divider"]')!;
    const base = el.shadowRoot!.querySelector('[part~="base"]')!;
    expect(getComputedStyle(divider).backgroundColor !== getComputedStyle(base).backgroundColor).to.equal(true);
  } finally {
    await setForcedColors('none');
  }
});
