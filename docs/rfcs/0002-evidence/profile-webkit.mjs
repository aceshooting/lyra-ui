// Attribute a WebKit re-theme cost before fixing it: `perf record` on Playwright WebKit's web
// content process while one re-theme kind toggles, then a flat `perf report`. The design review's
// rule: any WebKit cell above +10 % gets a profile that names the hot function; a mechanism read from
// WebKit's source stays a hypothesis until a profile shows it.
// Usage: node profile-webkit.mjs --variant i --kind runtime-accent [--n 3000] [--reps 40] [--page 'rowScopes=1&...']
// Needs `perf` (linux-tools) and perf_event_paranoid <= 1 (or CAP_PERFMON); PERF="sudo -n perf"
// runs it through sudo instead. Symbols come from the
// Playwright WebKit build; frames without symbols are reported by address.
import { webkit } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { startServer } from './server.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const VARIANT = arg('variant', 'i');
const KIND = arg('kind', 'runtime-accent');
const N = Number(arg('n', '3000'));
const REPS = Number(arg('reps', '40'));
const PAGE = arg('page', 'rowScopes=1');
// PERF is a command line ("perf", "sudo -n perf"): its first word runs, the rest prefix the perf arguments.
const PERF_ARGV = (process.env.PERF ?? 'perf').trim().split(/\s+/);
const perfCommand = (args) => [PERF_ARGV[0], [...PERF_ARGV.slice(1), ...args]];

/** Descendant processes of `pid` whose command line names WebKit's web content process. */
function webProcesses(pid) {
  const children = new Map();
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      (children.get(ppid) ?? children.set(ppid, []).get(ppid)).push(Number(entry));
    } catch { /* exited */ }
  }
  const found = [];
  const stack = [pid];
  while (stack.length) {
    const current = stack.pop();
    for (const child of children.get(current) ?? []) {
      stack.push(child);
      try { if (/WebProcess/.test(readFileSync(`/proc/${child}/cmdline`, 'utf8'))) found.push(child); } catch { /* exited */ }
    }
  }
  return found;
}

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browserServer = await webkit.launchServer({ headless: true });
const browser = await webkit.connect(browserServer.wsEndpoint());
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/web/bench.html?variant=${VARIANT}&${PAGE}`);
  await page.waitForFunction(() => window.spikeReady === true);
  await page.evaluate((n) => window.spike.render(n, false), N);
  const pids = webProcesses(browserServer.process().pid);
  if (!pids.length) throw new Error('no WebKit WebProcess found');
  const stem = `perf-webkit-${VARIANT}-${KIND}-${N}`;
  const data = new URL(`./out/${stem}.data`, import.meta.url).pathname;
  const [recordBin, recordArgs] = perfCommand(['record', '-F', '1999', '-g', '-p', pids.join(','), '-o', data]);
  const perf = spawn(recordBin, recordArgs, { stdio: 'inherit' });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const times = await page.evaluate(([kind, reps]) => window.spike.themeSwitch(kind, reps), [KIND, REPS]);
  perf.kill('SIGINT');
  await new Promise((resolve) => perf.on('exit', resolve));
  const [reportBin, reportArgs] = perfCommand(['report', '-i', data, '--stdio', '--no-children', '--percent-limit', '0.5', '--sort', 'dso,symbol']);
  const report = execFileSync(reportBin, reportArgs, { encoding: 'utf8', maxBuffer: 1 << 28 });
  writeFileSync(new URL(`./out/${stem}.txt`, import.meta.url), `${KIND} x${REPS} on ${PAGE}, N=${N}; toggle ms ${JSON.stringify(times.map((t) => +t.toFixed(1)))}\n\n${report}`);
  console.log(`wrote out/${stem}.txt`);
} finally {
  await browser.close();
  await browserServer.close();
  server.close();
}
