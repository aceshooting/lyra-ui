import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.class.js';
import type { LyraHeatmapMatrixSource, LyraHeatmapMatrixViewport } from './heatmap-matrix-source.js';

function deferredSource(rows = 4, columns = 4) {
  const releases: (() => void)[] = [];
  const reads: [number, number][] = [];
  let hold = false;
  const source: LyraHeatmapMatrixSource = {
    revision: 1, rowCount: rows, columnCount: columns, domain: { min: 0, max: rows * columns },
    query(request) {
      const { rowStart, rowEnd, columnStart, columnEnd } = request;
      const count = (rowEnd - rowStart) * (columnEnd - columnStart);
      const reply = [{ rowStart, rowEnd, columnStart, columnEnd, count, validCount: count, min: 0, max: count, sum: count }];
      if (!hold) return reply;
      return new Promise(resolve => releases.push(() => resolve(reply)));
    },
    getCell(row, column) {
      reads.push([row, column]);
      return { value: row * columns + column, rowLabel: `Row ${row}`, columnLabel: `Column ${column}` };
    },
  };
  return { source, releases, reads, holdQueries: () => { hold = true; } };
}

function canvas(el: LyraHeatmap): HTMLCanvasElement {
  const node = el.shadowRoot?.querySelector<HTMLCanvasElement>('[part="canvas"]');
  if (!node) throw new Error('Missing source canvas');
  return node;
}

function busy(el: LyraHeatmap): string | null | undefined {
  return el.shadowRoot?.querySelector('[part="base"]')?.getAttribute('aria-busy');
}

describe('lr-heatmap matrix source pending and failed states', () => {
  it('withholds a keyboard range selection while a replacement viewport is loading', async () => {
    const provider = deferredSource();
    const viewport: LyraHeatmapMatrixViewport = { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 };
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size: 320px"
      .matrixSource=${provider.source} .matrixViewport=${viewport}></lr-heatmap>`);
    await waitUntil(() => busy(el) === 'false', 'initial tiles load');
    const ranges: unknown[] = [];
    el.addEventListener('lr-matrix-range-select', event => ranges.push((event as CustomEvent).detail));

    provider.holdQueries();
    el.matrixViewport = { rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 3 };
    await waitUntil(() => busy(el) === 'true', 'replacement viewport is loading');
    await focusByKeyboard(canvas(el));
    await sendKeys({ press: 'Shift+Enter' });
    await el.updateComplete;
    expect(ranges.length).to.equal(0);

    provider.releases.forEach(release => release());
    await waitUntil(() => busy(el) === 'false', 'replacement tiles load');
    await sendKeys({ press: 'Shift+Enter' });
    await waitUntil(() => ranges.length === 1, 'loaded range is selectable');
    expect(ranges[0]).to.include({ rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 3 });
  });

  it('ignores canvas navigation and activation once the tile query has failed', async () => {
    const provider = deferredSource();
    provider.source.query = () => { throw new Error('Tiles unavailable'); };
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size: 320px"
      .matrixSource=${provider.source}></lr-heatmap>`);
    await waitUntil(() => el.shadowRoot?.querySelector('[part="source-error"]') !== null, 'error renders');
    const activations: unknown[] = [];
    el.addEventListener('lr-cell-activate', event => activations.push((event as CustomEvent).detail));

    await focusByKeyboard(canvas(el));
    await sendKeys({ press: 'ArrowRight' });
    await sendKeys({ press: 'Enter' });
    canvas(el).click();
    await el.updateComplete;

    expect(provider.reads.length).to.equal(0);
    expect(activations.length).to.equal(0);
  });
});
