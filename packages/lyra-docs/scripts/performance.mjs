import assert from 'node:assert/strict';
import { cpus, availableParallelism, totalmem, platform, arch } from 'node:os';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { performanceDocxFixture, performanceFixtureParagraphs, performanceFixtureSentinel } from '../test/performance-fixture.mjs';

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
    assert.ok(xml.includes(performanceFixtureSentinel), 'Last fixture paragraph missing from saved document');
    assert.ok(xml.replace(/<[^>]+>/g, '').includes('01234567890123456789'), 'Typed sample missing from saved document');

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
    return result;
  } finally { await large.context.close(); }
}
