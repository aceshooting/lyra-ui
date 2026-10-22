#!/usr/bin/env node
// Bundle composition report: bundles representative built entries the way `check:bundle-size` does
// (esbuild, ESM, minified, optional peers external, relative dynamic imports inlined) and attributes
// every output byte to the module that produced it. It enforces no size (`check:bundle-size` owns the
// budgets); the "Quality tools" job fails only when the report cannot be built. It answers the
// question a size budget cannot: what is inside the number, and what do the entries share?
//
//   pnpm --filter @aceshooting/lyra-ui build
//   node scripts/bundle-composition-report.mjs [--entry dist/lyra.js ...] [--output-dir <dir>] [--summary <file>]
//
// Writes `bundle-composition.json`, `summary.md` and one esbuild metafile per entry (loadable at
// https://esbuild.github.io/analyze/) into the output directory.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { isMainModule } from './is-main-module.mjs';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Entries that cover the root barrel, both registration entries and the components that dominate size. */
const DEFAULT_ENTRIES = [
  'dist/lyra.js',
  'dist/all.js',
  'dist/autoloader.js',
  'dist/components/lr-button.js',
  'dist/components/lr-select.js',
  'dist/components/lr-combobox.js',
  'dist/components/lr-virtual-list.js',
  'dist/components/lr-data-grid.js',
  'dist/components/lr-chart.js',
  'dist/components/lr-markdown.js',
  'dist/components/lr-map.js',
  'dist/components/lr-filter-bar.js',
  'dist/components/lr-agent-workspace.js',
];
const TOP_MODULES = 12;
const SHARED_FLOOR_SHARE = 0.9;

const KIB = 1024;
export const kibibytes = (bytes) => Math.round((bytes / KIB) * 10) / 10;

/** Normalizes an esbuild input path and names the group it belongs to (`npm:<package>`, `internal`, `components/<family>`, ...). */
export function describeModule(inputPath) {
  const path = inputPath.replaceAll('\\', '/');
  const marker = path.lastIndexOf('node_modules/');
  if (marker >= 0) {
    const relative = path.slice(marker + 'node_modules/'.length);
    const parts = relative.split('/');
    const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    // Drop the package manager's virtual-store prefix so the same file reads alike on every machine.
    return { path: `node_modules/${relative}`, group: `npm:${name}` };
  }
  const parts = path.replace(/^dist\//u, '').split('/');
  if (parts[0] === 'components' && parts.length > 2) return { path, group: `components/${parts[1]}` };
  return { path, group: parts.length > 1 ? parts[0] : 'root' };
}

/** Per-entry attribution from one esbuild metafile (a single output file: splitting is off). */
export function analyzeMetafile(metafile, { entry, minifiedBytes, gzipBytes }) {
  const output = Object.values(metafile.outputs)[0];
  const modules = Object.entries(output?.inputs ?? {})
    .map(([path, { bytesInOutput }]) => ({ ...describeModule(path), bytes: bytesInOutput }))
    .filter((module) => module.bytes > 0)
    .sort((left, right) => right.bytes - left.bytes || (left.path < right.path ? -1 : 1));
  const groups = new Map();
  for (const module of modules) groups.set(module.group, (groups.get(module.group) ?? 0) + module.bytes);
  return {
    entry,
    minifiedBytes,
    gzipBytes,
    inputs: Object.keys(metafile.inputs ?? {}).length,
    modules,
    groups: [...groups].map(([group, bytes]) => ({ group, bytes })).sort((left, right) => right.bytes - left.bytes),
  };
}

/** Modules present in at least `share` of the entries: the cost every component pays before its own code. */
export function sharedFloor(analyses, share = SHARED_FLOOR_SHARE) {
  const presence = new Map();
  for (const analysis of analyses) {
    for (const module of analysis.modules) {
      const known = presence.get(module.path) ?? { path: module.path, entries: 0, bytes: 0 };
      known.entries += 1;
      known.bytes = Math.max(known.bytes, module.bytes);
      presence.set(module.path, known);
    }
  }
  const required = Math.ceil(analyses.length * share);
  return [...presence.values()]
    .filter((module) => module.entries >= required)
    .sort((left, right) => right.bytes - left.bytes || (left.path < right.path ? -1 : 1));
}

const cell = (value) => String(value).replaceAll('|', '\\|');

/** The Markdown summary for the job page. */
export function renderMarkdown({ analyses, floor, budgets }) {
  const components = analyses.filter((analysis) => analysis.entry.startsWith('dist/components/lr-'));
  const out = ['## Bundle composition', '', 'Self-contained bundles of the built entries (esbuild, minified, optional peers external, lazy imports inlined). Sizes are KiB; gzip is level 9, as in `check:bundle-size`.', ''];
  out.push('| Entry | Minified | Gzip | Budget (gzip) | Modules | Largest module |', '|---|---|---|---|---|---|');
  for (const analysis of analyses) {
    const budget = budgets[analysis.entry];
    const largest = analysis.modules[0];
    out.push(`| \`${analysis.entry}\` | ${kibibytes(analysis.minifiedBytes)} | ${kibibytes(analysis.gzipBytes)} | ${budget === undefined ? '-' : budget} | ${analysis.modules.length} | ${largest ? `${cell(basename(largest.path))} (${kibibytes(largest.bytes)})` : '-'} |`);
  }
  if (floor.length > 0) {
    out.push('', `### Shared by at least ${Math.round(SHARED_FLOOR_SHARE * 100)}% of the ${components.length} component entries`, '', 'Every entry pays for these before its own code; shrinking one helps all of them.', '', '| Module | Minified KiB | Entries |', '|---|---|---|');
    for (const module of floor.slice(0, TOP_MODULES)) out.push(`| \`${cell(module.path)}\` | ${kibibytes(module.bytes)} | ${module.entries} |`);
    out.push('', `${floor.length} shared modules, ${kibibytes(floor.reduce((sum, module) => sum + module.bytes, 0))} KiB minified in total.`);
  }
  for (const analysis of analyses) {
    out.push('', `<details><summary><code>${analysis.entry}</code>: ${kibibytes(analysis.minifiedBytes)} KiB minified, ${kibibytes(analysis.gzipBytes)} KiB gzip</summary>`, '', '| Group | Minified KiB | Share |', '|---|---|---|');
    for (const group of analysis.groups.slice(0, 8)) out.push(`| ${cell(group.group)} | ${kibibytes(group.bytes)} | ${Math.round((group.bytes / analysis.minifiedBytes) * 100)}% |`);
    out.push('', '| Largest modules | Minified KiB |', '|---|---|');
    for (const module of analysis.modules.slice(0, TOP_MODULES)) out.push(`| \`${cell(module.path)}\` | ${kibibytes(module.bytes)} |`);
    out.push('', '</details>');
  }
  if (components.length === 0) out.push('', '_No component entries were analysed._');
  return `${out.join('\n')}\n`;
}

function parseArguments(argv) {
  const options = { entries: [], outputDir: resolve(packageDirectory, '.quality-tools', 'bundle-composition'), summary: process.env.GITHUB_STEP_SUMMARY };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${flag} needs a value.`);
      index += 1;
      return next;
    };
    if (flag === '--entry') options.entries.push(value());
    else if (flag === '--output-dir') options.outputDir = resolve(value());
    else if (flag === '--summary') options.summary = resolve(value());
    else throw new Error(`Unknown option ${flag}.`);
  }
  if (options.entries.length === 0) options.entries = DEFAULT_ENTRIES;
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  // esbuild is not a direct dependency of this package; it reaches the workspace through the test
  // runner's esbuild plugin (the same resolution check-bundle-size.mjs uses).
  const requireFromPackage = createRequire(join(packageDirectory, 'package.json'));
  const esbuild = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'))('esbuild');
  const pkg = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  const external = Object.keys(pkg.peerDependencies ?? {})
    .filter((name) => pkg.peerDependenciesMeta?.[name]?.optional === true)
    .flatMap((name) => [name, `${name}/*`]);
  const budgets = JSON.parse(readFileSync(join(packageDirectory, 'scripts', 'bundle-budgets.json'), 'utf8'));

  mkdirSync(join(options.outputDir, 'metafiles'), { recursive: true });
  const analyses = [];
  for (const entry of options.entries) {
    if (!existsSync(join(packageDirectory, entry))) throw new Error(`${entry} not found: run \`pnpm build\` first.`);
    const result = await esbuild.build({
      entryPoints: [join(packageDirectory, entry)],
      bundle: true, format: 'esm', minify: true, write: false, metafile: true,
      external, absWorkingDir: packageDirectory, logLevel: 'silent',
    });
    const contents = result.outputFiles[0].contents;
    writeFileSync(join(options.outputDir, 'metafiles', `${entry.replace(/^dist\//u, '').replaceAll('/', '__')}.json`), JSON.stringify(result.metafile));
    analyses.push(analyzeMetafile(result.metafile, { entry, minifiedBytes: contents.length, gzipBytes: gzipSync(contents, { level: 9 }).length }));
    console.log(`${entry}: ${kibibytes(contents.length)} KiB minified, ${kibibytes(analyses.at(-1).gzipBytes)} KiB gzip`);
  }
  const floor = sharedFloor(analyses.filter((analysis) => analysis.entry.startsWith('dist/components/lr-')));
  const markdown = renderMarkdown({ analyses, floor, budgets });
  writeFileSync(join(options.outputDir, 'summary.md'), markdown);
  writeFileSync(
    join(options.outputDir, 'bundle-composition.json'),
    `${JSON.stringify({ version: pkg.version, source: process.env.GITHUB_SHA ?? 'local', entries: analyses.map(({ modules, ...rest }) => ({ ...rest, modules: modules.slice(0, 50) })), sharedFloor: floor }, null, 2)}\n`,
  );
  if (options.summary) appendFileSync(options.summary, markdown);
}

if (isMainModule(import.meta.url)) await main();
