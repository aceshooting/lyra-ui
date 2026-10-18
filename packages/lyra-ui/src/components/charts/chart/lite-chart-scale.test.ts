import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-lite-chart', 'labels'));
expectDevWarning('lr-chart-series-cap');

const labelsOf = (length: number): string[] => Array.from({ length }, (_, index) => `t${index}`);

async function mount(template: ReturnType<typeof html>): Promise<LyraLiteChart> {
  const el = await fixture<LyraLiteChart>(template);
  await waitUntil(() => {
    const chart = el as unknown as { plotWidth: number; plotHeight: number };
    return chart.plotWidth > 0 && chart.plotHeight > 0;
  });
  await el.updateComplete;
  return el;
}

/** Counts `Number.isFinite` calls -- the unit of work of the chart's per-value numeric guards. */
async function countFiniteChecks(body: () => Promise<void>): Promise<number> {
  const original = Number.isFinite;
  let count = 0;
  Number.isFinite = ((value: unknown) => {
    count += 1;
    return original(value);
  }) as typeof Number.isFinite;
  try {
    await body();
  } finally {
    Number.isFinite = original;
  }
  return count;
}

describe('lr-lite-chart logarithmic scale', () => {
  it('hands a custom tick formatter sub-decade log ticks without float noise', async () => {
    const seen: number[] = [];
    await mount(html`<lr-lite-chart type="line" scale="logarithmic" without-zero-baseline
      .labels=${['a', 'b', 'c', 'd']}
      .datasets=${[{ label: 'S', data: [0.25, 0.45, 0.7, 0.95] }]}
      .tickFormat=${(value: number) => {
        seen.push(value);
        return `${value} ms`;
      }}></lr-lite-chart>`);
    expect(seen.length).to.be.greaterThan(2);
    expect(seen.filter((value) => String(value).length > 8).map(String)).to.deep.equal([]);
  });

  it('finds the logarithmic floor once per data set, not once per plotted value', async () => {
    const data = Array.from({ length: 2_000 }, (_, index) => (index % 97) + 1);
    const el = await mount(html`<lr-lite-chart type="line" scale="logarithmic"
      .labels=${labelsOf(2_000)} .datasets=${[{ label: 'S', data }]}></lr-lite-chart>`);
    const checks = await countFiniteChecks(async () => {
      el.requestUpdate();
      await el.updateComplete;
    });
    expect(checks).to.be.lessThan(400_000);
  });

  it('builds its mark model once per data set, not per render or arrow key', async () => {
    const data = Array.from({ length: 1_000 }, (_, index) => (index % 50) + 1);
    const el = await mount(html`<lr-lite-chart type="line"
      .labels=${labelsOf(1_000)} .datasets=${[{ label: 'S', data }]}></lr-lite-chart>`);
    const marks = () => (el as unknown as { interactiveMarks(): unknown[] }).interactiveMarks();
    const first = marks();
    el.requestUpdate();
    await el.updateComplete;
    expect(marks() === first).to.equal(true);
    el.datasets = [{ label: 'S', data: data.slice(0, 10) }];
    expect(marks() === first).to.equal(false);
  });
});


it('moves the roving mark without reevaluating the 100000-point chart', async () => {
  const datasets = [{ label: 'S', data: Array.from({ length: 100_000 }, (_, i) => i + 1) }];
  const el = await mount(html`<lr-lite-chart .labels=${labelsOf(100_000)} .datasets=${datasets}></lr-lite-chart>`);
  expect(el.labels.length).to.equal(10_000);
  expect(el.datasets[0]!.data.length).to.equal(10_000);
  const seam = el as unknown as { renderChart(): unknown; onMarkFocus(index: number): void };
  const original = seam.renderChart;
  let renders = 0;
  seam.renderChart = function () { renders++; return original.call(this); };
  try {
    seam.onMarkFocus(1);
    await el.updateComplete;
    expect(renders).to.equal(0);
    recordScaleMeasurement('lr-lite-chart', '100000 points focus move', { renders });
    expect(el.shadowRoot!.querySelector('[data-mark-index="0"]')!.getAttribute('tabindex')).to.equal('-1');
    expect(el.shadowRoot!.querySelector('[data-mark-index="1"]')!.getAttribute('tabindex')).to.equal('0');
  } finally { seam.renderChart = original; }
});

it('does not retain the caller dataset array after snapshotting it', async () => {
  const datasets = [{ label: 'S', data: [1, 2] }];
  const el = await mount(html`<lr-lite-chart .labels=${['a', 'b']} .datasets=${datasets}></lr-lite-chart>`);
  expect(Object.values(el).filter((value) => value === datasets).length).to.equal(0);
});

it('bounds sampled records and scroll width while retaining an interior extremum', async () => {
  const data = Array.from({ length: 10_000 }, () => 1);
  data[4321] = 9999;
  const el = await mount(html`<lr-lite-chart layout="scroll" max-records="20"
    .labels=${labelsOf(data.length)} .datasets=${[{ label: 'S', data }]}></lr-lite-chart>`);
  const marks = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(marks.length).to.be.at.most(20);
  expect(Array.from(marks, mark => Number(mark.getAttribute('data-index')))).to.include(4321);
  expect(el.shadowRoot!.querySelector('svg')!.getBoundingClientRect().width).to.be.lessThan(1000);
});


it('keeps the default record ceiling when maxRecords is unset or invalid', async () => {
  const data = Array.from({ length: 20 }, (_, index) => index + 1);
  const el = await mount(html`<lr-lite-chart layout="scroll" .labels=${labelsOf(20)}
    .datasets=${[{label:'S',data}]}></lr-lite-chart>`);
  expect(el.maxRecords).to.equal(1000);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(20);
  el.maxRecords = 4; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.be.at.most(4);
  el.maxRecords = Number.NaN; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(20);
  el.setAttribute('max-records', '4'); await el.updateComplete;
  el.removeAttribute('max-records'); await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(20);
});
