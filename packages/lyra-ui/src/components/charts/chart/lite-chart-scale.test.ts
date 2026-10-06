import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.class.js';

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
