import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-slider.js';
import type { LyraSlider, LyraSliderMark } from './slider.class.js';

const HOURS: LyraSliderMark[] = Array.from({ length: 13 }, (_unused, index) => ({
  value: index * 2,
  label: `${String(index * 2).padStart(2, '0')}:00`,
}));

async function mount(width: number, dir: 'ltr' | 'rtl' = 'ltr', marks: readonly LyraSliderMark[] = HOURS) {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div dir=${dir} style="inline-size: ${width}px">
      <lr-slider label="Hour" min="0" max="24" .marks=${marks}></lr-slider>
    </div>
  `);
  const el = wrapper.querySelector('lr-slider') as LyraSlider;
  await el.updateComplete;
  return { wrapper, el };
}

const parts = (el: LyraSlider, part: string) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${part}"]`)];
const centre = (node: HTMLElement) => {
  const rect = node.getBoundingClientRect();
  return rect.left + rect.width / 2;
};
const thinned = (el: LyraSlider) => parts(el, 'mark-label-thinned').length;

describe('lr-slider marks', () => {
  it('centres each tick and label on its logical position, mirrored under RTL', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const { el } = await mount(800, dir, [{ value: 0, label: 'Start' }, { value: 6, label: 'Quarter' }, { value: 24 }]);
      const track = el.shadowRoot!.querySelector<HTMLElement>('[part="track"]')!.getBoundingClientRect();
      const [start, quarter, end] = parts(el, 'mark');
      const startEdge = dir === 'ltr' ? track.left : track.right;
      const sign = dir === 'ltr' ? 1 : -1;
      expect(Math.abs(centre(start!) - startEdge), `${dir} start`).to.be.below(1);
      expect(Math.abs(centre(quarter!) - (startEdge + sign * track.width * 0.25)), `${dir} quarter`).to.be.below(1);
      expect(Math.abs(centre(end!) - (startEdge + sign * track.width)), `${dir} end`).to.be.below(1);
      const labels = parts(el, 'mark-label');
      expect(labels.map((label) => label.textContent)).to.deep.equal(['Start', 'Quarter']);
      expect(Math.abs(centre(labels[1]!) - centre(quarter!)), `${dir} label centre`).to.be.below(1);
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.getBoundingClientRect();
      expect(labels[1]!.getBoundingClientRect().bottom, 'base reserves the label line').to.be.at.most(base.bottom + parseFloat(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).marginBlockEnd) + 1);
    }
  });

  it('thins overlapping labels at 320px and restores them when the slider widens', async () => {
    const { wrapper, el } = await mount(320);
    const hidden = thinned(el);
    expect(hidden, 'some labels are thinned at 320px').to.be.above(0);
    const visible = parts(el, 'mark-label').filter((label) => !label.part.contains('mark-label-thinned'));
    const rects = visible.map((label) => label.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    for (let index = 1; index < rects.length; index += 1) {
      expect(rects[index]!.left, `label ${index} clears its neighbour`).to.be.at.least(rects[index - 1]!.right);
    }
    expect(getComputedStyle(parts(el, 'mark-label-thinned')[0]!).visibility).to.equal('hidden');
    wrapper.style.inlineSize = '1600px';
    await waitUntil(() => thinned(el) === 0, 'labels return once there is room');
  });

  it('keeps re-thinning labels on resize after the slider is moved', async () => {
    const { wrapper, el } = await mount(1600);
    expect(thinned(el)).to.equal(0);
    el.remove();
    wrapper.append(el);
    await el.updateComplete;
    wrapper.style.inlineSize = '320px';
    await waitUntil(() => thinned(el) > 0, 'a reattached slider thins labels when it narrows');
    wrapper.style.inlineSize = '1600px';
    await waitUntil(() => thinned(el) === 0, 'and restores them when it widens again');
  });

  it('keeps marks decorative and the handle value text authoritative', async () => {
    const { el } = await mount(800);
    el.valueFormatter = (value) => `${value}:00`;
    el.value = 6;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="marks"]')!.getAttribute('aria-hidden')).to.equal('true');
    expect(el.shadowRoot!.querySelector('[part~="thumb"]')!.getAttribute('aria-valuetext')).to.equal('6:00');
    await expect(el).to.be.accessible();
  });

  it('skips out-of-domain and malformed marks, and renders nothing for an empty list', async () => {
    const { el } = await mount(400, 'ltr', [
      { value: -1, label: 'Before' },
      { value: 30, label: 'After' },
      { value: Number.NaN },
      null as unknown as LyraSliderMark,
      { value: 12, label: '   ' },
    ]);
    expect(parts(el, 'mark')).to.have.length(1);
    expect(parts(el, 'mark-label')).to.have.length(0);
    expect(el.shadowRoot!.querySelector('[part~="base"]')!.hasAttribute('data-mark-labels')).to.be.false;
    el.marks = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="marks"]') === null).to.be.true;
  });

  it('places labels beside a vertical scale and thins them bottom-up', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="block-size: 120px">
        <lr-slider label="Hour" orientation="vertical" min="0" max="24" .marks=${HOURS}></lr-slider>
      </div>
    `);
    const el = wrapper.querySelector('lr-slider') as LyraSlider;
    await el.updateComplete;
    const [first] = parts(el, 'mark-label');
    const track = el.shadowRoot!.querySelector<HTMLElement>('[part="track"]')!.getBoundingClientRect();
    expect(first!.getBoundingClientRect().left).to.be.above(track.right);
    expect(first!.part.contains('mark-label-thinned'), 'the bottom label stays').to.be.false;
    el.remove();
  });
  it('draws no marks over an empty domain and stops measuring once labels go away', async () => {
    const { el } = await mount(400);
    expect(parts(el, 'mark-label').length).to.be.above(0);
    el.marks = [{ value: 12 }];
    await el.updateComplete;
    expect(parts(el, 'mark-label')).to.have.length(0);
    el.min = 5;
    el.max = 5;
    await el.updateComplete;
    expect(parts(el, 'mark')).to.have.length(0);
  });
});
