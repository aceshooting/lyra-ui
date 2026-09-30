import { expect, fixture, html } from '@open-wc/testing';
import { toRgba } from '../../../../test/color-contrast.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './map.js';
import type { LyraMap } from './map.js';

// Layout coverage complements scripts/map-legend-compositor.mjs's real WebGL page pixels.
// A computed gutter alone cannot detect a hole in the composited map canvas.
for (const direction of ['ltr', 'rtl']) for (const surface of ['glass', 'solid']) {
  it(`keeps a bounded scrolling legend accessible with a stable gutter in ${surface}/${direction}`, async () => {
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
        <lr-map data-lr-surface=${surface} style="inline-size:320px;block-size:600px"></lr-map>
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
    const disclosure = legend.querySelector<HTMLButtonElement>('[part="legend-disclosure"]')!;
    await focusByKeyboard(disclosure);
    expect(legend.scrollHeight).to.be.greaterThan(legend.clientHeight);
    legend.scrollTop = legend.scrollHeight;
    expect(legend.scrollTop).to.be.greaterThan(0);
    const lastRow = legend.querySelectorAll<HTMLElement>('[part~="legend-toggle"]')[11]!;
    expect(lastRow.getBoundingClientRect().bottom).to.be.at.most(legendBox.bottom);
    map.legendOpen = false;
    await map.updateComplete;
    expect(legend.getBoundingClientRect().height).to.be.lessThan(320);
    expect(legend.scrollTop).to.equal(0);
    expect(legend.scrollHeight).to.be.at.most(legend.clientHeight);
    const collapsedBox = legend.getBoundingClientRect();
    const disclosureBox = disclosure.getBoundingClientRect();
    expect(disclosureBox.top).to.be.at.least(collapsedBox.top);
    expect(disclosureBox.bottom).to.be.at.most(collapsedBox.bottom);
    expect(map.shadowRoot!.activeElement === disclosure).to.equal(true);
    const hasGlass = surface === 'glass' && CSS.supports('backdrop-filter', 'blur(1px)');
    expect(toRgba(getComputedStyle(legend).backgroundColor)[3]).to.equal(hasGlass ? 179 : 255);
    const layer = legend.querySelector<HTMLElement>('.glass-scroll-layer')!;
    if (hasGlass) expect(getComputedStyle(layer, '::before').backdropFilter).to.include('blur(');
    map.legendOpen = true;
    await map.updateComplete;
    expect(legend.scrollHeight).to.be.greaterThan(legend.clientHeight);
    legend.scrollTop = legend.scrollHeight;
    const expandedScrollTop = legend.scrollTop;
    expect(expandedScrollTop).to.be.greaterThan(0);
    map.legend = [...map.legend];
    await map.updateComplete;
    expect(legend.scrollTop).to.equal(expandedScrollTop);
    map.legendOpen = false;
    await map.updateComplete;
    expect(legend.scrollTop).to.equal(0);
    expect(legend.scrollHeight).to.be.at.most(legend.clientHeight);
  });
}
