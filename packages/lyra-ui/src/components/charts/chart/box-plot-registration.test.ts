import { expect, waitUntil } from '@open-wc/testing';
import '../../lr-chart.js';
import type { LyraChart } from './chart.class.js';
import { loadBoxPlotAndRegister, loadBoxPlotPlugin } from './box-plot-loader.js';
import { loadChartJs } from './chart-core-loader.js';

it('retries core and box registration failures and registers once across concurrent consumers', async () => {
  const { Chart } = await import('chart.js');
  const register = Chart.register;
  const warn = console.warn;
  const messages: string[] = [];
  let registrations = 0;
  try {
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    Chart.register = () => { throw new Error('Registration unavailable'); };
    expect(await loadBoxPlotPlugin()).to.equal(null);
    const chart = document.createElement('lr-chart') as LyraChart;
    chart.zoomable = true;
    document.body.append(chart);
    try {
      await waitUntil(() => chart.shadowRoot!.querySelector('[part="error"]') !== null, 'unavailable core did not settle', { timeout: 5000 });
      expect(chart.chart === undefined).to.equal(true);
    } finally { chart.remove(); }
    Chart.register = register;
    expect((await loadChartJs())?.Chart).to.equal(Chart);
    Chart.register = () => { throw new Error('Cannot register the box renderer'); };
    expect(await loadBoxPlotPlugin()).to.equal(null);
    Chart.register = (...items) => { registrations++; register.apply(Chart, items); };
    const [first, second] = await Promise.all([loadBoxPlotPlugin(), loadBoxPlotPlugin()]);
    expect(first !== null && first === second).to.equal(true);
    expect(registrations).to.equal(1);
    const failed = await loadBoxPlotAndRegister(loadChartJs, () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    expect(failed).to.equal(null);
    expect(messages.some(message => message.includes('try again') && message.includes('lr-box-plot'))).to.equal(true);
  } finally {
    Chart.register = register;
    console.warn = warn;
  }
});
