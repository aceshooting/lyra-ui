import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import type { LyraVirtualList } from './virtual-list.class.js';
import './virtual-list.js';

for (const rowHeight of ['40', 'auto']) {
  it(`keeps a newer programmatic jump when an earlier native scroll frame runs (${rowHeight} rows)`, async () => {
    const el = await fixture<LyraVirtualList>(html`<lr-virtual-list
      style="--lr-virtual-list-height:200px" row-height=${rowHeight} overscan="0"
      .items=${Array.from({ length: 500 }, (_, index) => index)}
      .keyFunction=${(value: unknown) => Number(value)}
      .renderItem=${(value: unknown) => html`<div style="height:40px">Row ${value}</div>`}
    ></lr-virtual-list>`);
    await nextFrame();
    await el.updateComplete;
    const base = el.scrollContainer!;
    const reports: number[] = [];
    el.addEventListener('lr-virtual-scroll', event => reports.push(event.detail.scrollTop));
    // Schedule the jump before the old scroll event's coalescing callback, in the same frame.
    const jump = requestAnimationFrame(() => el.scrollToIndex(100, { align: 'start', behavior: 'auto' }));
    try {
      base.scrollTop = el.offsetForIndex(300);
      base.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await el.updateComplete;
      const rows = Array.from(el.shadowRoot!.querySelectorAll('[part="row"]'), row => Number(row.getAttribute('data-row-index')));
      expect(rows).to.include(100);
      expect(rows).not.to.include(300);
      expect(base.scrollTop).to.be.closeTo(el.offsetForIndex(100), 1);
      expect(reports.every(top => Math.abs(top - base.scrollTop) <= 1)).to.equal(true);
    } finally {
      cancelAnimationFrame(jump);
    }
  });
}
