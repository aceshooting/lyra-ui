import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './timeline.js';
import './timeline-item.js';
import type { LyraTimeline } from './timeline.js';

for (const collision of ['overlap', 'stack'] as const) {
  for (const direction of ['ltr', 'rtl']) {
    it(`allocates live horizontal time content height for ${collision} in ${direction}`, async () => {
      const element = await fixture<LyraTimeline>(html`<lr-timeline orientation="horizontal" scale="time" collision=${collision} dir=${direction}
        style="inline-size: 320px; --lr-timeline-time-extent: 320px; --lr-timeline-collision-offset: 32px">
        <lr-timeline-item .timestamp=${new Date('2000-01-01T00:00:00Z')}><div style="block-size: 24px">First</div></lr-timeline-item>
        <lr-timeline-item .timestamp=${new Date('2000-01-01T00:00:00Z')}><div style="block-size: 24px">Second</div></lr-timeline-item>
        <lr-timeline-item .timestamp=${new Date('2000-01-01T00:00:00Z')}><div id="grow" style="block-size: 24px">Third</div></lr-timeline-item>
        <lr-timeline-item .timestamp=${new Date('2100-01-01T00:00:00Z')}><div style="block-size: 24px">Last</div></lr-timeline-item>
      </lr-timeline>`);
      const base = element.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const items = [...element.querySelectorAll<HTMLElement>('lr-timeline-item')];
      const requiredHeight = () => Math.max(...items.filter((item) => item.isConnected).map((item) => item.offsetTop + item.offsetHeight));
      await waitUntil(
        () => base.clientHeight > 0
          && base.clientHeight + 1 >= requiredHeight()
          && (collision === 'stack' ? items[2]!.offsetTop > items[0]!.offsetTop : items[2]!.offsetTop === items[0]!.offsetTop),
        'the timeline never allocated its live content height',
      );
      expect(base.clientHeight).to.be.greaterThan(0);
      expect(base.clientHeight + 1).to.be.at.least(requiredHeight());
      expect(base.getBoundingClientRect().width).to.equal(320);
      expect(getComputedStyle(base).overflowX).to.equal('auto');
      expect(getComputedStyle(base).overflowY).to.equal('hidden');
      if (collision === 'stack') expect(items[2]!.offsetTop).to.be.greaterThan(items[0]!.offsetTop);
      else expect(items[2]!.offsetTop).to.equal(items[0]!.offsetTop);
      const initial = base.clientHeight;
      const growth = element.querySelector<HTMLElement>('#grow')!;
      growth.style.blockSize = '200px';
      await waitUntil(() => base.clientHeight > initial);
      expect(base.clientHeight + 1).to.be.at.least(requiredHeight());
      expect(base.scrollHeight).to.be.at.most(base.clientHeight + 1);
      growth.style.blockSize = '24px';
      await waitUntil(() => Math.abs(base.clientHeight - initial) <= 1);
      if (collision === 'stack') {
        items[2]!.remove();
        await waitUntil(() => base.clientHeight < initial);
        expect(base.clientHeight + 1).to.be.at.least(requiredHeight());
      }
      element.orientation = 'vertical';
      await element.updateComplete;
      await waitUntil(() => base.clientHeight === 320);
      element.orientation = 'horizontal';
      await element.updateComplete;
      await waitUntil(() => base.clientHeight < 320 && base.clientHeight > 0);
      expect(base.clientHeight + 1).to.be.at.least(requiredHeight());
    });
  }
}

it('treats an equal re-created Date range or item timestamp as no change', async () => {
  const el = await fixture<LyraTimeline>(html`<lr-timeline scale="time" .rangeStart=${new Date(0)} .rangeEnd=${new Date(1000)}>
    <lr-timeline-item .timestamp=${new Date(500)}>A</lr-timeline-item>
  </lr-timeline>`);
  const item = el.querySelector('lr-timeline-item')!;
  await item.updateComplete;
  el.rangeStart = new Date(0);
  el.rangeEnd = new Date(1000);
  item.timestamp = new Date(500);
  expect([el.isUpdatePending, item.isUpdatePending]).to.deep.equal([false, false]);
});

it('repairs foreign closed tokens written on a mounted timeline and item', async () => {
  const el = await fixture<LyraTimeline>(html`<lr-timeline scale="flow" collision="overlap"><lr-timeline-item variant="neutral">A</lr-timeline-item></lr-timeline>`);
  const item = el.querySelector('lr-timeline-item')!;
  for (const [name, value] of [['orientation', 'diagonal'], ['scale', 'zoom'], ['collision', 'merge']] as const) el.setAttribute(name, value);
  item.setAttribute('variant', 'bogus');
  await el.updateComplete;
  await item.updateComplete;
  expect(['orientation', 'scale', 'collision'].map((name) => el.getAttribute(name))).to.deep.equal(['vertical', 'flow', 'overlap']);
  expect(item.hasAttribute('variant')).to.equal(false);
});

it('reserves room below a vertical time axis for its latest item', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-timeline scale="time">
      <lr-timeline-item .timestamp=${0}>Start</lr-timeline-item>
      <lr-timeline-item .timestamp=${1000}>Latest event with a description</lr-timeline-item>
    </lr-timeline>
    <p>After</p>
  </div>`);
  const last = wrapper.querySelectorAll('lr-timeline-item')[1]!;
  const after = wrapper.querySelector('p')!;
  await waitUntil(() => last.getBoundingClientRect().bottom <= after.getBoundingClientRect().top + 1, 'the latest item overlaps the following content');
});

it('does not schedule an update for an equal-instant Date assigned to rangeStart', async () => {
  const element = await fixture<LyraTimeline>(html`<lr-timeline scale="time" .rangeStart=${new Date('2000-01-01T00:00:00Z')}></lr-timeline>`);
  element.rangeStart = new Date('2000-01-01T00:00:00Z');
  expect(element.isUpdatePending).to.equal(false);
  element.rangeStart = new Date('2001-01-01T00:00:00Z');
  expect(element.isUpdatePending).to.equal(true);
});
