import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraSlider } from './slider.js';
import './slider.js';

const thumbs = (slider: LyraSlider) => [...slider.shadowRoot!.querySelectorAll<HTMLElement>('[part~="thumb"]')];
async function settled(slider: LyraSlider): Promise<void> {
  await slider.updateComplete;
  await nextFrame();
  await slider.updateComplete;
}
async function mount() {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <button type="button">Continue outside the slider</button>
    <lr-slider label="Allocation" value="30" min-value="20" max-value="80"></lr-slider>
  </div>`);
  const slider = wrapper.querySelector<LyraSlider>('lr-slider')!;
  const outside = wrapper.querySelector<HTMLButtonElement>('button')!;
  await settled(slider);
  const scalar = thumbs(slider)[0]!;
  await focusByKeyboard(scalar);
  await settled(slider);
  expect(slider.shadowRoot!.activeElement === scalar).to.equal(true);
  expect(thumbs(slider).length).to.equal(1);
  return { slider, outside };
}

describe('slider pending mode-change focus ownership', () => {
  it('keeps a newly disabled slider unfocused when disable follows the committed mode change', async () => {
    const { slider } = await mount();
    const events: string[] = [];
    for (const type of ['lr-input', 'lr-change']) slider.addEventListener(type, () => events.push(type));
    slider.range = true;
    const disabled = new Promise<void>((resolve, reject) => {
      queueMicrotask(() => {
        try {
          // The application continuation follows the public mode update's DOM commit.
          expect(thumbs(slider).length).to.equal(2);
          slider.disabled = true;
          resolve();
        } catch (error) { reject(error); }
      });
    });
    await disabled;
    await settled(slider);
    expect(slider.disabled).to.equal(true);
    expect(slider.shadowRoot!.activeElement === null).to.equal(true);
    expect(slider.matches(':state(focused)')).to.equal(false);
    expect(thumbs(slider).map(thumb => thumb.tabIndex)).to.deep.equal([-1, -1]);
    expect(events).to.deep.equal([]);
    slider.disabled = false;
    await settled(slider);
    const lower = slider.shadowRoot!.querySelector<HTMLElement>('[part~="thumb-min"]')!;
    await focusByKeyboard(lower);
    await settled(slider);
    expect(slider.shadowRoot!.activeElement === lower).to.equal(true);
    expect(slider.minValue).to.equal(20);
    expect(slider.maxValue).to.equal(80);
  });

  it('preserves a newer external keyboard focus request after the replacement thumbs render', async () => {
    const { slider, outside } = await mount();
    slider.range = true;
    const transferred = new Promise<void>((resolve, reject) => {
      queueMicrotask(() => {
        try {
          expect(thumbs(slider).length).to.equal(2);
          void focusByKeyboard(outside).then(resolve, reject);
        } catch (error) { reject(error); }
      });
    });
    await transferred;
    await settled(slider);
    expect(slider.ownerDocument.activeElement === outside).to.equal(true);
    expect(slider.shadowRoot!.activeElement === null).to.equal(true);
    expect(slider.matches(':state(focused)')).to.equal(false);
    expect(thumbs(slider).map(thumb => thumb.tabIndex)).to.deep.equal([0, 0]);
    slider.range = false;
    await settled(slider);
    expect(slider.ownerDocument.activeElement === outside).to.equal(true);
    expect(thumbs(slider).length).to.equal(1);
    expect(slider.value).to.equal(30);
  });

  it('retires an old transfer across reconnect and follows the subsequently focused upper thumb', async () => {
    const { slider, outside } = await mount();
    const parent = slider.parentElement!;
    slider.range = true;
    const reconnected = new Promise<void>((resolve, reject) => {
      queueMicrotask(() => {
        try {
          expect(thumbs(slider).length).to.equal(2);
          slider.remove();
          parent.append(slider);
          void focusByKeyboard(outside).then(resolve, reject);
        } catch (error) { reject(error); }
      });
    });
    await reconnected;
    await settled(slider);
    expect(slider.ownerDocument.activeElement === outside).to.equal(true);
    expect(slider.shadowRoot!.activeElement === null).to.equal(true);
    expect(slider.matches(':state(focused)')).to.equal(false);
    const upper = slider.shadowRoot!.querySelector<HTMLElement>('[part~="thumb-max"]')!;
    await focusByKeyboard(upper);
    await settled(slider);
    expect(slider.shadowRoot!.activeElement === upper).to.equal(true);
    expect(slider.matches(':state(focused)')).to.equal(true);
    slider.stepUp();
    await settled(slider);
    expect(slider.minValue).to.equal(20);
    expect(slider.maxValue).to.equal(81);
    expect(slider.shadowRoot!.activeElement === upper).to.equal(true);
  });
});
