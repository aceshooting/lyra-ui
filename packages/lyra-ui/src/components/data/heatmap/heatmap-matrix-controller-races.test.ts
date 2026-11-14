import { aTimeout, expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { HeatmapMatrixSourceController } from './heatmap-matrix-source-controller.js';
import type { LyraHeatmapMatrixSource, HeatmapSourceCell } from './heatmap-matrix-source.js';

function source(rows = 2, cols = 2): LyraHeatmapMatrixSource {
  return { revision: 1, rowCount: rows, columnCount: cols, domain: { min: 0, max: 1 },
    query: request => { const count = (request.rowEnd - request.rowStart) * (request.columnEnd - request.columnStart);
      return [{ rowStart: request.rowStart, rowEnd: request.rowEnd, columnStart: request.columnStart, columnEnd: request.columnEnd, count, validCount: count, min: 1, max: 1, sum: count }]; },
    getCell: (row, col) => ({ value: 1, rowLabel: `Row ${row}`, columnLabel: `Column ${col}` }),
  };
}

function setup() {
  const controllers = new Set<ReactiveController>();
  let repaints = 0;
  const host = Object.assign(document.createElement('div'), {
    addController: (value: ReactiveController) => controllers.add(value), removeController: (value: ReactiveController) => controllers.delete(value),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new HeatmapMatrixSourceController(host, () => { repaints++; }, () => 'en');
  return {
    control,
    repaints: () => repaints,
    dispose: () => { control.detach(); host.remove(); controllers.forEach(value => value.hostDisconnected?.()); },
  };
}

async function ready(control: HeatmapMatrixSourceController): Promise<void> {
  await waitUntil(() => !control.loading && control.tiles.length === 1, 'current matrix tiles are accepted');
}

type Read = { row: number; col: number; resolve(value: HeatmapSourceCell): void };

describe('heatmap matrix source controller races', () => {
  it('reports a failure once and keeps the failed state until a new configuration', async () => {
    const test = setup();
    try {
      test.control.configure(source(), null, false, 10); await ready(test.control);
      const before = test.repaints();
      test.control.fail();
      test.control.fail();
      expect(test.control.error).to.equal(true);
      expect(test.repaints() - before).to.equal(1);
    } finally { test.dispose(); }
  });

  it('resolves a queued exact focus to null when cancelled behind a shared window read', async () => {
    const test = setup(); const provider = source(); const reads: Read[] = [];
    provider.getCell = (row, col) => new Promise(resolve => reads.push({ row, col, resolve }));
    try {
      test.control.configure(provider, null, false, 10); await ready(test.control);
      const window = test.control.ensureWindow(0, 0);
      const focused = test.control.exact(0, 0);

      test.control.cancelExact();

      expect(await focused).to.equal(null);
      expect(await window).to.equal(false);
      reads.forEach(read => read.resolve({ value: 1, rowLabel: '', columnLabel: '' }));
      await aTimeout(0);
      expect(test.control.cells.length).to.equal(0);
      expect(test.control.error).to.equal(false);
    } finally { test.dispose(); }
  });

  it('supersedes a queued exact focus with a newer one', async () => {
    const test = setup(); const provider = source(); const reads: Read[] = [];
    provider.getCell = (row, col) => new Promise(resolve => reads.push({ row, col, resolve }));
    try {
      test.control.configure(provider, null, false, 10); await ready(test.control);
      const window = test.control.ensureWindow(0, 0);
      const older = test.control.exact(0, 0);
      const newer = test.control.exact(0, 1);

      expect(await older).to.equal(null);
      reads.forEach(read => read.resolve({ value: 1, rowLabel: `Row ${read.row}`, columnLabel: `Column ${read.col}` }));
      expect(await newer).to.deep.equal({ row: 0, col: 1, value: 1, rowLabel: 'Row 0', columnLabel: 'Column 1' });
      test.control.cancelExact();
      await window;
    } finally { test.dispose(); }
  });

  it('drops an exact read whose reply invalidates the request while it is read', async () => {
    const test = setup(); const provider = source();
    provider.getCell = () => ({
      get value() { test.control.invalidate(); return 1; },
      rowLabel: 'Row', columnLabel: 'Column',
    });
    try {
      test.control.configure(provider, null, false, 10); await ready(test.control);
      expect(await test.control.exact(1, 1)).to.equal(null);
      expect(test.control.cursor).to.equal(null);
    } finally { test.dispose(); }
  });

  it('does not fail a replacement when an obsolete source throws after configuring it', async () => {
    const test = setup(); const replacement = source(3, 3), obsolete = source();
    Object.defineProperty(obsolete, 'rowCount', {
      get: () => { test.control.configure(replacement, null, false, 10); throw new Error('obsolete getter'); },
    });
    try {
      test.control.configure(obsolete, null, false, 10);
      await ready(test.control);
      expect(test.control.source === replacement).to.equal(true);
      expect(test.control.error).to.equal(false);
      expect(test.control.rows).to.equal(3);
    } finally { test.dispose(); }
  });

  it('skips a queued tile request that went stale while an earlier query was in flight', async () => {
    const test = setup(); const provider = source(4, 4);
    const pending: (() => void)[] = []; let queries = 0;
    const base = provider.query;
    provider.query = request => { queries++; return new Promise(resolve => pending.push(() => resolve(base(request) as never))); };
    try {
      test.control.configure(provider, { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 }, true, 10);
      expect(queries).to.equal(1);
      test.control.configure(provider, { rowStart: 1, rowEnd: 3, columnStart: 1, columnEnd: 3 }, true, 10);
      test.control.detach();
      pending.forEach(release => release());
      await aTimeout(0);
      expect(queries).to.equal(1);
      expect(test.control.tiles.length).to.equal(0);
      expect(test.control.error).to.equal(false);
    } finally { test.dispose(); }
  });
});
