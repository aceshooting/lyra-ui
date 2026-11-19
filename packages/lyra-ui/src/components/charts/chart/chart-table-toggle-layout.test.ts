import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './box-plot.js';
import './chart.js';
import './lite-chart.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';

const rect = (el: Element, part: string): DOMRect =>
  el.shadowRoot!.querySelector(`[part="${part}"]`)!.getBoundingClientRect();

describe('data-table toggle placement', () => {
  it('lr-box-plot keeps the toggle above its expanded table, below legend and notice', async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot with-legend data-table-toggle
      .labels=${Array.from({ length: 1_200 }, (_, index) => `c${index}`)}
      .datasets=${[{ label: 'A', data: Array.from({ length: 1_200 }, () => ({ ...box })) }]}></lr-box-plot>`);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="data-table-toggle"]') !== null, 'toggle');
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="data-table-toggle"]')!;
    toggle.click();
    await el.updateComplete;
    expect(getComputedStyle(toggle).gridRowStart).to.equal('table-toggle');
    expect(rect(el, 'data-table-toggle').bottom).to.be.at.most(rect(el, 'data-table').top + 1);
    expect(rect(el, 'data-table-toggle').top).to.be.at.least(rect(el, 'legend').bottom - 1);
  });

  it('lr-lite-chart keeps the toggle between its legend and its table', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart with-legend data-table-toggle
      .labels=${['a', 'b']} .datasets=${[{ label: 'A', data: [1, 2] }, { label: 'B', data: [3, 4] }]}>
      </lr-lite-chart>`);
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="data-table-toggle"]')!;
    toggle.click();
    await el.updateComplete;
    expect(getComputedStyle(toggle).gridRowStart).to.equal('table-toggle');
    expect(rect(el, 'data-table-toggle').top).to.be.at.least(rect(el, 'legend').bottom - 1);
    expect(rect(el, 'data-table-toggle').bottom).to.be.at.most(rect(el, 'data-table').top + 1);
  });

  it('lr-lite-chart without a toggle keeps its rows unchanged', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart with-legend
      .labels=${['a']} .datasets=${[{ label: 'A', data: [1] }]}></lr-lite-chart>`);
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(getComputedStyle(base).gridTemplateAreas).to.not.contain('table-toggle');
  });

  for (const tag of ['lr-box-plot', 'lr-lite-chart'] as const) {
    it(`${tag} toggle hover falls back to the shared chart toggle token`, async () => {
      const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
      const host = await fixture<HTMLElement>(html`<div style="--lr-chart-data-table-toggle-hover-bg: rgb(1, 2, 3)">
        ${tag === 'lr-box-plot'
          ? html`<lr-box-plot data-table-toggle .labels=${['a']} .datasets=${[{ label: 'A', data: [box] }]}></lr-box-plot>`
          : html`<lr-lite-chart data-table-toggle .labels=${['a']} .datasets=${[{ label: 'A', data: [1] }]}></lr-lite-chart>`}
      </div>`);
      const el = host.querySelector(tag) as HTMLElement & { updateComplete: Promise<boolean> };
      await waitUntil(() => el.shadowRoot!.querySelector('[part="data-table-toggle"]') !== null, 'toggle');
      const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="data-table-toggle"]')!;
      try {
        await hoverUntilMatched(toggle, `hover the ${tag} toggle`);
        await waitUntil(() => getComputedStyle(toggle).backgroundColor === 'rgb(1, 2, 3)', 'shared hover token');
      } finally {
        await resetMouse();
      }
    });
  }
});

describe('data-table toggle theming hooks', () => {
  type ToggleTag = 'lr-chart' | 'lr-lite-chart' | 'lr-box-plot';
  const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
  const chart = (tag: ToggleTag) => tag === 'lr-box-plot'
    ? html`<lr-box-plot data-table-toggle .labels=${['a']} .datasets=${[{ label: 'A', data: [box] }]}></lr-box-plot>`
    : tag === 'lr-chart'
      ? html`<lr-chart data-table-toggle .labels=${['a']} .datasets=${[{ label: 'A', data: [1] }]}></lr-chart>`
      : html`<lr-lite-chart data-table-toggle .labels=${['a']} .datasets=${[{ label: 'A', data: [1] }]}></lr-lite-chart>`;

  async function mount(tag: ToggleTag, style = '') {
    const host = await fixture<HTMLElement>(html`<div style=${style}>
      <span data-probe style="border: 1px solid var(--lr-color-border); background: var(--lr-color-surface); color: var(--lr-color-text)"></span>
      ${chart(tag)}
    </div>`);
    const el = host.querySelector(tag) as HTMLElement;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="data-table-toggle"]') !== null, 'toggle');
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="data-table-toggle"]')!;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const baseStyle = getComputedStyle(base);
    const start = base.getBoundingClientRect().left + parseFloat(baseStyle.borderLeftWidth) + parseFloat(baseStyle.paddingLeft);
    const end = base.getBoundingClientRect().right - parseFloat(baseStyle.borderRightWidth) - parseFloat(baseStyle.paddingRight);
    return { toggle: getComputedStyle(toggle), rect: toggle.getBoundingClientRect(), probe: getComputedStyle(host.querySelector('[data-probe]')!), start, end };
  }
  const paint = (style: CSSStyleDeclaration) => [style.borderTopColor, style.backgroundColor, style.color];

  for (const tag of ['lr-chart', 'lr-lite-chart', 'lr-box-plot'] as const) {
    it(`${tag} keeps its full-width framed toggle when the hooks are unset`, async () => {
      const { toggle, rect, probe, start, end } = await mount(tag);
      expect(paint(toggle)).to.deep.equal(paint(probe));
      expect(toggle.justifySelf).to.equal('auto');
      expect(Math.abs(rect.left - start), 'starts at the chart edge').to.be.below(1);
      expect(Math.abs(rect.right - end), 'ends at the chart edge').to.be.below(1);
    });

    it(`${tag} restyles its resting toggle through the shared chart toggle tokens`, async () => {
      const { toggle, rect, end } = await mount(tag, [
        '--lr-chart-data-table-toggle-border-color: rgb(1, 2, 3)',
        '--lr-chart-data-table-toggle-bg: rgb(4, 5, 6)',
        '--lr-chart-data-table-toggle-color: rgb(7, 8, 9)',
        '--lr-chart-data-table-toggle-justify: end',
        '--lr-chart-data-table-toggle-inline-size: 10rem',
      ].join(';'));
      expect(paint(toggle)).to.deep.equal(['rgb(1, 2, 3)', 'rgb(4, 5, 6)', 'rgb(7, 8, 9)']);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      expect(Math.abs(rect.width - 10 * rem), 'inline size').to.be.below(1);
      expect(Math.abs(rect.right - end), 'justified to the end').to.be.below(1);
    });
  }

  for (const tag of ['lr-lite-chart', 'lr-box-plot'] as const) {
    it(`${tag} lets its own toggle tokens win over the shared ones`, async () => {
      const own = tag.slice(3);
      const { rect, toggle, start } = await mount(tag, [
        '--lr-chart-data-table-toggle-border-color: rgb(1, 2, 3)',
        '--lr-chart-data-table-toggle-bg: rgb(4, 5, 6)',
        '--lr-chart-data-table-toggle-color: rgb(7, 8, 9)',
        '--lr-chart-data-table-toggle-justify: end',
        '--lr-chart-data-table-toggle-inline-size: 10rem',
        `--lr-${own}-data-table-toggle-border-color: rgb(11, 12, 13)`,
        `--lr-${own}-data-table-toggle-bg: rgb(14, 15, 16)`,
        `--lr-${own}-data-table-toggle-color: rgb(17, 18, 19)`,
        `--lr-${own}-data-table-toggle-justify: start`,
        `--lr-${own}-data-table-toggle-inline-size: 6rem`,
      ].join(';'));
      expect(paint(toggle)).to.deep.equal(['rgb(11, 12, 13)', 'rgb(14, 15, 16)', 'rgb(17, 18, 19)']);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      expect(Math.abs(rect.width - 6 * rem), 'inline size').to.be.below(1);
      expect(Math.abs(rect.left - start), 'justified to the start').to.be.below(1);
    });
  }
});
