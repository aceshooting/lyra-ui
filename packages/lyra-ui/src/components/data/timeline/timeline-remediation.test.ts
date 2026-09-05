import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
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
      await aTimeout(100);
      const base = element.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const items = [...element.querySelectorAll<HTMLElement>('lr-timeline-item')];
      const requiredHeight = () => Math.max(...items.filter((item) => item.isConnected).map((item) => item.offsetTop + item.offsetHeight));
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
