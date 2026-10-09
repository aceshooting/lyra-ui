// Style-recalc benchmark: variant A (per-host tokens) against B, C or D (see build.mjs).
// Usage: node run.mjs [--variants a,b] [--mix all|nocard] [--render batch|incremental] [--scopes 50]
//                    [--row-scopes] [--roots] [--host-scope] [--runs 7] [--sizes 200,1000,3000]
//                    [--engines chromium,firefox,webkit]
//   --row-scopes  every row is a theme scope      --roots  every row sits in an application shadow root
//   --host-scope  (variant E) each such application host is also a scope
//   --foreign-always (variant E) adopt into every application root, not only where a scope needs it
//   --row-inputs  with --row-scopes, every row scope also sets an inline input (per-row values)
//   --no-theme    the page omits theme.css     --leak  restore the pre-28 root-resolved brand followers
//   --scope-kind theme|marker|dark   what --scopes K wraps the rows in (default theme, the 27 stand-in)
//   --kinds a,b   re-theme kinds (default: every kind bench.html knows, see themeSwitch there)
//   --warmup N    extra leading runs per cell that are recorded but flagged warmup (default 0)
//   --page app    the realistic fixed-seed application page (bench.html appMarkup; --seed N)
//   --nested      with --roots: application roots inside application roots
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
const ROW_INPUTS = process.argv.includes('--row-inputs');
const NO_THEME = process.argv.includes('--no-theme');
const LEAK = process.argv.includes('--leak');
const SCOPE_KIND = arg('scope-kind', 'theme');
const KINDS = arg('kinds', 'mode,accent,space,runtime-accent,named-accent,look,density,region').split(',');
const WARMUP = Number(arg('warmup', '0'));
const PAGE = arg('page', 'rows');
const SEED = Number(arg('seed', '2802'));
const NESTED = process.argv.includes('--nested');
const PAGE_PARAMS = `mix=${MIX}&scopes=${SCOPES}&rowScopes=${ROW_SCOPES ? 1 : 0}&roots=${ROOTS ? 1 : 0}&hostScope=${HOST_SCOPE ? 1 : 0}&foreign=${FOREIGN_ALWAYS ? 'always' : 'demand'}${ROW_INPUTS ? '&rowInputs=1' : ''}${NO_THEME ? '&theme=0' : ''}${LEAK ? '&leak=1' : ''}&scopeKind=${SCOPE_KIND}${PAGE === 'app' ? `&page=app&seed=${SEED}` : ''}${NESTED ? '&nested=1' : ''}`;
const { createHash } = await import('node:crypto');
const provenance = {
  sourceCommit: readFileSync(new URL('./SOURCE_COMMIT', import.meta.url), 'utf8').trim(),
  bundleSha256: Object.fromEntries(VARIANTS.map((v) => [v, createHash('sha256').update(readFileSync(new URL(`./out/${PAGE === 'app' ? 'app-' : ''}bundle-${v}.js`, import.meta.url))).digest('hex').slice(0, 16)])),
  // The stylesheets each page loads, hashed like the bundles (theme.css carries the layer since 28).
  cssSha256: Object.fromEntries(VARIANTS.map((v) => [v, Object.fromEntries(['theme.css', 'styles/tokens-root.css', 'accents.css', 'density.css'].map((file) => {
    try { return [file, createHash('sha256').update(readFileSync(new URL(`./dist-${v}/${file}`, import.meta.url))).digest('hex').slice(0, 16)]; } catch { return [file, null]; }
  }))])),
  // Baseline tarball integrity and candidate source identity, written by build.mjs.
  build: (() => { try { return JSON.parse(readFileSync(new URL('./out/provenance.json', import.meta.url), 'utf8')); } catch { return null; } })(),
  cpuAffinity: (() => { try { return readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1] ?? null; } catch { return null; } })(),
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
    for (let run = -WARMUP; run < RUNS; run++) {
      // Alternating (ABBA) order across runs, so drift and warm caches do not favour one variant.
      const order = Math.abs(run) % 2 ? [...VARIANTS].reverse() : VARIANTS;
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
        for (const kind of KINDS) {
          const s0 = await metrics();
          switches[kind] = await page.evaluate(([k, reps]) => window.spike.themeSwitch(k, reps), [kind, SWITCH_REPS]);
          const s1 = await metrics();
          // Reset outside the measured interval, so the CDP counters hold only the toggles.
          await page.evaluate((k) => window.spike.resetTheme(k), kind);
          if (s0 && s1) {
            cdpSwitch[kind] = {
              recalcStyleMsPerSwitch: ((s1.RecalcStyleDuration - s0.RecalcStyleDuration) * 1000) / SWITCH_REPS,
              layoutMsPerSwitch: ((s1.LayoutDuration - s0.LayoutDuration) * 1000) / SWITCH_REPS,
            };
          }
        }
        const sample = {
          engine: engineName, mix: MIX, incremental: INCREMENTAL, scopes: SCOPES, n, run, warmup: run < 0, variant, render, switches,
          loadavg: os.loadavg(),
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
const tag = `${MIX}${INCREMENTAL ? '-incremental' : ''}${SCOPES ? `-scopes${SCOPES}` : ''}${ROW_SCOPES ? '-rowscopes' : ''}${ROOTS ? '-roots' : ''}${HOST_SCOPE ? '-hostscope' : ''}${FOREIGN_ALWAYS ? '-foreignalways' : ''}${ROW_INPUTS ? '-rowinputs' : ''}${NO_THEME ? '-notheme' : ''}${LEAK ? '-leak' : ''}${SCOPES && SCOPE_KIND !== 'theme' ? `-${SCOPE_KIND}` : ''}${PAGE === 'app' ? '-app' : ''}${NESTED ? '-nested' : ''}`;
writeFileSync(new URL(`./out/results-${tag}-${VARIANTS.join('')}-${stamp}.json`, import.meta.url),
  JSON.stringify({ machine, provenance, pageParams: PAGE_PARAMS, versions, mix: MIX, incremental: INCREMENTAL, scopes: SCOPES, variants: VARIANTS, runs: RUNS, switchReps: SWITCH_REPS, samples }, null, 2));

// Summary: medians and interquartile range across runs. Switch figures are the median of the
// per-page medians over SWITCH_REPS toggles.
const pick = {
  'render total': (s) => s.render.total,
  'render script': (s) => s.render.script,
  'first style+layout': (s) => s.render.styleLayout,
  ...Object.fromEntries(KINDS.map((kind) => [`${kind} switch`, (s) => median(s.switches[kind])])),
  'PSS delta MB': (s) => s.pssDeltaKb / 1024,
  'cdp recalc (render)': (s) => s.cdpRender?.recalcStyleMs,
  'cdp recalc/mode switch': (s) => s.cdpSwitch?.mode.recalcStyleMsPerSwitch,
};
console.log(`\nmachine ${JSON.stringify(machine)}\nversions ${JSON.stringify(versions)}`);
for (const engineName of ENGINES) for (const n of SIZES) {
  console.log(`\n${engineName} N=${n}`);
  for (const [label, fn] of Object.entries(pick)) {
    const row = VARIANTS.map((v) => {
      const vals = samples.filter((s) => !s.warmup && s.engine === engineName && s.n === n && s.variant === v).map(fn).filter((x) => x != null);
      if (!vals.length) return null;
      return { med: median(vals), q1: quantile(vals, 0.25), q3: quantile(vals, 0.75), min: Math.min(...vals), max: Math.max(...vals) };
    });
    if (!row[0]) continue;
    const f = (r) => `${r.med.toFixed(2)} [${r.q1.toFixed(2)}–${r.q3.toFixed(2)}]`;
    const second = row[1] ? ` ${VARIANTS[1].toUpperCase()} ${f(row[1]).padEnd(24)} ratio ${(row[1].med / row[0].med).toFixed(2)}` : '';
    console.log(`  ${label.padEnd(24)} ${VARIANTS[0].toUpperCase()} ${f(row[0]).padEnd(24)}${second}`);
  }
}
