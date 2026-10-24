import { expect, waitUntil } from '@open-wc/testing';
import './chart.js';
import type { LyraChart } from './chart.class.js';

/** The part of the live Chart.js instance these assertions read; Chart.js documents it. */
interface PluginAwareChart {
  isPluginEnabled(pluginId: string): boolean;
}

/**
 * Connects a chart and configures it in the same task, so the assignment lands before the optional
 * Chart.js peer has finished loading.
 */
function connectThenConfigure(configure: (chart: LyraChart) => void): LyraChart {
  const chart = document.createElement('lr-chart') as LyraChart;
  chart.style.cssText = 'display:block;inline-size:320px;block-size:200px';
  chart.labels = ['A', 'B'];
  chart.datasets = [{ label: 'Load', data: [1, 2] }];
  document.body.append(chart);
  configure(chart);
  return chart;
}

function pluginEnabled(chart: LyraChart, pluginId: string): boolean {
  return (chart.chart as unknown as PluginAwareChart | undefined)?.isPluginEnabled(pluginId) === true;
}

describe('lr-chart opt-in features assigned while its chart library is still loading', () => {
  const cases = [
    ['annotations', 'annotation', (chart: LyraChart) => { chart.annotations = [{ axis: 'y', value: 1.5, label: 'Target' }]; }],
    ['zoomable', 'zoom', (chart: LyraChart) => { chart.zoomable = true; }],
    ['dataLabels', 'datalabels', (chart: LyraChart) => { chart.dataLabels = true; }],
  ] as const;

  for (const [property, plugin, configure] of cases) {
    it(`attaches the ${plugin} plugin when ${property} is assigned in the task that connects the chart`, async () => {
      const chart = connectThenConfigure(configure);
      try {
        await waitUntil(() => pluginEnabled(chart, plugin), `the ${plugin} plugin never attached to the live chart`, { timeout: 5000 });
        expect(chart.getAttribute('aria-busy')).to.equal('false');
      } finally {
        chart.remove();
      }
    });
  }
});
