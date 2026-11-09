import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import type { LyraHeatmap } from './heatmap.js';
import './heatmap.js';

expectDevWarning('heatmap-no-canvas-context');

// Scratch measurements are cached per document. Keep this allocation failure in its own page;
// the component's connected paint canvas remains available throughout these tests.
describe('heatmap painting without a scratch measurement context', () => {
  const original = HTMLCanvasElement.prototype.getContext;
  before(() => {
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement, ...args: Parameters<typeof original>
    ) {
      return this.isConnected ? original.apply(this, args) : null;
    } as typeof original;
  });
  after(() => { HTMLCanvasElement.prototype.getContext = original; });

  it('uses the default gutters for automatic matrix labels and respects later explicit gutters', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size:400px"
      row-label-width="auto" col-label-height="auto" col-label-rotation="90"
      .data=${{ kind: 'matrix', rowLabels: ['An exceptionally long row label'],
        colLabels: ['An exceptionally long column label'], values: [[7]] }}
    ></lr-heatmap>`);
    await waitUntil(() => element.exportData('png').startsWith('data:image/png'));
    expect(element.matrixGeometry?.padLeft).to.equal(60);
    expect(element.matrixGeometry?.padTop).to.equal(20);
    const csv = element.exportData('csv');
    expect(csv).to.include('An exceptionally long row label,An exceptionally long column label,7');

    element.rowLabelWidth = 100;
    element.colLabelHeight = 80;
    await element.updateComplete;
    await waitUntil(() => element.matrixGeometry?.padLeft === 100 && element.matrixGeometry?.padTop === 80);
    expect(element.exportData('png')).to.match(/^data:image\/png/);
    expect(element.exportData('csv')).to.equal(csv);
  });

  it('uses the default automatic weekday gutter while preserving calendar cells and exports', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size:400px"
      .data=${{ kind: 'calendar', weekdayLabelWidth: 'auto', days: [{ date: '2026-01-05', value: 3 }] }}
    ></lr-heatmap>`);
    await waitUntil(() => element.exportData('png').startsWith('data:image/png'));
    expect(element.calendarGeometry?.padLeft).to.equal(28);
    expect(element.calendarGeometry?.weekCount).to.equal(1);
    expect(element.exportData('csv')).to.equal('date,value\r\n2026-01-05,3');

    element.data = { kind: 'calendar', weekdayLabelWidth: 90, days: [{ date: '2026-01-05', value: 4 }] };
    await element.updateComplete;
    await waitUntil(() => element.calendarGeometry?.padLeft === 90);
    expect(element.exportData('png')).to.match(/^data:image\/png/);
    expect(element.exportData('csv')).to.equal('date,value\r\n2026-01-05,4');
  });
});
