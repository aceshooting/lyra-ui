// First adoption of the layer on a page that already has a large application DOM and no Lyra
// element yet: connect one lr-badge and time it through the next full style and layout.
// Usage: node late-adopt.mjs [--rows 20000] [--runs 5] [--variants a,e] [--engines ...] [--link]
//   --link  the page links the variant's tokens-root.css (27.0.0 skips the constructed copy then)
import { chromium, firefox, webkit } from 'playwright';
import os from 'node:os';
import { writeFileSync } from 'node:fs';
import { startServer } from './server.mjs';
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const ROWS = Number(arg('rows', '20000')), RUNS = Number(arg('runs', '5'));
const VARIANTS = arg('variants', 'a,e').split(','), ENGINES = arg('engines', 'chromium,firefox,webkit').split(',');
const LINK = process.argv.includes('--link');
const engines = { chromium, firefox, webkit };
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const med = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const results = { rows: ROWS, runs: RUNS, link: LINK, loadavgAtStart: os.loadavg(), samples: [] };
for (const name of ENGINES) {
  for (let run = 0; run < RUNS; run++) for (const v of run % 2 ? [...VARIANTS].reverse() : VARIANTS) {
    const browser = await engines[name].launch();
    const page = await browser.newPage();
    await page.goto(`${base}/web/bench.html?variant=${v}${LINK ? '&link=1' : ''}`);
    await page.waitForFunction(() => window.spikeReady === true);
    await page.evaluate((n) => window.spike.appRows(n), ROWS);
    const ms = await page.evaluate(() => window.spike.lateAdopt());
    results.samples.push({ engine: name, variant: v, run, ms });
    await browser.close();
  }
  const line = VARIANTS.map((v) => { const x = results.samples.filter((s) => s.engine === name && s.variant === v).map((s) => s.ms); return `${v.toUpperCase()} ${med(x).toFixed(1)} [${q(x, 0.25).toFixed(1)}–${q(x, 0.75).toFixed(1)}]`; });
  console.log(`${name} first connect with ${ROWS} application rows: ${line.join('  ')} ms`);
}
results.loadavgAtEnd = os.loadavg();
server.close();
writeFileSync(new URL(`./out/late-adopt-${VARIANTS.join('')}${LINK ? '-link' : ''}.json`, import.meta.url), JSON.stringify(results, null, 2));
