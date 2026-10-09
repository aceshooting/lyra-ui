// Turn a results-*.json file into Markdown evidence tables: one column per variant (median and
// interquartile range across runs), and each later variant's change against the first.
// Decision rule (28.0.0 gate): a 95 % bootstrap confidence interval for the ratio of medians (each
// later variant against the first, 2,000 resamples, fixed seed). A cell BLOCKS only when the lower
// bound is above +3 % and the absolute median delta is above 2 ms (1 MB for memory); everything else
// is reported. Calibrate with an A/A pair (`build.mjs --derived a2`, `run.mjs --variants a,a2`): the
// rule is adopted only if it flags under 5 % of A/A cells. Medians below 0.1 ms in both variants are
// marked "floor" (WebKit has already flushed; no signal).
// Usage: node report.mjs out/results-<...>.json
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const V = data.variants ?? ['a', 'b'];
const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const fmt = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
data.samples = data.samples.filter((s) => !s.warmup);
const engines = [...new Set(data.samples.map((s) => s.engine))];
let seed = 0x2802;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
function ratioInterval(base, other) {
  const ratios = [];
  for (let i = 0; i < 2000; i++) {
    const pick = (v) => v.map(() => v[Math.floor(random() * v.length)]);
    ratios.push(median(pick(other)) / median(pick(base)));
  }
  return [q(ratios, 0.025), q(ratios, 0.975)];
}
const sizes = [...new Set(data.samples.map((s) => s.n))];

const metrics = {
  'Initial render (ms)': [
    ['Insert to first full style and layout', (s) => s.render.total],
    ['Deferred style and layout flush', (s) => s.render.styleLayout],
    ['Style recalc time (Chromium trace metric)', (s) => s.cdpRender?.recalcStyleMs],
  ],
  'Re-theme (ms)': Object.keys(data.samples[0]?.switches ?? {}).map((kind) => [{
    mode: 'Mode switch (light/dark on the root)',
    accent: 'Accent input written inline on the root',
    space: 'Spacing input written inline on the root',
    'runtime-accent': 'setLyraStyle({ accent }) custom accent',
    'named-accent': 'data-lr-accent between gemstones',
    look: 'data-lr-look between lyra and shadcn',
    density: 'data-lr-density between compact and comfortable',
    region: 'applyLyraStyleScope() accent on the row container',
  }[kind] ?? kind, (s) => (s.switches[kind] ? median(s.switches[kind]) : null)]),
  Memory: [['Process-tree PSS growth after render (MB)', (s) => s.pssDeltaKb / 1024]],
};

for (const [group, list] of Object.entries(metrics)) {
  console.log(`\n**${group}**\n`);
  console.log(`| Engine | N | Metric | ${V.map((v) => `${v.toUpperCase()} median [IQR]`).join(' | ')} | ${V.slice(1).map((v) => `${v.toUpperCase()} vs ${V[0].toUpperCase()} [95 % CI] decision`).join(' | ')} |`);
  console.log(`|---|---:|---|${V.map(() => '---:').join('|')}|${V.slice(1).map(() => '---:').join('|')}|`);
  for (const engine of engines) for (const n of sizes) for (const [label, fn] of list) {
    const cells = V.map((v) => {
      const vals = data.samples.filter((s) => s.engine === engine && s.n === n && s.variant === v).map(fn).filter((x) => x != null);
      return vals.length ? { vals, m: median(vals), lo: q(vals, 0.25), hi: q(vals, 0.75) } : null;
    });
    if (cells.some((c) => !c)) continue;
    const signed = (x) => { const p = Math.round((x - 1) * 100); return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} %`; };
    const minDelta = group === 'Memory' ? 1 : 2;
    const verdict = (c) => {
      if (c.m < 0.1 && cells[0].m < 0.1) return `${signed(c.m / (cells[0].m || 1))} floor`;
      const [lo, hi] = ratioInterval(cells[0].vals, c.vals);
      const block = lo > 1.03 && c.m - cells[0].m > minDelta;
      return `${signed(c.m / cells[0].m)} [${signed(lo)}…${signed(hi)}] ${block ? '**BLOCK**' : 'ok'}`;
    };
    console.log(`| ${engine} | ${n} | ${label} | ${cells.map((c) => `${fmt(c.m)} [${fmt(c.lo)}–${fmt(c.hi)}]`).join(' | ')} | ${cells.slice(1).map(verdict).join(' | ')} |`);
  }
}
const load = [data.provenance?.loadavgAtStart?.[0], data.machine?.loadavgAtEnd?.[0]].filter((x) => x != null).map((x) => x.toFixed(1));
console.log(`\nRuns per cell: ${data.runs}; toggles per page: ${data.switchReps}; page: ${data.pageParams ?? `mix=${data.mix}&scopes=${data.scopes}`}; ` +
  `one-minute load average ${load.length ? load.join(' → ') : 'not recorded'}; versions ${JSON.stringify(data.versions)}` +
  `${data.provenance ? `; bundles ${JSON.stringify(data.provenance.bundleSha256)}` : ''}.`);
