import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import './box-plot.js';
import type { LyraChart } from './chart.js';
import type { LyraBoxPlot } from './box-plot.js';

type ChartInstance = { update(): void };
const instanceOf = (el: HTMLElement): ChartInstance | undefined =>
  (el as unknown as { chart?: ChartInstance }).chart;

// `chartjs-plugin-annotation` creates its per-chart state only in `beforeInit`, so a chart built
// before the plugin registered globally has none, and the plugin then throws inside the next
// `update()` of that chart ("reading 'visibleElements'", "setting 'annotations'"). This file runs
// in its own page so the module-level registration is observed exactly once, late.
it('rebuilds Chart.js hosts that were built before the annotation plugin registered globally', async () => {
  // One row keeps all three hosts inside the viewport: an offscreen chart defers its draw.
  const row = await fixture(html`
    <div style="display: flex; gap: 8px; inline-size: 720px; block-size: 160px;">
      <lr-chart type="bar" style="inline-size: 220px; block-size: 150px;"></lr-chart>
      <lr-box-plot
        style="inline-size: 220px; block-size: 150px;"
        .labels=${['North']}
        .datasets=${[{ label: 'Latency', data: [[1, 2, 3, 4, 5]] }]}
      ></lr-box-plot>
      <lr-chart type="bar" style="inline-size: 220px; block-size: 150px;"></lr-chart>
    </div>
  `);
  const [plain, annotated] = [...row.querySelectorAll<LyraChart>('lr-chart')] as [LyraChart, LyraChart];
  const box = row.querySelector<LyraBoxPlot>('lr-box-plot')!;
  plain.labels = ['A', 'B'];
  plain.datasets = [{ label: 'Plain', data: [1, 2] }];
  await waitUntil(() => instanceOf(plain) != null, 'plain chart never built', { timeout: 5000 });
  await waitUntil(() => instanceOf(box) != null, 'box plot never built', { timeout: 5000 });
  const plainBefore = instanceOf(plain)!;
  const boxBefore = instanceOf(box)!;

  annotated.labels = ['A', 'B'];
  annotated.datasets = [{ label: 'Annotated', data: [1, 2] }];
  annotated.annotations = [{ value: 1, label: 'SLO' }];
  await waitUntil(
    () => (annotated as unknown as { annotationFeatureState: string }).annotationFeatureState === 'available',
    'the annotation plugin never registered',
    { timeout: 5000 },
  );

  await waitUntil(
    () => instanceOf(plain) != null && instanceOf(plain) !== plainBefore,
    'the plain chart was not rebuilt after the annotation plugin registered',
    { timeout: 5000 },
  );
  await waitUntil(
    () => instanceOf(box) != null && instanceOf(box) !== boxBefore,
    'the box plot was not rebuilt after the annotation plugin registered',
    { timeout: 5000 },
  );
  // The requesting chart rebuilds itself through its own feature path once the plugin resolves.
  await waitUntil(() => instanceOf(annotated) != null, 'the annotated chart never rebuilt', {
    timeout: 5000,
  });
  expect(() => instanceOf(plain)!.update()).not.to.throw();
  expect(() => instanceOf(box)!.update()).not.to.throw();
  expect(() => instanceOf(annotated)!.update()).not.to.throw();
});
