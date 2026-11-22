import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import '../../lr-timeline.js';
import '../../lr-timeline-item.js';
import type { LyraTimeline } from '../../lr-timeline.js';

/** Flex direction of one slotted item's own `[part~="base"]`: `row` while the timeline runs as a
 *  column (marker beside content), `column` while it runs as a row (marker above content). */
function itemDirection(timeline: LyraTimeline, index = 0): string {
  const item = timeline.querySelectorAll('lr-timeline-item')[index]!;
  return getComputedStyle(item.shadowRoot!.querySelector('[part~="base"]')!).flexDirection;
}

function baseDirection(timeline: LyraTimeline): string {
  return getComputedStyle(timeline.shadowRoot!.querySelector('[part~="base"]')!).flexDirection;
}

async function autoTimeline(width: string, dir = 'ltr'): Promise<{ wrapper: HTMLElement; timeline: LyraTimeline }> {
  const wrapper = await fixture<HTMLElement>(html`
    <div dir=${dir} style="inline-size: ${width}; font-size: 16px">
      <lr-timeline orientation="auto" aria-label="Release">
        <lr-timeline-item>Queued</lr-timeline-item>
        <lr-timeline-item>Built</lr-timeline-item>
        <lr-timeline-item>Released</lr-timeline-item>
      </lr-timeline>
    </div>
  `);
  const timeline = wrapper.querySelector('lr-timeline') as LyraTimeline;
  await timeline.updateComplete;
  return { wrapper, timeline };
}

describe('lr-timeline orientation="auto"', () => {
  it('accepts and reflects auto as a property and attribute value', async () => {
    const el = await fixture<LyraTimeline>(html`<lr-timeline></lr-timeline>`);
    el.orientation = 'auto';
    await el.updateComplete;
    expect(el.orientation).to.equal('auto');
    expect(el.getAttribute('orientation')).to.equal('auto');
  });

  it('runs as a row when every item gets about 10em of the measured inline size', async () => {
    const { timeline } = await autoTimeline('900px');
    expect(timeline.effectiveOrientation).to.equal('horizontal');
    expect(timeline.getAttribute('data-effective-orientation')).to.equal('horizontal');
    expect(baseDirection(timeline)).to.equal('row');
    expect(itemDirection(timeline)).to.equal('column');
  });

  it('stacks into a column at 320px without overflowing it', async () => {
    const { timeline } = await autoTimeline('320px');
    expect(timeline.effectiveOrientation).to.equal('vertical');
    expect(timeline.getAttribute('data-effective-orientation')).to.equal('vertical');
    expect(baseDirection(timeline)).to.equal('column');
    expect(itemDirection(timeline)).to.equal('row');
    expect(timeline.scrollWidth).to.be.at.most(320);
    const base = timeline.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    expect(base.getAttribute('tabindex')).to.equal('-1');
  });

  it('follows allocation changes in both directions', async () => {
    const { wrapper, timeline } = await autoTimeline('900px');
    expect(timeline.effectiveOrientation).to.equal('horizontal');
    wrapper.style.inlineSize = '320px';
    await waitUntil(() => timeline.effectiveOrientation === 'vertical', 'did not stack when narrowed');
    await timeline.updateComplete;
    expect(itemDirection(timeline)).to.equal('row');
    wrapper.style.inlineSize = '900px';
    await waitUntil(() => timeline.effectiveOrientation === 'horizontal', 'did not return to a row when widened');
    await timeline.updateComplete;
    expect(itemDirection(timeline)).to.equal('column');
  });

  it('stacks once added items no longer fit the row', async () => {
    const { timeline } = await autoTimeline('500px');
    expect(timeline.effectiveOrientation).to.equal('horizontal');
    const extra = document.createElement('lr-timeline-item');
    extra.textContent = 'Rolled back';
    timeline.append(extra);
    await waitUntil(() => timeline.effectiveOrientation === 'vertical', 'did not stack after a fourth item');
  });

  it('mirrors the row under RTL', async () => {
    const { timeline } = await autoTimeline('900px', 'rtl');
    expect(timeline.effectiveOrientation).to.equal('horizontal');
    const [first, second] = [...timeline.querySelectorAll('lr-timeline-item')];
    expect(first!.getBoundingClientRect().left).to.be.greaterThan(second!.getBoundingClientRect().left);
  });

  it('drops the effective-orientation marker when an explicit axis replaces auto', async () => {
    const { timeline } = await autoTimeline('320px');
    timeline.orientation = 'horizontal';
    await timeline.updateComplete;
    expect(timeline.hasAttribute('data-effective-orientation')).to.equal(false);
    expect(timeline.effectiveOrientation).to.equal('horizontal');
    expect(itemDirection(timeline)).to.equal('column');
    timeline.orientation = 'vertical';
    await timeline.updateComplete;
    expect(timeline.effectiveOrientation).to.equal('vertical');
    expect(itemDirection(timeline)).to.equal('row');
  });

  it('leaves the default vertical timeline unmarked and unmeasured', async () => {
    const el = await fixture<LyraTimeline>(html`
      <div style="inline-size: 900px"><lr-timeline><lr-timeline-item>A</lr-timeline-item></lr-timeline></div>
    `);
    const timeline = el.querySelector('lr-timeline') as LyraTimeline;
    await timeline.updateComplete;
    expect(timeline.orientation).to.equal('vertical');
    expect(timeline.effectiveOrientation).to.equal('vertical');
    expect(timeline.hasAttribute('data-effective-orientation')).to.equal(false);
  });
});
