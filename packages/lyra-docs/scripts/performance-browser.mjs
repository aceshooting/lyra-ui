import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';
import { measureDocxPerformance } from './performance.mjs';
import { serveStatic } from './lib/static-files.mjs';
import { performanceFixtureParagraphs } from '../test/performance-fixture.mjs';

/**
 * Runs the performance harness once against the production-built test page and checks that it
 * produced a complete, internally consistent record. It asserts the shape and the functional
 * outcomes the harness verifies in the page (typed text saved, table rows restored); the timings
 * themselves are never compared with a threshold, because they are not latency guarantees.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.browser-output/performance');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const typingSamples = 20;

const finite = (value, label) => assert.ok(Number.isFinite(value) && value >= 0, `${label} must be a finite duration, was ${value}`);

function assertSummary(summary, count, label) {
  assert.equal(summary.count, count, `${label}: sample count`);
  assert.equal(summary.samplesMs.length, count, `${label}: recorded samples`);
  for (const key of ['minMs', 'medianMs', 'p95Ms', 'maxMs']) finite(summary[key], `${label}.${key}`);
  assert.ok(summary.minMs <= summary.medianMs && summary.medianMs <= summary.p95Ms && summary.p95Ms <= summary.maxMs, `${label}: ordered percentiles`);
}

/** Assert the structure of a `measureDocxPerformance` result. */
function assertPerformanceRecord(record) {
  assert.equal(record.fixture.paragraphs, performanceFixtureParagraphs);
  assert.ok(record.fixture.bytes > 0);
  assert.equal(typeof record.environment.browserVersion, 'string');
  assert.ok(record.environment.logicalCpusVisible > 0);
  for (const key of ['freshBlankOpenMs', 'freshLargeOpenMs', 'saveMs', 'warmReopenMs']) finite(record[key], key);
  assert.ok(record.savedBytes > 0, 'the saved document has content');
  assertSummary(record.inputToTwoFrames, typingSamples, 'document typing');
  assert.deepEqual({ rows: record.table.rows, columns: record.table.columns, cells: record.table.cells }, { rows: 19, columns: 20, cells: 380 });
  assert.ok(record.table.savedBytes > 0);
  finite(record.table.advisory1000Ms, 'table advisory reads');
  assertSummary(record.table.execute, 10, 'table insertion');
  assertSummary(record.table.undo, 10, 'table undo');
  assertSummary(record.table.inputToTwoFrames, typingSamples, 'table typing');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build({
    root, configFile: false, publicDir: false, base: '/', logLevel: 'warn',
    build: { outDir: output, emptyOutDir: true, rollupOptions: { input: resolve(root, 'test/browser.html') } },
  });
  const server = serveStatic(output, { index: '/test/browser.html', mime });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const browser = await chromium.launch({ headless: true });
  try {
    const record = await measureDocxPerformance({ browser, url: `http://127.0.0.1:${server.address().port}/test/browser.html` });
    assertPerformanceRecord(record);
    console.log(`PASS performance harness recorded ${record.fixture.paragraphs} paragraphs and ${record.table.cells} table cells`);
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
}
