import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import './box-plot.js';
import type { LyraChart } from './chart.js';
import type { LyraBoxPlot } from './box-plot.js';
import { preloadCharts } from './chart-preload.js';

/** The part of the live Chart.js instance this test reads; Chart.js documents it. */
interface PluginAwareChart {
  readonly options: { plugins?: { annotation?: unknown } };
  isPluginEnabled(pluginId: string): boolean;
}

// The annotation plugin registers globally once per page, so this file owns its page: the late
// registration below is the first and only one.
it('lets a box plot that has not drawn yet ignore a late annotation registration and draw afterwards', async () => {
  // Settle the core/controller registrations before registering annotations against the unseen box.
  expect(await preloadCharts({ boxPlot: true })).to.deep.equal({ core: true, boxPlot: true });
  const row = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 480px">
      <lr-box-plot
        style="position: fixed; inset-block-start: 0; inset-inline-start: -6000px; inline-size: 240px; block-size: 160px"
        .labels=${['North']}
        .datasets=${[{ label: 'Latency', data: [[1, 2, 3, 4, 5]] }]}
      ></lr-box-plot>
      <lr-chart type="bar" style="inline-size: 240px; block-size: 160px"></lr-chart>
    </div>
  `);
  const box = row.querySelector<LyraBoxPlot>('lr-box-plot')!;
  const annotated = row.querySelector<LyraChart>('lr-chart')!;
  await box.updateComplete;
  expect(box.exportData('png'), 'an offscreen box plot has not painted').to.equal('');

  annotated.labels = ['A', 'B'];
  annotated.datasets = [{ label: 'Annotated', data: [1, 2] }];
  annotated.annotations = [{ value: 1, label: 'SLO' }];
  await waitUntil(
    () => {
      const chart = annotated.chart as unknown as PluginAwareChart | undefined;
      return chart?.options.plugins?.annotation !== undefined && (annotated.chartArea?.width ?? 0) > 0;
    },
    'the annotation options never reached the drawn chart',
    { timeout: 5000 },
  );
  // Chart.js invalidates its plugin cache during global registration; query it after this host
  // has rebuilt with the annotation options, rather than while registration is still in flight.
  expect((annotated.chart as unknown as PluginAwareChart).isPluginEnabled('annotation')).to.equal(true);
  expect(box.exportData('png'), 'registration alone does not paint a box plot that was never shown').to.equal('');

  box.style.insetInlineStart = '0';
  await waitUntil(() => box.exportData('png') !== '', 'the box plot did not draw once shown', { timeout: 5000 });
});
