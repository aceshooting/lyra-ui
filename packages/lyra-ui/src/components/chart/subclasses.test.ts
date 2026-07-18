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
  ['lr-bar-chart', 'bar'],
  ['lr-line-chart', 'line'],
  ['lr-pie-chart', 'pie'],
  ['lr-doughnut-chart', 'doughnut'],
  ['lr-scatter-chart', 'scatter'],
  ['lr-bubble-chart', 'bubble'],
  ['lr-radar-chart', 'radar'],
  ['lr-polar-area-chart', 'polarArea'],
];

for (const [tag, expectedType] of TAGS_WITH_TYPE) {
  it(`${tag} hardcodes its Chart.js type to "${expectedType}"`, async () => {
    const el = (await fixture(`<${tag}></${tag}>`)) as any;
    el.datasets = [{ label: 'x', data: [1, 2, 3] }];
    await el.updateComplete;
    await waitUntil(() => el.chart != null, `${tag} never initialized`, { timeout: 2000 });
    expect(el.chart.config.type).to.equal(expectedType);
  });

  it(`${tag} locks .type — assigning a different value at runtime is a no-op`, async () => {
    const el = (await fixture(`<${tag}></${tag}>`)) as any;
    el.type = 'somethingElse';
    expect(el.type).to.equal(expectedType);
  });

  it(`${tag} is accessible`, async () => {
    const el = (await fixture(`<${tag}></${tag}>`)) as any;
    el.setAttribute('aria-label', `${tag} accessible name`);
    el.datasets = [{ label: 'x', data: [1, 2, 3] }];
    await el.updateComplete;
    await waitUntil(() => el.chart != null, `${tag} never initialized`, { timeout: 2000 });
    const canvas = el.shadowRoot.querySelector('canvas');
    expect(canvas.getAttribute('aria-label')).to.equal(`${tag} accessible name`);
    expect(canvas.getAttribute('role')).to.equal('img');
    expect(el.getAttribute('role')).to.equal(null);
    expect(el.shadowRoot.querySelectorAll('[role]')).to.have.length(1);
    await expect(el).to.be.accessible();
  });
}
