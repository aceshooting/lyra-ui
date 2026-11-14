import { expect, fixture, html } from '@open-wc/testing';
import './slider.js';
import type { LyraSlider } from './slider.js';

function thumb(slider: LyraSlider): HTMLElement {
  return slider.shadowRoot!.querySelector<HTMLElement>('[role="slider"]')!;
}

function pointer(slider: LyraSlider, type: string, ratio: number, pointerId = 17): void {
  const track = slider.shadowRoot!.querySelector<HTMLElement>('[part="track"]')!;
  const rect = track.getBoundingClientRect();
  const event = new PointerEvent(type, {
    bubbles: true,
    pointerId,
    pointerType: 'mouse',
    button: 0,
    clientX: rect.left + rect.width * ratio,
    clientY: rect.top + rect.height / 2,
  });
  if (type === 'pointerdown') track.dispatchEvent(event);
  else window.dispatchEvent(event);
}

describe('lr-slider pointer ownership', () => {
  it('ignores moves and releases from a pointer that does not own the drag', async () => {
    const slider = await fixture<LyraSlider>(html`<lr-slider value="20" style="inline-size: 300px"></lr-slider>`);
    // Synthetic pointer events cannot acquire native pointer capture. Only this fixture is stubbed.
    thumb(slider).setPointerCapture = () => {};
    const changes: number[] = [];
    slider.addEventListener('lr-change', () => changes.push(slider.value));

    pointer(slider, 'pointerdown', 0.5);
    const seeked = slider.value;
    pointer(slider, 'pointermove', 0.9, 99);
    pointer(slider, 'pointerup', 0.9, 99);
    expect(slider.value, 'a foreign pointer leaves the value').to.equal(seeked);
    expect(changes).to.deep.equal([]);

    pointer(slider, 'pointermove', 0.8);
    pointer(slider, 'pointerup', 0.8);
    expect(slider.value).to.be.greaterThan(seeked);
    expect(changes).to.deep.equal([slider.value]);
  });
});

describe('lr-slider range batches', () => {
  it('lets the last-written handle win when one batch crosses min over max', async () => {
    const slider = await fixture<LyraSlider>(html`<lr-slider range min-value="10" max-value="40"></lr-slider>`);
    slider.maxValue = 30;
    slider.minValue = 80;
    await slider.updateComplete;
    expect([slider.minValue, slider.maxValue]).to.deep.equal([80, 80]);
  });
});

describe('lr-slider formatted readout', () => {
  it('falls back to the tooltip formatter when no value formatter is set', async () => {
    const slider = await fixture<LyraSlider>(html`<lr-slider value="30" value-display="formatted" with-value></lr-slider>`);
    slider.tooltipFormatter = (value) => `${value} units`;
    await slider.updateComplete;
    expect(slider.shadowRoot!.querySelector('[part="value"]')!.textContent!.trim()).to.equal('30 units');
  });
});
