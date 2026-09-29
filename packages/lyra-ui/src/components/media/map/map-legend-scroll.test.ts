import { expect, fixture, html } from '@open-wc/testing';
import './map.js';
import type { LyraMap } from './map.js';

// Layout coverage complements scripts/map-legend-compositor.mjs's real WebGL page pixels.
// A computed gutter alone cannot detect a hole in the composited map canvas.
for (const direction of ['ltr', 'rtl']) {
  it(`keeps a bounded scrolling legend accessible with a stable gutter in ${direction}`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction}>
        <style>
          lr-map::part(legend) {
            inline-size: 240px;
            max-block-size: 320px;
            inset-inline-start: 12px;
            inset-block-end: 48px;
            scrollbar-width: thin;
          }
        </style>
        <lr-map style="inline-size:320px;block-size:600px"></lr-map>
      </div>
    `);
    const map = wrapper.querySelector<LyraMap>('lr-map')!;
    map.legend = Array.from({ length: 12 }, (_, index) => ({
      color: '#008800', pattern: 'solid', value: String(index),
      label: `Category ${index}`, group: 'Categories',
    }));
    map.legendInteractive = true;
    map.legendCollapsible = true;
    await map.updateComplete;
    const legend = map.shadowRoot!.querySelector<HTMLElement>('[part="legend"]')!;
    const mapBox = map.getBoundingClientRect();
    const legendBox = legend.getBoundingClientRect();
    expect(getComputedStyle(legend).scrollbarGutter).to.equal('stable');
    expect(legendBox.width).to.equal(240);
    expect(legendBox.height).to.equal(320);
    expect(mapBox.bottom - legendBox.bottom).to.equal(48);
    expect(direction === 'ltr' ? legendBox.left - mapBox.left : mapBox.right - legendBox.right).to.equal(12);
    expect(legend.scrollHeight).to.be.greaterThan(legend.clientHeight);
    legend.scrollTop = legend.scrollHeight;
    expect(legend.scrollTop).to.be.greaterThan(0);
    const lastRow = legend.querySelectorAll<HTMLElement>('[part~="legend-toggle"]')[11]!;
    expect(lastRow.getBoundingClientRect().bottom).to.be.at.most(legendBox.bottom);
    map.legendOpen = false;
    await map.updateComplete;
    expect(legend.getBoundingClientRect().height).to.be.lessThan(320);
    expect(legend.scrollTop).to.equal(0);
    map.legendOpen = true;
    await map.updateComplete;
    expect(legend.scrollHeight).to.be.greaterThan(legend.clientHeight);
  });
}
