import { expect, fixture, html } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.class.js';

async function verticalSplit(): Promise<LyraMultiSplit> {
  const el = await fixture<LyraMultiSplit>(html`<lr-multi-split orientation="vertical" style="inline-size:300px;block-size:240px">
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await el.updateComplete;
  return el;
}

function dividerOf(el: LyraMultiSplit, index = 0): HTMLElement {
  const divider = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="divider"]')[index]!;
  divider.setPointerCapture = () => {};
  return divider;
}

describe('lr-multi-split vertical pointer drag', () => {
  it('resizes the panels along the block axis and settles once on release', async () => {
    const el = await verticalSplit();
    const total = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.clientHeight;
    const divider = dividerOf(el);
    let changes = 0;
    el.addEventListener('lr-resize-change', () => (changes += 1));

    divider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 301, clientX: 500, clientY: 100 }));
    // Inline movement is irrelevant to a vertical split; only the block delta counts.
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 301, clientX: 0, clientY: 148 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 301, clientX: 0, clientY: 148 }));
    await el.updateComplete;

    const expectedFirst = 50 + (48 / total) * 100;
    expect(el.sizes[0]!).to.be.closeTo(expectedFirst, 0.01);
    expect(el.sizes[0]! + el.sizes[1]!).to.be.closeTo(100, 0.001);
    expect(changes).to.equal(1);
  });

  it('ignores a second pointerdown reusing an active pointer id', async () => {
    const el = await fixture<LyraMultiSplit>(html`<lr-multi-split orientation="vertical" style="inline-size:300px;block-size:240px">
      <div>A</div>
      <div>B</div>
      <div>C</div>
    </lr-multi-split>`);
    await el.updateComplete;
    const total = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.clientHeight;
    const first = dividerOf(el, 0);
    const second = dividerOf(el, 1);
    const before = [...el.sizes];

    first.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 302, clientY: 80 }));
    second.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 302, clientY: 160 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 302, clientY: 104 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 302, clientY: 104 }));
    await el.updateComplete;

    // Only the first divider's pair moved; the third panel kept its share.
    const shift = (24 / total) * 100;
    expect(el.sizes[0]!).to.be.closeTo(before[0]! + shift, 0.01);
    expect(el.sizes[1]!).to.be.closeTo(before[1]! - shift, 0.01);
    expect(el.sizes[2]!).to.be.closeTo(before[2]!, 0.001);
  });
});
