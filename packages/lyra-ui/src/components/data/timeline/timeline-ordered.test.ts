import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-timeline.js';
import '../../lr-timeline-item.js';
import type { LyraTimeline } from '../../lr-timeline.js';
import type { LyraTimelineItem } from '../../lr-timeline-item.js';

expectLocaleFallback('ar-u-nu-arab', ['timeline']);

async function settle(el: LyraTimeline): Promise<void> {
  await el.updateComplete;
  for (const item of el.querySelectorAll<LyraTimelineItem>('lr-timeline-item')) await item.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  for (const item of el.querySelectorAll<LyraTimelineItem>('lr-timeline-item')) await item.updateComplete;
}

function numbers(el: LyraTimeline): string[] {
  return [...el.querySelectorAll<LyraTimelineItem>('lr-timeline-item')].map(
    (item) => item.shadowRoot!.querySelector('[part="marker-number"]')?.textContent?.trim() ?? ''
  );
}

function marker(item: LyraTimelineItem): HTMLElement {
  return item.shadowRoot!.querySelector<HTMLElement>('[part~="marker"]')!;
}

async function ordered(markup = 'ordered'): Promise<LyraTimeline> {
  const el = await fixture<LyraTimeline>(html`
    <lr-timeline aria-label="Application steps" ?ordered=${markup.includes('ordered')} start=${markup.includes('start') ? '5' : '1'}>
      <lr-timeline-item>Submit the form<span slot="timestamp">by 3 March</span></lr-timeline-item>
      <lr-timeline-item>Pay the fee<span slot="description">Within 10 working days.</span></lr-timeline-item>
      <lr-timeline-item>Collect the permit</lr-timeline-item>
    </lr-timeline>
  `);
  await settle(el);
  return el;
}

describe('lr-timeline ordered', () => {
  it('renders an ordered list with numbered, readable markers', async () => {
    const el = await ordered();
    expect(el.ordered).to.equal(true);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.localName).to.equal('ol');
    expect(base.getAttribute('role')).to.equal('list');
    expect(base.getAttribute('aria-label')).to.equal('Application steps');
    expect(numbers(el)).to.deep.equal(['1', '2', '3']);
    const first = el.querySelector<LyraTimelineItem>('lr-timeline-item')!;
    expect(first.getAttribute('role')).to.equal('listitem');
    // The number is real text in the accessibility tree, not a decorative glyph.
    expect(marker(first).hasAttribute('aria-hidden')).to.equal(false);
    expect(marker(first).querySelector('slot[name="marker-icon"]') === null).to.equal(true);
    await expect(el).to.be.accessible();
  });

  it('stays an unordered role="list" with decorative dots by default', async () => {
    const el = await ordered('');
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.localName).to.equal('div');
    expect(numbers(el)).to.deep.equal(['', '', '']);
    const first = el.querySelector<LyraTimelineItem>('lr-timeline-item')!;
    expect(marker(first).getAttribute('aria-hidden')).to.equal('true');
  });

  it('numbers from start, and falls back to 1 for a non-finite start', async () => {
    const el = await ordered('ordered start');
    expect(numbers(el)).to.deep.equal(['5', '6', '7']);
    el.start = Number.NaN;
    await settle(el);
    expect(numbers(el)).to.deep.equal(['1', '2', '3']);
    el.start = Number.POSITIVE_INFINITY;
    await settle(el);
    expect(numbers(el)).to.deep.equal(['1', '2', '3']);
    el.setAttribute('start', '0');
    await settle(el);
    expect(numbers(el)).to.deep.equal(['0', '1', '2']);
  });

  it('renumbers when items are added, removed or reordered, and clears a removed item', async () => {
    const el = await ordered();
    const [first, second, third] = [...el.querySelectorAll<LyraTimelineItem>('lr-timeline-item')];
    el.insertBefore(third!, first!);
    await settle(el);
    expect(numbers(el)).to.deep.equal(['1', '2', '3']);
    expect(third!.shadowRoot!.querySelector('[part="marker-number"]')!.textContent!.trim()).to.equal('1');
    const added = document.createElement('lr-timeline-item') as LyraTimelineItem;
    added.textContent = 'Archive the receipt';
    el.append(added);
    await settle(el);
    expect(numbers(el)).to.deep.equal(['1', '2', '3', '4']);
    second!.remove();
    document.body.append(second!);
    await settle(el);
    await second!.updateComplete;
    expect(numbers(el)).to.deep.equal(['1', '2', '3']);
    expect(second!.shadowRoot!.querySelector('[part="marker-number"]') === null).to.equal(true);
    second!.remove();
  });

  it('restores the dot marker and the unordered base when ordered is turned off', async () => {
    const el = await ordered();
    el.ordered = false;
    await settle(el);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('div');
    expect(numbers(el)).to.deep.equal(['', '', '']);
    const first = el.querySelector<LyraTimelineItem>('lr-timeline-item')!;
    expect(marker(first).getAttribute('aria-hidden')).to.equal('true');
    expect(marker(first).querySelector('slot[name="marker-icon"]') !== null).to.equal(true);
  });

  it('formats the step number for the effective locale', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div lang="ar-u-nu-arab">
        <lr-timeline ordered aria-label="Steps">
          <lr-timeline-item>One</lr-timeline-item>
          <lr-timeline-item>Two</lr-timeline-item>
        </lr-timeline>
      </div>
    `);
    const el = wrapper.querySelector<LyraTimeline>('lr-timeline')!;
    await settle(el);
    expect(numbers(el)).to.deep.equal(['١', '٢']);
  });

  it('paints the ordered marker as a ring around the number, at least as large as the token size', async () => {
    const el = await ordered();
    const first = el.querySelector<LyraTimelineItem>('lr-timeline-item')!;
    const style = getComputedStyle(marker(first));
    expect(parseFloat(style.borderTopWidth)).to.be.above(0);
    expect(style.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    first.style.setProperty('--lr-timeline-marker-size', '40px');
    const rect = marker(first).getBoundingClientRect();
    expect(rect.height).to.be.closeTo(40, 0.5);
    expect(rect.width).to.be.at.least(39.5);
  });
});
