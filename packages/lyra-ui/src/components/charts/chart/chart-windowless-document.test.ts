import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { Chart } from 'chart.js';
import type { LyraChart } from './chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import './chart.js';
import './box-plot.js';
import './lite-chart.js';

for (const tag of ['lr-chart', 'lr-box-plot', 'lr-lite-chart'] as const) for (const initiallyWindowless of [false, true]) {
  it(`${tag} preserves data when ${initiallyWindowless ? 'first connected' : 'adopted'} into a windowless document and renders after returning`, async () => {
    const mount = await fixture<HTMLDivElement>(html`<div></div>`);
    const element = document.createElement(tag) as LyraChart | LyraBoxPlot | LyraLiteChart;
    element.style.cssText = 'inline-size:500px;block-size:280px';
    element.withDataTable = true;
    const setData = (label: string, value: number): void => {
      element.labels = [label];
      if (tag === 'lr-box-plot') {
        (element as LyraBoxPlot).datasets = [{ label: 'Retained series', data: [
          { min: value, q1: value + 1, median: value + 2, q3: value + 3, max: value + 4 },
        ] }];
      } else {
        (element as LyraChart | LyraLiteChart).datasets = [{ label: 'Retained series', data: [value] }];
      }
    };
    const rendered = (): boolean => {
      if (tag === 'lr-lite-chart') {
        const mark = element.shadowRoot?.querySelector('[part="bar"]');
        return !!mark && mark.getBoundingClientRect().height > 0;
      }
      const canvas = element.shadowRoot?.querySelector('canvas');
      const chart = canvas ? Chart.getChart(canvas) : undefined;
      return !!chart && chart.width > 0 && chart.height > 0;
    };
    try {
      setData('North', 10);
      const windowless = document.implementation.createHTMLDocument('Detached data editor');
      if (!initiallyWindowless) {
        mount.append(element);
        await waitUntil(rendered, 'initial chart did not render', { timeout: 5_000 });
      }
      windowless.body.append(windowless.adoptNode(element));
      await element.updateComplete;
      await waitUntil(() => element.getAttribute('aria-busy') !== 'true', 'data preparation did not settle', { timeout: 5_000 });
      expect(element.isConnected).to.equal(true);
      expect(element.ownerDocument.defaultView).to.equal(null);
      setData('South', 20);
      await element.updateComplete;
      expect(element.exportData('csv')).to.include('South');
      expect(element.exportData('csv')).not.to.include('North');
      expect(element.exportData('csv')).to.include('20');
      if (tag !== 'lr-lite-chart') {
        const canvas = element.shadowRoot!.querySelector('canvas')!;
        expect(Chart.getChart(canvas) === undefined, 'a windowless owner cannot construct a browser chart').to.equal(true);
      }
      expect(element.shadowRoot!.querySelector('[part="data-table"]')?.textContent).to.include('South');
      mount.append(document.adoptNode(element));
      await waitUntil(rendered, 'chart did not render after returning to its window', { timeout: 5_000 });
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('[part="data-table"]')?.textContent).to.include('South');
      expect(element.exportData('csv')).to.include('Retained series');
      await expect(element).to.be.accessible();
    } finally {
      element.remove();
    }
  });
}
