// Frame-work cost of inline-style animation with and without automatic scopes for inline inputs
// (variant j, the design review's recommendation 4). Gate for adopting `[style*='--lr-theme-']`.
// Usage: node anim.mjs [--variants i,j] [--runs 5] [--count 500] [--frames 180] [--engines ...]
import { chromium, firefox, webkit } from 'playwright';
import os from 'node:os';
import { writeFileSync } from 'node:fs';
import { startServer } from './server.mjs';
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const VARIANTS = arg('variants', 'i,j').split(','), RUNS = Number(arg('runs', '5'));
const COUNT = Number(arg('count', '500')), FRAMES = Number(arg('frames', '180'));
const ENGINES = arg('engines', 'chromium,firefox,webkit').split(',');
const engines = { chromium, firefox, webkit };
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const med = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const results = { count: COUNT, frames: FRAMES, loadavgAtStart: os.loadavg(), samples: [] };
for (const name of ENGINES) for (const inputs of [false, true]) {
  for (let run = 0; run < RUNS; run++) for (const v of run % 2 ? [...VARIANTS].reverse() : VARIANTS) {
    const browser = await engines[name].launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${base}/web/anim.html?variant=${v}&count=${COUNT}&inputs=${inputs ? 1 : 0}`);
    await page.waitForFunction(() => window.animReady === true);
    const work = await page.evaluate((frames) => window.animate(frames), FRAMES);
    results.samples.push({ engine: name, inputs, variant: v, run, median: med(work.slice(10)), p95: q(work.slice(10), 0.95), raw: work });
    await browser.close();
  }
  const line = VARIANTS.map((v) => { const x = results.samples.filter((s) => s.engine === name && s.inputs === inputs && s.variant === v); return `${v.toUpperCase()} median ${med(x.map((s) => s.median)).toFixed(2)} ms p95 ${med(x.map((s) => s.p95)).toFixed(2)} ms`; });
  console.log(`${name} ${COUNT} animated elements${inputs ? ' with inline inputs' : ''}: ${line.join('  ')}`);
}
results.loadavgAtEnd = os.loadavg();
server.close();
writeFileSync(new URL(`./out/anim-${VARIANTS.join('')}.json`, import.meta.url), JSON.stringify(results, null, 2));
