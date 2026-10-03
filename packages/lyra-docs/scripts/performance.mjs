import assert from 'node:assert/strict';
import { cpus, availableParallelism, totalmem, platform, arch } from 'node:os';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { performanceDocxFixture, performanceFixtureParagraphs, performanceFixtureSentinel, performanceTableFixture } from '../test/performance-fixture.mjs';
import { wordText } from '../test/xml.mjs';

const typingSamples = 20;

const round = value => Math.round(value * 10) / 10;
const summarize = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    minMs: round(sorted[0]),
    medianMs: round((sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2),
    p95Ms: round(sorted[Math.ceil(sorted.length * .95) - 1]),
    maxMs: round(sorted.at(-1)),
    samplesMs: values.map(round)
  };
};

async function environment(browser) {
  const status = platform() === 'linux' ? await readFile('/proc/self/status', 'utf8').catch(() => '') : '';
  const cpuMax = platform() === 'linux' ? await readFile('/sys/fs/cgroup/cpu.max', 'utf8').catch(() => '') : '';
  const memoryMax = platform() === 'linux' ? await readFile('/sys/fs/cgroup/memory.max', 'utf8').catch(() => '') : '';
  const [quota, period] = cpuMax.trim().split(/\s+/);
  return {
    platform: platform(), arch: arch(), node: process.version,
    cpuModel: cpus()[0]?.model ?? null,
    logicalCpusVisible: cpus().length,
    processParallelism: availableParallelism(),
    cpuAffinity: status.match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1] ?? null,
    cgroupCpuQuotaCores: quota && quota !== 'max' && Number(period) > 0 ? round(Number(quota) / Number(period)) : null,
    memoryGiB: round(totalmem() / 1024 ** 3),
    cgroupMemoryGiB: memoryMax.trim() && memoryMax.trim() !== 'max' ? round(Number(memoryMax.trim()) / 1024 ** 3) : null,
    browserVersion: browser.version()
  };
}

async function freshPage(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.setDefaultTimeout(90_000);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__docxTest?.ready === true);
    await page.evaluate(() => window.__docxTest.loadEditor());
    await page.waitForFunction(() => Boolean(customElements.get('lr-docx-editor')));
    await page.evaluate(() => {
      const element = document.createElement('lr-docx-editor');
      element.id = 'performance-editor';
      document.querySelector('#fixture').append(element);
    });
    return { context, page, pageErrors };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Measure the production-built editor through its public custom-element API. */
export async function measureDocxPerformance({ browser, url }) {
  const fixture = performanceDocxFixture();
  const result = {
    environment: await environment(browser),
    fixture: { paragraphs: performanceFixtureParagraphs, bytes: fixture.byteLength, compression: 'stored', rtlEveryTenthParagraph: true },
    method: 'Fresh browser contexts; open/save timers run in the page. Opening includes engine loading, layout and two animation frames. Input-to-paint samples start at beforeinput and end after two animation frames. Browser/OS caches may be warm. These samples are not latency guarantees.'
  };

  const blank = await freshPage(browser, url);
  try {
    result.freshBlankOpenMs = await blank.page.evaluate(async () => {
      const element = document.querySelector('#performance-editor');
      const started = performance.now();
      const opened = await element.newDocument();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!opened.ok || element.snapshot()?.status !== 'ready') throw new Error(`Blank open failed: ${JSON.stringify(opened)}`);
      return performance.now() - started;
    });
    assert.deepEqual(blank.pageErrors, [], 'Blank-open page error');
  } finally { await blank.context.close(); }

  const large = await freshPage(browser, url);
  try {
    result.freshLargeOpenMs = await large.page.evaluate(async bytes => {
      const element = document.querySelector('#performance-editor');
      const started = performance.now();
      const opened = await element.open(Uint8Array.from(bytes));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!opened.ok || element.snapshot()?.status !== 'ready') throw new Error(`Large open failed: ${JSON.stringify(opened)}`);
      return performance.now() - started;
    }, [...fixture]);

    await large.page.locator('#performance-editor .docx-pages').click();
    await large.page.evaluate(() => {
      const element = document.querySelector('#performance-editor');
      window.__docxPaintSamples = [];
      element.addEventListener('beforeinput', event => {
        if (event.inputType !== 'insertText') return;
        const started = performance.now();
        const revision = element.snapshot()?.revision?.value ?? -1;
        const afterCommit = () => {
          if ((element.snapshot()?.revision?.value ?? -1) <= revision) {
            requestAnimationFrame(afterCommit);
            return;
          }
          requestAnimationFrame(() => requestAnimationFrame(() => window.__docxPaintSamples.push(performance.now() - started)));
        };
        requestAnimationFrame(afterCommit);
      }, { capture: true });
    });
    const before = await large.page.evaluate(() => document.querySelector('#performance-editor').snapshot()?.revision?.value);
    for (let index = 0; index < typingSamples; index++) {
      await large.page.keyboard.insertText(String(index % 10));
      await large.page.waitForFunction(expected => window.__docxPaintSamples?.length >= expected, index + 1);
    }
    const after = await large.page.evaluate(() => document.querySelector('#performance-editor').snapshot()?.revision?.value);
    assert.ok(after > before, 'Typing did not change the document revision');
    result.inputToTwoFrames = summarize(await large.page.evaluate(() => window.__docxPaintSamples));

    const saved = await large.page.evaluate(async () => {
      const element = document.querySelector('#performance-editor');
      const started = performance.now();
      const outcome = await element.save();
      const elapsedMs = performance.now() - started;
      if (!outcome.ok) throw new Error(`Save failed: ${JSON.stringify(outcome)}`);
      return { elapsedMs, bytes: [...outcome.value.bytes] };
    });
    result.saveMs = saved.elapsedMs;
    result.savedBytes = saved.bytes.length;
    const xml = strFromU8(unzipSync(Uint8Array.from(saved.bytes))['word/document.xml']);
    const text = wordText(xml);
    assert.ok(text.includes(performanceFixtureSentinel), 'Last fixture paragraph missing from saved document');
    assert.ok(text.includes('01234567890123456789'), 'Typed sample missing from saved document');

    result.warmReopenMs = await large.page.evaluate(async bytes => {
      const element = document.querySelector('#performance-editor');
      const started = performance.now();
      const opened = await element.open(Uint8Array.from(bytes));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!opened.ok || element.snapshot()?.status !== 'ready') throw new Error(`Reopen failed: ${JSON.stringify(opened)}`);
      return performance.now() - started;
    }, saved.bytes);
    assert.deepEqual(large.pageErrors, [], 'Large-document page error');
    result.freshBlankOpenMs = round(result.freshBlankOpenMs);
    result.freshLargeOpenMs = round(result.freshLargeOpenMs);
    result.saveMs = round(result.saveMs);
    result.warmReopenMs = round(result.warmReopenMs);
  } finally { await large.context.close(); }
  result.table = await measureTablePerformance(browser, url);
  return result;
}


async function measureTablePerformance(browser, url) {
  const run = await freshPage(browser, url);
  try {
    const fixture = performanceTableFixture();
    const opened = await run.page.evaluate(bytes => document.querySelector('#performance-editor').open(Uint8Array.from(bytes)), [...fixture]);
    assert.equal(opened.ok, true, JSON.stringify(opened));
    await run.page.locator('#performance-editor .docx-pages').getByText('T1_1', { exact: true }).click();
    await run.page.keyboard.press('ArrowLeft');
    const measurements = await run.page.evaluate(() => {
      const element = document.querySelector('#performance-editor');
      const action = { type: 'insert-table-row', where: 'below' };
      const unchanged = element.snapshot().revision;
      const readsStarted = performance.now();
      for (let index = 0; index < 1000; index++) {
        if (!element.can(action).enabled || element.snapshot().revision !== unchanged) throw Error('Advisory read changed document');
      }
      const advisory1000Ms = performance.now() - readsStarted;
      const executeMs = [], undoMs = [];
      for (let index = 0; index < 10; index++) {
        const before = element.snapshot().revision.value;
        let started = performance.now();
        const inserted = element.execute(action); executeMs.push(performance.now() - started);
        if (!inserted.ok || element.snapshot().revision.value !== before + 1 || element.snapshot().table?.rows !== 20)
          throw Error(`Table insertion failed: ${JSON.stringify(inserted)}`);
        started = performance.now();
        const undone = element.execute('undo'); undoMs.push(performance.now() - started);
        if (!undone.ok || element.snapshot().revision.value !== before + 2 || element.snapshot().table?.rows !== 19)
          throw Error('Table undo did not restore 19 rows');
      }
      return { advisory1000Ms, executeMs, undoMs };
    });
    await run.page.locator('#performance-editor .docx-pages').getByText('T1_1', { exact: true }).click();
    await run.page.keyboard.press('ArrowLeft');
    await run.page.evaluate(() => {
      const element = document.querySelector('#performance-editor'); window.__tablePaintSamples = [];
      element.addEventListener('beforeinput', event => {
        if (event.inputType !== 'insertText') return;
        const started = performance.now(), revision = element.snapshot().revision.value;
        const afterCommit = () => {
          if (element.snapshot().revision.value <= revision) { requestAnimationFrame(afterCommit); return; }
          requestAnimationFrame(() => requestAnimationFrame(() => window.__tablePaintSamples.push(performance.now() - started)));
        };
        requestAnimationFrame(afterCommit);
      }, { capture: true });
    });
    for (let index = 0; index < typingSamples; index++) {
      await run.page.keyboard.insertText(String(index % 10));
      await run.page.waitForFunction(expected => window.__tablePaintSamples.length >= expected, index + 1);
    }
    const saved = await run.page.evaluate(async () => {
      const saved = await document.querySelector('#performance-editor').save();
      if (!saved.ok) throw Error(`Table save failed: ${JSON.stringify(saved)}`);
      return [...saved.value.bytes];
    });
    const xml = strFromU8(unzipSync(Uint8Array.from(saved))['word/document.xml']);
    assert.ok(wordText(xml).includes('01234567890123456789'), 'Table typing sample missing from saved document');
    assert.ok(wordText(xml).includes('T18_19'), 'Last table cell missing after operation/typing samples');
    assert.equal((xml.match(/<w:tr[ >]/gu) ?? []).length, 19);
    assert.deepEqual(run.pageErrors, []);
    return { rows: 19, columns: 20, cells: 380, bytes: fixture.length, savedBytes: saved.length,
      method: 'Synchronous public execution includes bounded canonical qualification and core layout. Each insertion reaches 20x20 and is undone; no cold-index guarantee. Advisory reads assert unchanged revision. Native typing is measured inside the target table through two postcommit animation frames.',
      advisory1000Ms: round(measurements.advisory1000Ms), execute: summarize(measurements.executeMs), undo: summarize(measurements.undoMs),
      inputToTwoFrames: summarize(await run.page.evaluate(() => window.__tablePaintSamples)) };
  } finally { await run.context.close(); }
}
