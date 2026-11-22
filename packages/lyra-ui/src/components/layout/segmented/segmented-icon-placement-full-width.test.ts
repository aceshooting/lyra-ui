import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-segmented.js';
import type { LyraSegmented } from '../../lr-segmented.js';

const items = [
  { value: 'a', label: 'Alpha', icon: html`<b>i</b>` },
  { value: 'b', label: 'Beta', icon: html`<b>i</b>` },
];

describe('lr-segmented icon placement and full width', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    it(`renders each icon after its label with icon-placement="end" (${dir})`, async () => {
      const el = await fixture<LyraSegmented>(html`<lr-segmented dir=${dir} icon-placement="end" .items=${items}></lr-segmented>`);
      const segment = el.shadowRoot!.querySelector('[part="segment"]')!;
      const label = segment.querySelector('[part="segment-label"]')!;
      const icon = segment.querySelector('[part="segment-icon"]')!;
      expect(label.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).to.not.equal(0);
      const [l, i] = [label.getBoundingClientRect(), icon.getBoundingClientRect()];
      expect(dir === 'ltr' ? i.left >= l.right - 0.5 : i.right <= l.left + 0.5).to.equal(true);
      expect(getComputedStyle(icon).marginInlineStart).to.not.equal('0px');
      expect(getComputedStyle(icon).marginInlineEnd).to.equal('0px');
    });
  }

  it('keeps the icon before the label by default and normalizes an unknown placement', async () => {
    const el = await fixture<LyraSegmented>(html`<lr-segmented .items=${items}></lr-segmented>`);
    const segment = el.shadowRoot!.querySelector('[part="segment"]')!;
    expect(segment.firstElementChild!.getAttribute('part')).to.equal('segment-icon');
    el.iconPlacement = 'sideways' as never;
    await el.updateComplete;
    expect(el.iconPlacement).to.equal('start');
  });

  it('full-width stretches the track and its segments across the container', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 480px">
      <lr-segmented .items=${items}></lr-segmented><lr-segmented full-width .items=${items}></lr-segmented>
    </div>`);
    const [plain, full] = Array.from(wrap.querySelectorAll('lr-segmented')) as LyraSegmented[];
    expect(plain!.getBoundingClientRect().width).to.be.lessThan(300);
    expect(Math.round(full!.getBoundingClientRect().width)).to.equal(480);
    const base = full!.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect();
    const segments = Array.from(full!.shadowRoot!.querySelectorAll('[part="segment"]')).map((s) => s.getBoundingClientRect());
    expect(Math.round(base.width)).to.equal(480);
    expect(segments[1]!.right).to.be.closeTo(base.right, 6);
  });
});
