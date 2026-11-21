import { sendKeys } from '@web/test-runner-commands';
import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-segmented.js';
import type { LyraSegmented, LyraSegmentedItem } from '../../lr-segmented.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const ITEMS: LyraSegmentedItem[] = [
  { value: 'all', label: 'All conversations' },
  { value: 'active', label: 'Active conversations' },
  { value: 'waiting', label: 'Waiting for review' },
  { value: 'archived', label: 'Archived conversations' },
  { value: 'assigned', label: 'Assigned to me' },
  { value: 'mentions', label: 'Mentions and replies, including a much longer label' },
];

async function mount(layout: string, extra = '', dir = 'ltr'): Promise<LyraSegmented> {
  const wrap = await fixture<HTMLElement>(html`<div dir=${dir} style="inline-size: 320px">
    <lr-segmented layout=${layout} style=${extra} .items=${ITEMS} value="all"></lr-segmented>
  </div>`);
  const el = wrap.querySelector('lr-segmented') as LyraSegmented;
  await el.updateComplete;
  return el;
}

const base = (el: LyraSegmented): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const segments = (el: LyraSegmented): HTMLElement[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="segment"]')];
const rows = (el: LyraSegmented): number => new Set(segments(el).map((s) => Math.round(s.getBoundingClientRect().top))).size;

describe('lr-segmented layout', () => {
  it('defaults to one scrolling row', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 320px">
      <lr-segmented .items=${ITEMS} value="all"></lr-segmented>
    </div>`);
    const el = wrap.querySelector('lr-segmented') as LyraSegmented;
    await el.updateComplete;
    expect(el.getAttribute('layout')).to.equal('scroll');
    expect(getComputedStyle(base(el)).overflowX).to.equal('auto');
    expect(rows(el)).to.equal(1);
    expect(getComputedStyle(base(el)).flexWrap).to.equal('nowrap');
  });

  it('wraps onto several rows at 320px with no horizontal overflow, fade or clipped labels', async () => {
    const el = await mount('wrap');
    const track = base(el);
    expect(rows(el)).to.be.greaterThan(1);
    expect(track.scrollWidth).to.be.at.most(track.clientWidth + 1);
    expect(track.getBoundingClientRect().width).to.be.at.most(321);
    track.setAttribute('data-scroll-overflow', '');
    track.setAttribute('data-scroll-end', '');
    const style = getComputedStyle(track);
    expect(style.maskImage || style.webkitMaskImage || 'none').to.equal('none');
    const longest = segments(el).at(-1)!;
    expect(getComputedStyle(longest).whiteSpace).to.equal('normal');
    expect(longest.scrollWidth).to.be.at.most(longest.clientWidth + 1);
  });

  it('places segments in the column-token grid', async () => {
    const el = await mount('grid', '--lr-segmented-columns: 2');
    const lefts = new Set(segments(el).map((s) => Math.round(s.getBoundingClientRect().left)));
    expect(lefts.size).to.equal(2);
    expect(rows(el)).to.equal(3);
    expect(getComputedStyle(base(el)).gridTemplateColumns.split(' ').length).to.equal(2);
    const fallback = await mount('grid');
    expect(new Set(segments(fallback).map((s) => Math.round(s.getBoundingClientRect().left))).size).to.equal(3);
  });

  for (const dir of ['ltr', 'rtl'] as const) {
    it(`moves along reading order onto the next row in a ${dir} grid`, async () => {
      const el = await mount('grid', '--lr-segmented-columns: 2', dir);
      const [first, second, third] = segments(el);
      const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      const firstRect = first!.getBoundingClientRect();
      const secondRect = second!.getBoundingClientRect();
      expect(dir === 'rtl' ? secondRect.left < firstRect.left : secondRect.left > firstRect.left).to.equal(true);
      await focusByKeyboard(first!);
      await sendKeys({ press: forward });
      await sendKeys({ press: forward });
      await el.updateComplete;
      expect(el.value).to.equal('waiting');
      expect(third!.getBoundingClientRect().top).to.be.greaterThan(firstRect.top);
      await sendKeys({ press: back });
      await el.updateComplete;
      expect(el.value).to.equal('active');
    });
  }
});
