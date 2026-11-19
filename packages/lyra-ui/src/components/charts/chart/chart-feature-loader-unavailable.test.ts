import { expect } from '@open-wc/testing';
import { loadChartJsWithDataLabelsResult, loadChartJsWithAnnotationResult, loadChartJsWithZoomResult } from './chart-feature-loader.js';

for (const [feature, load] of [
  ['zoom', loadChartJsWithZoomResult], ['data labels', loadChartJsWithDataLabelsResult],
  ['annotations', loadChartJsWithAnnotationResult],
] as const) {
  it(`retries a transient ${feature} failure while keeping the core available`, async () => {
    const warn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    let imports = 0;
    try {
      const first = await load(() => {
        imports++;
        return Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
      });
      expect(first.kind).to.equal('feature-unavailable');
      const second = await load(() => {
        imports++;
        return Promise.resolve({ id: 'retry-plugin' });
      });
      expect(second.kind).to.equal('available');
      expect(first.kind !== 'core-unavailable' && second.kind !== 'core-unavailable' && first.mod === second.mod).to.equal(true);
      expect(imports).to.equal(2);
      expect(warnings.flat().map(String).join(' ')).to.contain('chartjs-plugin-');
      expect(warnings.flat().map(String).join(' ')).not.to.contain('pnpm add');
    } finally {
      console.warn = warn;
    }
  });
}
