// Visual-regression harness: screenshots a representative sample of Storybook stories in
// light theme, dark theme, and RTL, and diffs each capture against a committed baseline PNG.
//
// *** See packages/lyra-ui/visual-baselines/README.md for what a mismatch does and doesn't prove
// before trusting a baseline. This is a blocking CI gate (packages/lyra-ui/visual-baselines/README.md
// documents the determinism work that made that safe) -- a mismatch here fails the CI job. ***
//
// Mirrors the existing scripts/check-storybook.mjs pattern one directory up (a local static
// server for storybook-static/ + Playwright Chromium driving iframe.html directly with
// Storybook's `globals` URL param for theme/direction) rather than introducing a second test
// framework (e.g. @storybook/test-runner, which would require Jest -- this repo's stack is
// @web/test-runner for unit tests and plain Playwright scripts for Storybook-driven checks; see
// AGENTS.md's Testing conventions section).
//
// Usage (from packages/lyra-ui/, or via `pnpm --filter @aceshooting/lyra-ui test:visual`):
//   node scripts/visual-regression.mjs                     # capture + diff against baselines
//   node scripts/visual-regression.mjs --update-snapshots   # capture + overwrite baselines
//   node scripts/visual-regression.mjs --filter checkbox    # limit to matching story ids
//
// Requires `storybook-static/` to already exist (`pnpm docs:build` from the repo root) and the
// Playwright Chromium browser to be installed (`pnpm --filter @aceshooting/lyra-ui exec
// playwright install --with-deps chromium`), same preconditions as check-storybook.mjs.

import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile, rm, appendFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { comparePngs } from './visual-regression-compare.mjs';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const staticRoot = join(repoRoot, 'storybook-static');
const indexPath = join(staticRoot, 'index.json');
const baselineDir = join(packageRoot, 'visual-baselines');
const outputDir = join(packageRoot, '.visual-diff-output');

const args = process.argv.slice(2);
const UPDATE = args.includes('--update-snapshots') || args.includes('-u');
const filterArgIndex = args.indexOf('--filter');
const FILTER = filterArgIndex !== -1 ? args[filterArgIndex + 1] : undefined;

// Determinism controls. Before these existed the harness's only settling step was a
// `networkidle` + fixed 250ms wait, which let three independent noise sources move pixels
// between two runs of *identical* code -- the reason baseline refreshes kept re-blessing a
// dozen-plus PNGs on sub-1% byte churn (e.g. commit 12d00029, 24 files):
//   1. in-flight CSS animations/transitions -- handled per-screenshot by Playwright's
//      `animations: 'disabled'` (fast-forwards finite ones to their final frame, cancels
//      infinite ones) plus a context-level `reducedMotion: 'reduce'` for the JS-driven
//      animations that consult the media query instead of running pure CSS;
//   2. webfonts still swapping in -- handled by awaiting `document.fonts.ready`, which
//      `networkidle` does *not* imply (the font file can be fetched but not yet applied);
//   3. wall-clock reads -- any component rendering "2 minutes ago", a "today" highlight, or a
//      formatted current date produces a different image every run. FIXED_CLOCK pins `Date.now`
//      and `new Date()` without pausing timers (`setFixedTime`, not `pauseAt`), so streaming /
//      polling / rAF-driven components still reach their steady state normally.
// A fixed, arbitrary instant. Any component that renders a relative or absolute current date
// resolves against this, so its capture is reproducible. Deliberately not "now".
const FIXED_CLOCK = new Date('2026-01-01T12:00:00.000Z');

// Fourth determinism source, found the hard way: `--lr-font`/`--lr-font-mono` (tokens.styles.ts)
// default to the generic `system-ui`/`ui-monospace` stacks, which resolve to whatever font
// substitution the HOST happens to have -- not the same set on a dev sandbox (which tends to
// carry a full multi-script font superset) as on a fresh CI runner image. That mismatch doesn't
// just anti-alias glyph edges differently (a few tenths of a percent, harmless); word-cloud's
// spiral-search layout feeds each word's *measured* box straight into where the next word's
// collision search starts, so a sub-pixel measureText() difference cascades into a completely
// different final layout (3.6% diff, by far the worst of the family) even though its sampled
// story never calls Math.random() at all (orientations="horizontal", the class default -- see
// word-cloud-layout.ts's `rotated = orientations === 'mixed' && random() < ...`). Forcing both
// tokens to a concrete, non-generic family name removes the substitution entirely. Liberation
// Sans/Mono specifically because they're an ubiquitous small Debian/Ubuntu package
// (`fonts-liberation`) that `playwright install --with-deps chromium` (this repo's own CI step)
// already pulls in as a Chromium dependency -- no bundled font asset to license/subset/maintain.
const FONT_OVERRIDE_CSS = `:root {
  --lr-theme-font-family-body: 'Liberation Sans', sans-serif;
  --lr-theme-font-family-mono: 'Liberation Mono', monospace;
}`;

const VIEWPORT = { width: 1280, height: 800 };
// Per-story viewport overrides, matching scripts/check-storybook.mjs's own use of a narrow
// viewport for the mobile bottom-sheet story.
const VIEWPORT_OVERRIDES = {
  'responsivepanel--forced-overlay-bottom-sheet': { width: 390, height: 800 },
};

const AXES = [
  { name: 'light', theme: 'light', direction: 'ltr' },
  { name: 'dark', theme: 'dark', direction: 'ltr' },
  { name: 'rtl', theme: 'light', direction: 'rtl' },
];

// Representative sample across component families -- not the full catalog (251 story titles).
// Selection is risk-weighted, not proportional: beyond the original cross-section of families,
// it deliberately over-samples the two areas where a screenshot catches what a unit test
// structurally cannot -- canvas painters (pixels are the whole contract) and <lr-virtual-list>
// `renderItem` consumers (styles must pierce a shadow boundary to reach data rows). Extend this
// list incrementally; every id here must exist in storybook-static/index.json (verified below)
// or the run fails loudly.
const STORIES = [
  // Form controls
  'checkbox--default',
  'input--default',
  'select--default',
  'input-radio-group--default',
  'switch--default',
  'textarea--default',
  'slider--default',
  'combobox--default',
  'forms-phoneinput--default',
  'form-rating--default',
  // Overlays / dialogs
  'dialog--open-initially',
  'drawer--end',
  'overlay-dropdown--default',
  'overlay-popover--default',
  'overlay-tooltip--default',
  'toast--triggers',
  'toolapprovaldialog--open-initially',
  'menu--gear-menu',
  // Data-viz
  'charts-litechart--default',
  'charts-bar--default',
  'charts-line--default',
  'gauge--radial',
  'heatmap--default',
  'sparkline--line',
  'graph--default',
  'map--default',
  'wordcloud--default',
  // Canvas-rendered -- these paint to a <canvas> 2D context, so their pixels ARE the entire
  // contract: no DOM/part assertion in a unit test can see a wrong axis, a clipped slice, or a
  // mis-mapped color the way a screenshot can. The Charts/Chart family was almost entirely
  // uncovered (only the bar/line/litechart derivatives above had baselines) despite sharing one
  // canvas base class (chart.class.ts); these add the remaining chart geometries plus the other
  // standalone canvas painters (qr-code, audio-visualizer, animated-image).
  'charts-chart--default',
  'charts-pie--default',
  'charts-doughnut--default',
  'charts-radar--default',
  'charts-scatter--default',
  'charts-polararea--default',
  'charts-bubble--default',
  'charts-histogram--default',
  'charts-boxplot--default',
  'qr-code--default',
  'audio-visualizer--idle',
  'animatedimage--default',
  // Viewers
  'documentviewer-pdfviewer--default',
  'jsonviewer--default',
  'codeblock--default',
  'markdown--default',
  'documentviewer-csvviewer--quoted-fields',
  'docxviewer--default',
  // Virtual-list consumers -- these feed a per-row `renderItem` callback into <lr-virtual-list>,
  // so every data row renders inside THAT element's shadow root, not the component's own. A plain
  // `[part='row']` rule in the component's stylesheet cannot cross that boundary and silently
  // dies, collapsing styled rows to unstyled block stacking (the exact bug fixed in csv-viewer /
  // spreadsheet-viewer, commit 26f28acd, found via this harness). Coverage was inverted: the two
  // lowest-risk consumers (csv-viewer: 4 pierce rules, pdf-viewer: 8) had baselines while the
  // heaviest did not. These are the highest `::part`-rule-count consumers, ordered by that count.
  'chunk-inspector--default', // 19 pierce rules
  'ingestion-queue--default', // 17
  'documentviewer-pagerail--mediated', // 14
  'threadlist--default', // 14
  'documentviewer-notebookviewer--default', // 12
  'neighbor-list--default', // 12
  'retrieval-results--default', // 11
  'activityfeed--live-expanded', // 11
  'documentviewer-datasetviewer--default', // 7
  'archiveviewer--default', // 5
  // Layout primitives
  'apprail--forced-icon-only',
  'responsivepanel--forced-overlay-bottom-sheet',
  'split--default',
  'tabs--default',
  'card--outlined',
  'table--default',
  'disclosure-accordion--default',
];

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serve(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const filePath = normalize(join(staticRoot, relativePath));
  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end('Not found');
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine Storybook server port');
  return `http://127.0.0.1:${address.port}`;
}

async function captureStory(page, baseUrl, id, theme, direction) {
  const viewport = VIEWPORT_OVERRIDES[id] ?? VIEWPORT;
  await page.setViewportSize(viewport);
  const url = `${baseUrl}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};direction:${direction}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  // Applied before the story's first component upgrade so canvas painters that measure text
  // during their initial render (e.g. word-cloud's spiral-search layout) see the forced font on
  // their very first pass rather than re-measuring after a live custom-property change.
  await page.addStyleTag({ content: FONT_OVERRIDE_CSS });
  await page.waitForFunction(
    () => Boolean(document.querySelector('#storybook-root')?.firstElementChild),
    undefined,
    { timeout: 15_000 },
  );
  // Let webfonts, chart/canvas/map render passes, and async fixture fetches (pdf.js, mammoth,
  // papaparse) settle. networkidle is best-effort: components with a live/streaming poll timer
  // (e.g. generation-status, stream-status) never go idle, so this must not be fatal.
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  // Webfonts being *fetched* (what networkidle observes) is not the same as them being *applied*;
  // screenshotting between those two moments captures fallback-font metrics and shifts every
  // glyph in the image. Best-effort like networkidle above: a story that never settles its font
  // loading must not be fatal to the run.
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(250);
  // Full-viewport screenshot rather than a `#storybook-root`-clipped one: several of the sampled
  // families (dialog, drawer, overlay-dropdown, overlay-popover, overlay-tooltip,
  // toolapprovaldialog, menu) render their open surface via `root-registration-allowlist.ts`'s
  // document-level portal, which lands as a sibling of #storybook-root rather than inside it --
  // clipping to that element's bounding box would silently crop the very content the RTL/theme
  // axes exist to catch a regression in.
  // `animations: 'disabled'` fast-forwards finite CSS animations/transitions to their last frame
  // and cancels infinite ones -- preferred over injecting `* { animation: none !important }`,
  // which would strand an entrance animation at its *starting* keyframe rather than its
  // resting state. `caret: 'hide'` is Playwright's default but is stated explicitly here because
  // the sampled form controls (input, textarea, combobox, select) autofocus in some stories and a
  // blinking caret is otherwise a coin-flip pixel.
  return page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
}

// Escapes a value for safe placement inside a single markdown table cell. Order matters:
// backslashes first (so the following escapes aren't themselves un-escaped), then pipes (which
// would otherwise split the cell), then newlines (which would otherwise break out of the row --
// this table's content ends up in GITHUB_STEP_SUMMARY, which renders as markdown/HTML).
function escapeMarkdownCell(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await pathExists(indexPath))) {
    throw new Error(`${indexPath} is missing; run \`pnpm docs:build\` from the repo root first.`);
  }
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const entries = new Set(Object.keys(index.entries ?? {}));

  const targetStories = STORIES.filter((id) => !FILTER || id.includes(FILTER));
  if (FILTER && targetStories.length === 0) {
    throw new Error(`--filter ${FILTER} matched no stories in this harness's sample list.`);
  }

  const missing = targetStories.filter((id) => !entries.has(id));
  if (missing.length) {
    throw new Error(`Storybook catalog is missing story id(s) sampled by this harness: ${missing.join(', ')}`);
  }

  await rm(outputDir, { recursive: true, force: true });
  if (UPDATE) await mkdir(baselineDir, { recursive: true });

  const server = createServer(serve);
  const baseUrl = await listen(server);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1, reducedMotion: 'reduce' });
  // Pins Date.now()/new Date() for every story in the run while leaving setTimeout/setInterval/
  // rAF running at real speed, so date-rendering components are reproducible but streaming and
  // polling components still settle. Installed once -- it survives the per-story navigations.
  await page.clock.setFixedTime(FIXED_CLOCK);
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${message.text()}`);
  });

  const results = [];
  try {
    for (const id of targetStories) {
      for (const axis of AXES) {
        browserErrors.length = 0;
        const label = `${id} / ${axis.name}`;
        let screenshot;
        try {
          screenshot = await captureStory(page, baseUrl, id, axis.theme, axis.direction);
        } catch (error) {
          results.push({ id, axis: axis.name, status: 'error', message: error instanceof Error ? error.message : String(error) });
          console.error(`  [error] ${label}: ${error instanceof Error ? error.message : error}`);
          continue;
        }

        const baselinePath = join(baselineDir, id, `${axis.name}.png`);
        if (UPDATE) {
          await mkdir(join(baselineDir, id), { recursive: true });
          await writeFile(baselinePath, screenshot);
          results.push({ id, axis: axis.name, status: 'updated' });
          console.log(`  [updated] ${label}`);
          continue;
        }

        await mkdir(join(outputDir, 'current', id), { recursive: true });
        await writeFile(join(outputDir, 'current', id, `${axis.name}.png`), screenshot);

        if (!(await pathExists(baselinePath))) {
          await mkdir(join(outputDir, 'new', id), { recursive: true });
          await writeFile(join(outputDir, 'new', id, `${axis.name}.png`), screenshot);
          results.push({ id, axis: axis.name, status: 'new' });
          console.log(`  [new, no baseline yet] ${label}`);
          continue;
        }

        const baselineBuffer = await readFile(baselinePath);
        const comparison = comparePngs(baselineBuffer, screenshot);
        if (comparison.status === 'match') {
          results.push({ id, axis: axis.name, status: 'match', ratio: comparison.ratio });
          console.log(`  [match] ${label} (${(comparison.ratio * 100).toFixed(3)}% diff)`);
        } else if (comparison.status === 'mismatch') {
          if (comparison.diffPng) {
            await mkdir(join(outputDir, 'diff', id), { recursive: true });
            await writeFile(join(outputDir, 'diff', id, `${axis.name}.png`), comparison.diffPng);
          }
          results.push({ id, axis: axis.name, status: 'mismatch', ratio: comparison.ratio ?? null, reason: comparison.reason });
          console.log(`  [MISMATCH] ${label}${comparison.reason ? `: ${comparison.reason}` : ` (${(comparison.ratio * 100).toFixed(3)}% diff)`}`);
        } else {
          results.push({ id, axis: axis.name, status: 'error', message: comparison.message });
          console.error(`  [error] ${label}: ${comparison.message}`);
        }

        if (browserErrors.length) {
          results.push({ id, axis: axis.name, status: 'console-error', message: browserErrors.join('; ') });
        }
      }
    }
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (UPDATE) {
    console.log(`\nWrote/updated ${results.filter((r) => r.status === 'updated').length} baseline PNG(s) under ${baselineDir}.`);
    console.log('These are unreviewed until a human visually confirms them -- see visual-baselines/README.md.');
    return;
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'report.json'), JSON.stringify(results, null, 2));

  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const summaryLines = [
    '# Visual regression report',
    '',
    '**This is a blocking visual-regression gate.** A mismatch fails the job and should be inspected',
    'before either implementation or baseline changes are accepted. A clean run proves stability against',
    'the committed images, not that those images are inherently correct -- see',
    '`packages/lyra-ui/visual-baselines/README.md`.',
    '',
    `Sampled ${targetStories.length} stories x ${AXES.length} axes (light/dark/rtl) = ${targetStories.length * AXES.length} captures.`,
    '',
    `| status | count |`,
    `| --- | --- |`,
    ...Object.entries(counts).map(([status, count]) => `| ${status} | ${count} |`),
    '',
  ];
  const mismatches = results.filter((r) => r.status === 'mismatch' || r.status === 'error' || r.status === 'console-error');
  if (mismatches.length) {
    summaryLines.push('## Findings', '', '| story | axis | status | detail |', '| --- | --- | --- | --- |');
    for (const r of mismatches) {
      const detail = r.reason ?? r.message ?? (r.ratio != null ? `${(r.ratio * 100).toFixed(3)}% pixels changed` : '');
      summaryLines.push(`| ${escapeMarkdownCell(r.id)} | ${escapeMarkdownCell(r.axis)} | ${escapeMarkdownCell(r.status)} | ${escapeMarkdownCell(detail)} |`);
    }
    summaryLines.push('');
  }
  const newBaselines = results.filter((r) => r.status === 'new');
  if (newBaselines.length) {
    summaryLines.push(
      `## New captures with no existing baseline (${newBaselines.length})`,
      '',
      'Run with `--update-snapshots` and have a human review the images before committing them.',
      '',
    );
  }
  const summaryMarkdown = summaryLines.join('\n');
  await writeFile(join(outputDir, 'summary.md'), summaryMarkdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${summaryMarkdown}\n`);
  }

  console.log(`\n${summaryMarkdown}`);
  console.log(`Full report: ${join(outputDir, 'report.json')}`);

  const hasFailures = results.some((r) => r.status === 'mismatch' || r.status === 'error' || r.status === 'console-error' || r.status === 'new');
  if (hasFailures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
