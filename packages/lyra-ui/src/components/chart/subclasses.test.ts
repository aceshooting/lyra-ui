import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './bar-chart.js';
import './line-chart.js';
import './pie-chart.js';
import './doughnut-chart.js';
import './scatter-chart.js';
import './bubble-chart.js';
import './radar-chart.js';
import './polar-area-chart.js';

const TAGS_WITH_TYPE: [string, string][] = [
  ['lyra-bar-chart', 'bar'],
  ['lyra-line-chart', 'line'],
  ['lyra-pie-chart', 'pie'],
  ['lyra-doughnut-chart', 'doughnut'],
  ['lyra-scatter-chart', 'scatter'],
  ['lyra-bubble-chart', 'bubble'],
  ['lyra-radar-chart', 'radar'],
  ['lyra-polar-area-chart', 'polarArea'],
];

for (const [tag, expectedType] of TAGS_WITH_TYPE) {
  it(`${tag} hardcodes its Chart.js type to "${expectedType}"`, async () => {
    const el = (await fixture(`<${tag}></${tag}>`)) as any;
    el.datasets = [{ label: 'x', data: [1, 2, 3] }];
    await el.updateComplete;
    await waitUntil(() => el.chart != null, `${tag} never initialized`, { timeout: 2000 });
    expect(el.chart.config.type).to.equal(expectedType);
  });
}
