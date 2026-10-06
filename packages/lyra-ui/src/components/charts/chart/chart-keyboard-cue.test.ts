import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './bar-chart.js';
import './box-plot.js';
import type { LyraChart } from './chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

interface ActiveProbe {
  getActiveElements(): { datasetIndex: number; index: number }[];
  tooltip?: { getActiveElements(): { datasetIndex: number; index: number }[] };
}

const runtime = (el: Element): ActiveProbe | undefined =>
  (el as unknown as { chart?: ActiveProbe }).chart;
const active = (el: Element): string =>
  JSON.stringify(runtime(el)!.getActiveElements().map(({ datasetIndex, index }) => [datasetIndex, index]));
const tooltipCount = (el: Element): number => runtime(el)!.tooltip?.getActiveElements().length ?? 0;

describe('keyboard-current datum cue', () => {
  it('highlights the lr-chart datum keyboard navigation reaches and clears it on blur', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <lr-bar-chart without-animation .labels=${['a', 'b', 'c']}
        .datasets=${[{ label: 'S', data: [3, 5, 2] }]}></lr-bar-chart>
      <button>after</button>
    </div>`);
    const el = host.querySelector<LyraChart>('lr-bar-chart')!;
    await waitUntil(() => runtime(el) !== undefined, 'chart did not initialize', { timeout: 5000 });
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    await focusByKeyboard(canvas);
    await waitUntil(() => active(el) === '[[0,0]]', 'focus shows the first datum');
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => active(el) === '[[0,1]]', 'ArrowRight moves the highlight');
    expect(tooltipCount(el)).to.equal(1);
    host.querySelector('button')!.focus();
    await waitUntil(() => active(el) === '[]', 'blur clears the highlight');
    expect(tooltipCount(el)).to.equal(0);
  });

  it('highlights the lr-box-plot box keyboard navigation reaches', async () => {
    const box = (offset: number) => ({ min: offset, q1: offset + 1, median: offset + 2, q3: offset + 3, max: offset + 4 });
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot .labels=${['a', 'b']}
      .datasets=${[{ label: 'A', data: [box(0), box(1)] }]}></lr-box-plot>`);
    await waitUntil(() => runtime(el) !== undefined, 'box plot did not initialize', { timeout: 5000 });
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    await focusByKeyboard(canvas);
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => active(el) === '[[0,1]]', 'ArrowRight highlights the second box');
  });
});
