import { expect, waitUntil } from '@open-wc/testing';
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
  const host = Object.assign(document.createElement('div'), {
    addController: (value: ReactiveController) => controllers.add(value), removeController: (value: ReactiveController) => controllers.delete(value),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new HeatmapMatrixSourceController(host, () => {}, () => 'en');
  return { control, dispose: () => { control.detach(); host.remove(); controllers.forEach(value => value.hostDisconnected?.()); } };
}
async function ready(control: HeatmapMatrixSourceController): Promise<void> {
  await waitUntil(() => !control.loading && control.tiles.length === 1, 'current matrix tiles are accepted');
}

it('rejects matrix dimensions whose product exceeds safe integer precision before querying', () => {
  const test = setup(); let calls = 0;
  try {
    const provider = source(Number.MAX_SAFE_INTEGER, 2); provider.query = () => { calls++; return []; };
    test.control.configure(provider, null, false, 10);
    expect(test.control.error).to.equal(true); expect(test.control.tiles.length).to.equal(0); expect(calls).to.equal(0);
  } finally { test.dispose(); }
});

it('distinguishes an empty matrix from an explicit viewport outside that matrix', () => {
  const test = setup(); const provider = source(0, 0);
  try {
    test.control.configure(provider, null, false, 10);
    expect(test.control.error).to.equal(false); expect(test.control.loading).to.equal(false); expect(test.control.viewport).to.equal(null);
    test.control.configure(provider, { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 }, true, 10);
    expect(test.control.error).to.equal(true);
  } finally { test.dispose(); }
});

for (const property of ['revision', 'columnCount', 'domain'] as const) it(`preserves a replacement configured by the source ${property} getter`, async () => {
  const test = setup(); const replacement = source(3, 4), obsolete = source(); let oldCalls = 0;
  const original = obsolete[property];
  Object.defineProperty(obsolete, property, { get: () => { test.control.configure(replacement, null, false, 10); return original; } });
  obsolete.query = () => { oldCalls++; return []; };
  try {
    test.control.configure(obsolete, null, false, 10); await ready(test.control);
    expect(test.control.source === replacement).to.equal(true); expect(test.control.rows).to.equal(3); expect(test.control.cols).to.equal(4);
    expect(oldCalls).to.equal(0); expect(test.control.error).to.equal(false);
  } finally { test.dispose(); }
});

it('shares a pending window coordinate with an exact focus without a duplicate provider read', async () => {
  const test = setup(); const provider = source();
  const reads: { row: number; col: number; resolve(value: HeatmapSourceCell): void }[] = [];
  provider.getCell = (row, col) => new Promise(resolve => reads.push({ row, col, resolve }));
  try {
    test.control.configure(provider, null, false, 10); await ready(test.control);
    const window = test.control.ensureWindow(0, 0);
    expect(reads.length).to.equal(2);
    const focused = test.control.exact(0, 0); expect(reads.length).to.equal(2);
    reads[0]!.resolve({ value: 1, rowLabel: 'Shared', columnLabel: 'Zero' });
    const result = await focused;
    expect(result).to.deep.equal({ row: 0, col: 0, value: 1, rowLabel: 'Shared', columnLabel: 'Zero' });
    expect(reads.filter(item => item.row === 0 && item.col === 0).length).to.equal(1);
    test.control.cancelExact(); expect(await window).to.equal(false);
    reads.slice(1).forEach(item => item.resolve({ value: 1, rowLabel: '', columnLabel: '' }));
    expect(test.control.cells.length).to.equal(0);
  } finally { test.dispose(); }
});

it('cancels an active and a queued exact focus when the source detaches', async () => {
  const test = setup(); const provider = source();
  const releases: ((value: HeatmapSourceCell) => void)[] = [];
  provider.getCell = () => new Promise(resolve => releases.push(resolve));
  try {
    test.control.configure(provider, null, false, 10); await ready(test.control);
    const first = test.control.exact(0, 0), second = test.control.exact(0, 1), third = test.control.exact(1, 1);
    expect(await first).to.equal(null); expect(await second).to.equal(null); expect(releases.length).to.equal(2);
    test.control.detach(); expect(await third).to.equal(null);
    releases.forEach(resolve => resolve({ value: 1, rowLabel: 'Obsolete', columnLabel: '' }));
    await Promise.resolve(); await Promise.resolve();
    expect(test.control.cursor).to.equal(null); expect(test.control.cells.length).to.equal(0); expect(test.control.error).to.equal(false);
  } finally { test.dispose(); }
});

it('rejects an exact-window provider failure and recovers only with a new source authority', async () => {
  const test = setup(); const provider = source();
  provider.getCell = () => { throw new Error('Exact provider failure'); };
  try {
    test.control.configure(provider, null, false, 10); await ready(test.control);
    expect(await test.control.ensureWindow(0, 0)).to.equal(false);
    expect(test.control.error).to.equal(true); expect(test.control.cells.length).to.equal(0);
    expect(await test.control.exact(0, 0)).to.equal(null);
    test.control.configure(source(), null, false, 10); await ready(test.control);
    expect(await test.control.ensureWindow(0, 0)).to.equal(true);
    expect(test.control.cells.length).to.equal(4); expect(test.control.error).to.equal(false);
  } finally { test.dispose(); }
});
