// Style-recalc benchmark: variant A (per-host tokens) against B, C or D (see build.mjs).
// Usage: node run.mjs [--variants a,b] [--mix all|nocard] [--render batch|incremental] [--scopes 50]
//                    [--row-scopes] [--roots] [--host-scope] [--runs 7] [--sizes 200,1000,3000]
//                    [--engines chromium,firefox,webkit]
//   --row-scopes  every row is a theme scope      --roots  every row sits in an application shadow root
//   --host-scope  (variant E) each such application host is also a scope
//   --foreign-always (variant E) adopt into every application root, not only where a scope needs it
// Writes out/results-<mix>-<variants>-<timestamp>.json (raw samples) and prints a median/IQR summary
// (the summary compares the first two variants; report.mjs renders the RFC tables).
import { chromium, firefox, webkit } from 'playwright';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { startServer } from './server.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const RUNS = Number(arg('runs', '7'));
const SIZES = arg('sizes', '200,1000,3000').split(',').map(Number);
const ENGINES = arg('engines', 'chromium,firefox,webkit').split(',');
const SWITCH_REPS = 7;
const VARIANTS = arg('variants', 'a,b').split(',');
const MIX = arg('mix', 'all'); // 'all' = six types; 'nocard' = without lr-card
const INCREMENTAL = arg('render', 'batch') === 'incremental'; // 'batch' = one insert; 'incremental' = row by row
const SCOPES = Number(arg('scopes', '0')); // theme-scope elements wrapping the rows
const ROW_SCOPES = process.argv.includes('--row-scopes');
const ROOTS = process.argv.includes('--roots');
const HOST_SCOPE = process.argv.includes('--host-scope');
const FOREIGN_ALWAYS = process.argv.includes('--foreign-always');
const PAGE_PARAMS = `mix=${MIX}&scopes=${SCOPES}&rowScopes=${ROW_SCOPES ? 1 : 0}&roots=${ROOTS ? 1 : 0}&hostScope=${HOST_SCOPE ? 1 : 0}&foreign=${FOREIGN_ALWAYS ? 'always' : 'demand'}`;
const { createHash } = await import('node:crypto');
const provenance = {
  sourceCommit: readFileSync(new URL('./SOURCE_COMMIT', import.meta.url), 'utf8').trim(),
  bundleSha256: Object.fromEntries(VARIANTS.map((v) => [v, createHash('sha256').update(readFileSync(new URL(`./out/bundle-${v}.js`, import.meta.url))).digest('hex').slice(0, 16)])),
  loadavgAtStart: os.loadavg(),
  startedAt: new Date().toISOString(),
};
const engines = { chromium, firefox, webkit };

/** Proportional set size (kB) summed over a process and all of its descendants. */
function treePssKb(rootPid) {
  const children = new Map();
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(Number(entry));
    } catch { /* process exited */ }
  }
  let total = 0;
  const stack = [rootPid];
  while (stack.length) {
    const pid = stack.pop();
    try {
      const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      total += Number(/^Pss:\s+(\d+)/m.exec(rollup)?.[1] ?? 0);
    } catch { /* process exited */ }
    stack.push(...(children.get(pid) ?? []));
  }
  return total;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const samples = [];
const versions = {};

for (const engineName of ENGINES) {
  const engine = engines[engineName];
  for (const n of SIZES) {
    for (let run = 0; run < RUNS; run++) {
      const order = run % 2 ? [...VARIANTS].reverse() : VARIANTS;
      for (const variant of order) {
        const serverProc = await engine.launchServer({
          headless: true,
          args: engineName === 'chromium' ? ['--js-flags=--expose-gc'] : [],
        });
        const pid = serverProc.process().pid;
        const browser = await engine.connect(serverProc.wsEndpoint());
        versions[engineName] = browser.version();
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        let cdp;
        if (engineName === 'chromium') {
          cdp = await page.context().newCDPSession(page);
          await cdp.send('Performance.enable');
        }
        const metrics = async () => {
          if (!cdp) return null;
          const { metrics: list } = await cdp.send('Performance.getMetrics');
          return Object.fromEntries(list.map((m) => [m.name, m.value]));
        };
        const gc = async () => {
          if (engineName === 'chromium') await page.evaluate(() => { globalThis.gc?.(); globalThis.gc?.(); });
          await sleep(300);
        };
        await page.goto(`${base}/web/bench.html?variant=${variant}&${PAGE_PARAMS}`);
        await page.waitForFunction(() => window.spikeReady === true);
        await gc();
        const pssBefore = treePssKb(pid);
        const m0 = await metrics();
        const render = await page.evaluate(([count, inc]) => window.spike.render(count, inc), [n, INCREMENTAL]);
        const m1 = await metrics();
        await gc();
        const pssAfter = treePssKb(pid);
        const switches = {};
        const cdpSwitch = {};
        for (const kind of ['mode', 'accent', 'space']) {
          const s0 = await metrics();
          switches[kind] = await page.evaluate(([k, reps]) => window.spike.themeSwitch(k, reps), [kind, SWITCH_REPS]);
          const s1 = await metrics();
          if (s0 && s1) {
            cdpSwitch[kind] = {
              recalcStyleMsPerSwitch: ((s1.RecalcStyleDuration - s0.RecalcStyleDuration) * 1000) / SWITCH_REPS,
              layoutMsPerSwitch: ((s1.LayoutDuration - s0.LayoutDuration) * 1000) / SWITCH_REPS,
            };
          }
        }
        const sample = {
          engine: engineName, mix: MIX, incremental: INCREMENTAL, scopes: SCOPES, n, run, variant, render, switches,
          pssDeltaKb: pssAfter - pssBefore,
          isolated: await page.evaluate(() => window.spike.isolated),
        };
        if (m0 && m1) {
          sample.cdpRender = {
            recalcStyleMs: (m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000,
            recalcStyleCount: m1.RecalcStyleCount - m0.RecalcStyleCount,
            layoutMs: (m1.LayoutDuration - m0.LayoutDuration) * 1000,
            scriptMs: (m1.ScriptDuration - m0.ScriptDuration) * 1000,
            jsHeapDeltaKb: (m1.JSHeapUsedSize - m0.JSHeapUsedSize) / 1024,
          };
          sample.cdpSwitch = cdpSwitch;
        }
        samples.push(sample);
        process.stdout.write(`${engineName} n=${n} run=${run} ${variant}: total=${render.total.toFixed(1)}ms style+layout=${render.styleLayout.toFixed(1)}ms mode=${median(switches.mode).toFixed(2)}ms pssΔ=${sample.pssDeltaKb}kB\n`);
        await browser.close();
        await serverProc.close();
      }
    }
  }
}
server.close();

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function quantile(values, q) {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const machine = {
  cpu: os.cpus()[0]?.model, cores: os.cpus().length, memGb: Math.round(os.totalmem() / 2 ** 30),
  kernel: os.release(), node: process.version, loadavgAtEnd: os.loadavg(),
};
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const tag = `${MIX}${INCREMENTAL ? '-incremental' : ''}${SCOPES ? `-scopes${SCOPES}` : ''}${ROW_SCOPES ? '-rowscopes' : ''}${ROOTS ? '-roots' : ''}${HOST_SCOPE ? '-hostscope' : ''}${FOREIGN_ALWAYS ? '-foreignalways' : ''}`;
writeFileSync(new URL(`./out/results-${tag}-${VARIANTS.join('')}-${stamp}.json`, import.meta.url),
  JSON.stringify({ machine, provenance, pageParams: PAGE_PARAMS, versions, mix: MIX, incremental: INCREMENTAL, scopes: SCOPES, variants: VARIANTS, runs: RUNS, switchReps: SWITCH_REPS, samples }, null, 2));

// Summary: medians and interquartile range across runs. Switch figures are the median of the
// per-page medians over SWITCH_REPS toggles.
const pick = {
  'render total': (s) => s.render.total,
  'render script': (s) => s.render.script,
  'first style+layout': (s) => s.render.styleLayout,
  'mode switch': (s) => median(s.switches.mode),
  'accent switch': (s) => median(s.switches.accent),
  'space switch': (s) => median(s.switches.space),
  'PSS delta MB': (s) => s.pssDeltaKb / 1024,
  'cdp recalc (render)': (s) => s.cdpRender?.recalcStyleMs,
  'cdp recalc/mode switch': (s) => s.cdpSwitch?.mode.recalcStyleMsPerSwitch,
};
console.log(`\nmachine ${JSON.stringify(machine)}\nversions ${JSON.stringify(versions)}`);
for (const engineName of ENGINES) for (const n of SIZES) {
  console.log(`\n${engineName} N=${n}`);
  for (const [label, fn] of Object.entries(pick)) {
    const row = VARIANTS.map((v) => {
      const vals = samples.filter((s) => s.engine === engineName && s.n === n && s.variant === v).map(fn).filter((x) => x != null);
      if (!vals.length) return null;
      return { med: median(vals), q1: quantile(vals, 0.25), q3: quantile(vals, 0.75), min: Math.min(...vals), max: Math.max(...vals) };
    });
    if (!row[0]) continue;
    const f = (r) => `${r.med.toFixed(2)} [${r.q1.toFixed(2)}–${r.q3.toFixed(2)}]`;
    console.log(`  ${label.padEnd(24)} ${VARIANTS[0].toUpperCase()} ${f(row[0]).padEnd(24)} ${VARIANTS[1].toUpperCase()} ${f(row[1]).padEnd(24)} ratio ${(row[1].med / row[0].med).toFixed(2)}`);
  }
}
