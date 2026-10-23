import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { observeGraphWorkers, completionReason } from './layout-observation.mjs';

export function spread(values) {
  if (!values.length || values.some(value => !Number.isFinite(value))) throw new TypeError('Expected finite observations');
  const sorted = values.slice().sort((a, b) => a - b);
  return { samples: values.slice(), min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) };
}

export function heapDifference(before, after) {
  if (![before, after].every(value => Number.isFinite(value) && value >= 0)) throw new TypeError('Invalid heap observation');
  return { beforeBytes: before, afterDisposeBytes: after, retainedDeltaBytes: after - before };
}

export async function collectAcceptanceObservations(browser, origin, scenarios, viewport, captureDirectory) {
  await mkdir(captureDirectory, { recursive: true });
  const repetitions = [];
  for (const scenario of scenarios) {
    for (let repetition = 1; repetition <= 3; repetition++) {
      const page = await browser.newPage({ viewport });
      let session;
      const row = { scenario: scenario.id, repetition, status: 'failed' };
      repetitions.push(row);
      try {
        await page.addInitScript(observeGraphWorkers);
        await page.goto(origin, { waitUntil: 'load' });
        await page.waitForFunction(() => !!window.__gpuBenchmark);
        session = await page.context().newCDPSession(page);
        await session.send('HeapProfiler.collectGarbage');
        const before = (await session.send('Runtime.getHeapUsage')).usedSize;
        const mounted = await page.evaluate(scenario => window.__gpuBenchmark[scenario.kind](scenario), scenario);
        row.mountMs = mounted.mountMs;
        const box = await page.evaluate(() => window.__gpuBenchmark.engineCanvas());
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        try {
          await page.evaluate(() => window.__gpuBenchmark.armInputObservation());
          await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 15);
          row.input = await page.evaluate(() => window.__gpuBenchmark.readInputObservation());
        } finally { await page.mouse.up(); }
        row.screenshot = join(captureDirectory, `${scenario.id}-${repetition}.png`);
        await page.screenshot({ path: row.screenshot });
        const pinnedFallbacks = await page.evaluate(() => window.__gpuBenchmark.readFallbacks());
        await page.evaluate(() => window.__gpuBenchmark.dispose());
        await session.send('HeapProfiler.collectGarbage');
        row.heap = heapDifference(before, (await session.send('Runtime.getHeapUsage')).usedSize);
        if (scenario.kind === 'graph') {
          await page.evaluate(() => window.__layoutObservation.reset());
          const unpinnedMount = await page.evaluate(scenario => window.__gpuBenchmark.graph({ ...scenario, unpinned: true }), scenario);
          row.unpinnedMountMs = unpinnedMount.mountMs;
          try {
            await page.waitForFunction(() => window.__layoutObservation.read()?.done === true || !!window.__layoutObservation.read()?.invalidated, null, { timeout: 120000 });
            row.convergence = await page.evaluate(() => window.__layoutObservation.read());
            row.convergence.reason = row.convergence.invalidated ? 'updated-task-not-observed' : completionReason(row.convergence);
          } catch {
            row.convergence = { status: 'unavailable', reason: 'No completed worker output within observation window; worker fallback or unfinished layout.', last: await page.evaluate(() => window.__layoutObservation.read()) };
          }
          row.convergence.fallbacks = await page.evaluate(() => window.__gpuBenchmark.readFallbacks());
          await page.evaluate(() => window.__gpuBenchmark.dispose());
        }
        row.fallbacks = [...pinnedFallbacks, ...(row.convergence?.fallbacks ?? [])];
        row.status = row.fallbacks.length ? 'fallback' : 'observed';
      } catch (error) {
        row.error = String(error?.message ?? error);
      } finally { await session?.detach(); await page.close(); }
    }
  }
  const summaries = scenarios.map(({ id }) => {
    const rows = repetitions.filter(row => row.scenario === id && row.status === 'observed' && (row.convergence === undefined || row.convergence.done === true));
    return { scenario: id, complete: rows.length === 3, ...(rows.length ? {
      mountMs: spread(rows.map(row => row.mountMs)),
      inputToDrawMs: spread(rows.map(row => row.input.inputToDrawMs)),
      retainedDeltaBytes: spread(rows.map(row => row.heap.retainedDeltaBytes)),
      ...(rows.every(row => row.convergence?.done) ? { layoutCompletionMs: spread(rows.map(row => row.convergence.elapsedMs)), unpinnedMountMs: spread(rows.map(row => row.unpinnedMountMs)) } : {}),
    } : {}) };
  });
  return { repetitions, summaries,
    limits: 'Input receipt to CPU WebGL draw submission, not GPU presentation or OS input latency. CDP main-isolate used heap excludes worker heaps, GPU/driver/native allocations and OS memory. Captures require visual review. No numeric thresholds apply to these observations.' };
}

/** Observational completeness is required when requested; no new numeric performance limits. */
export function measurementFailed(result, acceptanceRequested = false) {
  return !result.modes.length || result.modes.some(report =>
    report.scenarios.some(scenario => scenario.status !== 'measured') ||
    (acceptanceRequested && (!report.acceptance || report.acceptance.summaries.length !== 2 ||
      report.acceptance.summaries.some(row => !row.complete))));
}
