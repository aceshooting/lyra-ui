import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHistogramDistribution } from '../../../utilities/data-preparation.js';
import type { LyraHistogram } from './histogram.class.js';
import './histogram.js';

const distribution: LyraHistogramDistribution = {
  revision: 'original', counts: { sourceCount: 5, validCount: 5, invalidCount: 0 },
  domain: { min: 0, max: 10 }, edges: [0, 5, 10], binCounts: [2, 3], belowCount: 0, aboveCount: 0,
};

describe('histogram derived input ownership', () => {
  for (const prepared of [false, true]) {
    it(`ignores inherited chart inputs before and after mounting with ${prepared ? 'prepared' : 'raw'} data`, async () => {
      const element = document.createElement('lr-histogram') as LyraHistogram;
      element.withoutAnimation = true;
      element.withDataTable = true;
      element.bins = 2;
      element.values = [0, 0, 10];
      element.distribution = prepared ? distribution : null;
      const unrelated = [{ label: 'Injected series', data: [999, 999] }];
      element.labels = ['Injected bucket', 'Other bucket'];
      element.datasets = unrelated;
      Reflect.set(element, 'type', 'line');
      const wrapper = await fixture<HTMLDivElement>(html`<div style="width:600px"></div>`);
      wrapper.append(element);
      await waitUntil(() => element.chart !== undefined);
      expect(element.chart!.config.type).to.equal('bar');
      expect(element.chart!.data.datasets.map(series => series.data)).to.deep.equal([prepared ? [2, 3] : [2, 1]]);
      const originalCsv = element.exportData('csv');
      expect(originalCsv).not.to.include('Injected');
      element.labels = ['Replacement bucket'];
      element.datasets = [{ label: 'Replacement series', data: [777] }];
      Reflect.set(element, 'type', 'pie');
      element.requestUpdate();
      await element.updateComplete;
      expect(element.exportData('csv')).to.equal(originalCsv);
      expect(element.type).to.equal('bar');
      expect(element.chart!.config.type).to.equal('bar');
      expect(unrelated).to.deep.equal([{ label: 'Injected series', data: [999, 999] }]);
      if (prepared) element.distribution = { ...distribution, revision: 'next', binCounts: [3, 2] };
      else element.values = [0, 10, 10];
      await element.updateComplete;
      expect(element.chart!.data.datasets.map(series => series.data)).to.deep.equal([prepared ? [3, 2] : [1, 2]]);
      expect(element.exportData('csv')).not.to.equal(originalCsv);
      expect(element.shadowRoot!.textContent).not.to.include('Replacement');
    });
  }
});
