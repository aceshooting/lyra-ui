// Turn a results-*.json file into Markdown evidence tables: one column per variant (median and
// interquartile range across runs), and each later variant's change against the first.
// Usage: node report.mjs out/results-<...>.json
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const V = data.variants ?? ['a', 'b'];
const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const fmt = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const engines = [...new Set(data.samples.map((s) => s.engine))];
const sizes = [...new Set(data.samples.map((s) => s.n))];

const metrics = {
  'Initial render (ms)': [
    ['Insert to first full style and layout', (s) => s.render.total],
    ['Deferred style and layout flush', (s) => s.render.styleLayout],
    ['Style recalc time (Chromium trace metric)', (s) => s.cdpRender?.recalcStyleMs],
  ],
  'Root-level re-theme (ms)': [
    ['Mode switch (light/dark on the root)', (s) => median(s.switches.mode)],
    ['Accent input change on the root', (s) => median(s.switches.accent)],
    ['Spacing input change on the root', (s) => median(s.switches.space)],
  ],
  Memory: [['Process-tree PSS growth after render (MB)', (s) => s.pssDeltaKb / 1024]],
};

for (const [group, list] of Object.entries(metrics)) {
  console.log(`\n**${group}**\n`);
  console.log(`| Engine | N | Metric | ${V.map((v) => `${v.toUpperCase()} median [IQR]`).join(' | ')} | ${V.slice(1).map((v) => `${v.toUpperCase()} vs ${V[0].toUpperCase()}`).join(' | ')} |`);
  console.log(`|---|---:|---|${V.map(() => '---:').join('|')}|${V.slice(1).map(() => '---:').join('|')}|`);
  for (const engine of engines) for (const n of sizes) for (const [label, fn] of list) {
    const cells = V.map((v) => {
      const vals = data.samples.filter((s) => s.engine === engine && s.n === n && s.variant === v).map(fn).filter((x) => x != null);
      return vals.length ? { m: median(vals), lo: q(vals, 0.25), hi: q(vals, 0.75) } : null;
    });
    if (cells.some((c) => !c)) continue;
    const pct = (c) => { const p = Math.round((c.m / cells[0].m - 1) * 100); return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} %`; };
    console.log(`| ${engine} | ${n} | ${label} | ${cells.map((c) => `${fmt(c.m)} [${fmt(c.lo)}–${fmt(c.hi)}]`).join(' | ')} | ${cells.slice(1).map(pct).join(' | ')} |`);
  }
}
const load = [data.provenance?.loadavgAtStart?.[0], data.machine?.loadavgAtEnd?.[0]].filter((x) => x != null).map((x) => x.toFixed(1));
console.log(`\nRuns per cell: ${data.runs}; toggles per page: ${data.switchReps}; page: ${data.pageParams ?? `mix=${data.mix}&scopes=${data.scopes}`}; ` +
  `one-minute load average ${load.length ? load.join(' → ') : 'not recorded'}; versions ${JSON.stringify(data.versions)}` +
  `${data.provenance ? `; bundles ${JSON.stringify(data.provenance.bundleSha256)}` : ''}.`);
