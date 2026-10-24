import { expect } from '@open-wc/testing';
import { showChartActiveDatum, type ChartActiveHit } from './chart-active-datum.js';

type Call = readonly [string, unknown?, unknown?];

function renderer(options: { visible?: boolean; points?: readonly { x: number; y: number }[]; failAt?: 'active' | 'tooltip' | 'render' } = {}) {
  const calls: Call[] = [];
  const chart = {
    getDatasetMeta: () => ({ data: options.points ?? [{ x: 4, y: 6 }] }),
    isDatasetVisible: () => options.visible ?? true,
    setActiveElements: (hits: ChartActiveHit[]) => {
      calls.push(['active', hits]);
      if (options.failAt === 'active') throw new Error('plugin failure');
    },
    tooltip: {
      setActiveElements: (hits: ChartActiveHit[], position: { x: number; y: number }) => {
        calls.push(['tooltip', hits, position]);
        if (options.failAt === 'tooltip') throw new Error('plugin failure');
      },
    },
    render: () => {
      calls.push(['render']);
      if (options.failAt === 'render') throw new Error('plugin failure');
    },
  };
  return { chart, calls };
}

describe('chart keyboard active datum', () => {
  it('shows the datum with the renderer hover state and tooltip at its plotted position', () => {
    const { chart, calls } = renderer();
    const hit = { datasetIndex: 0, index: 0 };
    expect(showChartActiveDatum(chart, hit)).to.equal(true);
    expect(calls).to.deep.equal([['active', [hit]], ['tooltip', [hit], { x: 4, y: 6 }], ['render']]);
  });

  it('clears the cue for a missing hit, an unplotted position or a hidden dataset', () => {
    for (const [name, hit, options] of [
      ['no hit', undefined, {}],
      ['negative dataset', { datasetIndex: -1, index: 0 }, {}],
      ['negative index', { datasetIndex: 0, index: -1 }, {}],
      ['position beyond the sample', { datasetIndex: 0, index: 3 }, {}],
      ['hidden dataset', { datasetIndex: 0, index: 0 }, { visible: false }],
      ['non-finite coordinates', { datasetIndex: 0, index: 0 }, { points: [{ x: Number.NaN, y: 1 }] }],
    ] as const) {
      const { chart, calls } = renderer(options);
      expect(showChartActiveDatum(chart, hit), name).to.equal(false);
      expect(calls[0], name).to.deep.equal(['active', []]);
    }
  });

  it('never lets a renderer or plugin failure interrupt keyboard navigation', () => {
    const hit = { datasetIndex: 0, index: 0 };
    for (const failAt of ['active', 'tooltip', 'render'] as const) {
      const { chart } = renderer({ failAt });
      expect(() => showChartActiveDatum(chart, hit), failAt).not.to.throw();
      expect(showChartActiveDatum(chart, hit), failAt).to.equal(true);
    }
  });

  it('tolerates a renderer that lacks the optional hover, tooltip and render capabilities', () => {
    const minimal = { isDatasetVisible: () => true };
    expect(showChartActiveDatum(minimal, { datasetIndex: 0, index: 0 })).to.equal(false);
    expect(showChartActiveDatum(minimal)).to.equal(false);
  });
});
