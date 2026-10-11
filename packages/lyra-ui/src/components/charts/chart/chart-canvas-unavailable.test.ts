import { expect, waitUntil } from '@open-wc/testing';
import { sinkTexts } from '../../../../test/announcements.js';
import './chart.js';
import './box-plot.js';
import type { LyraChart } from './chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';

for (const tag of ['lr-chart', 'lr-box-plot']) {
  it(`${tag} preserves accessible data when the canvas context is unavailable and recovers`, async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    const failureMessage = 'Rendering is unavailable here.';
    const announcementCount = () => sinkTexts('assertive').filter((text) => text === failureMessage).length;
    const announcementsBefore = announcementCount();
    const el = document.createElement(tag) as LyraChart | LyraBoxPlot;
    el.strings = { chartRenderUnavailable: 'Rendering is unavailable here.' };
    el.style.cssText = 'inline-size: 600px; block-size: 300px';
    const setData = (value: number) => {
      el.labels = ['January'];
      if (tag === 'lr-box-plot') {
        (el as LyraBoxPlot).datasets = [{ label: 'Sales', data: [{ min: value, q1: value + 1, median: value + 2, q3: value + 3, max: value + 4 }] }];
      } else {
        (el as LyraChart).datasets = [{ label: 'Sales', data: [value] }];
      }
    };
    try {
      HTMLCanvasElement.prototype.getContext = (() => null) as typeof original;
      setData(10);
      document.body.append(el);
      await waitUntil(() => !!el.shadowRoot?.querySelector('[part="error"]'),
        'Canvas failure should have a visible localized fallback', { timeout: 5000 });
      for (const value of [20, 30]) {
        setData(value);
        await el.updateComplete;
        expect((el as unknown as { chart?: unknown }).chart).to.equal(undefined);
        const table = el.shadowRoot!.querySelector('[part="data-table"]')!;
        expect(table.hasAttribute('data-visually-hidden')).to.equal(false);
        expect(table.textContent).to.include('Sales');
        expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent?.trim()).to.equal('Rendering is unavailable here.');
        const plot = el.shadowRoot!.querySelector<HTMLElement>('[part="plot"]')!;
        const canvas = plot.querySelector('canvas')!;
        expect(getComputedStyle(plot).display).to.equal('none');
        expect(canvas.getClientRects().length).to.equal(0);
        expect(announcementCount()).to.equal(announcementsBefore + 1);
      }
      HTMLCanvasElement.prototype.getContext = original;
      setData(40);
      await waitUntil(() => (el as unknown as { chart?: unknown }).chart !== undefined,
        'Canvas rendering should recover after capability returns', { timeout: 5000 });
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
      await waitUntil(() => {
        const plot = el.shadowRoot!.querySelector<HTMLElement>('[part="plot"]');
        const canvas = plot?.querySelector('canvas');
        const chart = (el as unknown as { chart?: { width: number; height: number } }).chart;
        const plotRect = plot?.getBoundingClientRect();
        const canvasRect = canvas?.getBoundingClientRect();
        return !!plot && getComputedStyle(plot).display !== 'none'
          && !!plotRect && plotRect.width > 0 && plotRect.height > 0
          && !!canvasRect && canvasRect.width > 0 && canvasRect.height > 0
          && !!chart && chart.width > 0 && chart.height > 0;
      }, 'Recovered plot, canvas, and runtime must have nonzero geometry', { timeout: 5000 });
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
      el.remove();
    }
    expect((el as unknown as { chart?: unknown }).chart).to.equal(undefined);
  });
}

for (const tag of ['lr-chart', 'lr-box-plot']) {
  it(`${tag} destroys a peer instance that fails to acquire its context`, async () => {
    const el = document.createElement(tag) as LyraChart | LyraBoxPlot;
    el.style.cssText = 'inline-size: 600px; block-size: 300px';
    const runtime = el as unknown as {
      chart?: { destroy(): void };
      chartJsModule: { Chart: new (...args: unknown[]) => object };
      draw(): void;
    };
    let destroyed = 0;
    let updates = 0;
    try {
      document.body.append(el);
      await waitUntil(() => runtime.chart !== undefined, 'Initial chart should render', { timeout: 5000 });
      runtime.chart!.destroy();
      runtime.chart = undefined;
      runtime.chartJsModule = { Chart: class {
        canvas = null;
        ctx = null;
        destroy() { destroyed++; }
        update() { updates++; }
      } };
      runtime.draw();
      await waitUntil(() => !!el.shadowRoot!.querySelector('[part="error"]'),
        'Failed peer should render its fallback', { timeout: 5000 });
      expect(runtime.chart).to.equal(undefined);
      expect(destroyed).to.equal(1);
      expect(updates).to.equal(0);
      expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
    } finally {
      el.remove();
    }
  });
}
