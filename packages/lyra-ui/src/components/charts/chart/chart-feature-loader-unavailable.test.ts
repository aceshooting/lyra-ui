import { expect } from '@open-wc/testing';
import { loadChartJsWithDataLabels, loadChartJsWithDataLabelsResult } from './chart-feature-loader.js';

// The data-labels load is memoized page-wide, so this file owns the first (failing) request.
describe('memoized data-labels compatibility adapter', () => {
  it('keeps the usable Chart.js module and reports no plugin when the data-labels peer fails', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    let imports = 0;
    try {
      const loaded = await loadChartJsWithDataLabels(() => {
        imports += 1;
        return Promise.reject(new Error('data-labels peer missing'));
      });
      expect(loaded === null).to.equal(false);
      expect(typeof loaded!.mod.Chart).to.equal('function');
      expect(loaded!.plugin).to.equal(undefined);
      const tagged = await loadChartJsWithDataLabelsResult();
      expect(tagged.kind).to.equal('feature-unavailable');
      expect(tagged.kind !== 'core-unavailable' && tagged.mod === loaded!.mod).to.equal(true);
      expect(imports).to.equal(1);
      expect(warnings.some((args) => args.some((arg) => String(arg).includes('chartjs-plugin-datalabels')))).to.equal(true);
    } finally {
      console.warn = originalWarn;
    }
  });
});
