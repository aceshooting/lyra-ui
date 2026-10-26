#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, open, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const packageDirectory = fileURLToPath(new URL('..', import.meta.url));
const root = resolve(packageDirectory, '../..');
export const PROFILES = Object.freeze({
  parser: "export * from '@aceshooting/lyra-gen/parser.js';",
  runtime: "export * from '@aceshooting/lyra-gen/runtime.js';",
  chat: "export * from '@aceshooting/lyra-gen/chat.js';",
  'gen-view': "export * from '@aceshooting/lyra-gen/gen-view.js';",
  'chat-composition': "import '@aceshooting/lyra-ui/theme.css'; export * from './examples/chat.ts';",
});
const metadataAt = async directory => JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function target(value) {
  if (typeof value === 'string') return value;
  for (const condition of ['browser', 'import', 'default']) {
    const found = value && typeof value === 'object' ? target(value[condition]) : undefined;
    if (found) return found;
  }
  return undefined;
}
export function builtExport(metadata, specifier) {
  const subpath = specifier === metadata.name ? '.' : `.${specifier.slice(metadata.name.length)}`;
  let result = target(metadata.exports[subpath]);
  if (!result) for (const [key, value] of Object.entries(metadata.exports)) {
    const star = key.indexOf('*');
    if (star < 0 || !subpath.startsWith(key.slice(0, star)) || !subpath.endsWith(key.slice(star + 1))) continue;
    const middle = subpath.slice(star, key.length - star - 1 ? -(key.length - star - 1) : undefined);
    result = target(value)?.replaceAll('*', middle);
    if (result) break;
  }
  if (!result?.startsWith('./dist/') || result.split('/').includes('..')) throw new Error('A measured import must resolve to a published dist export.');
  return result;
}

export async function buildContext() {
  const uiDirectory = join(root, 'packages/lyra-ui');
  const [gen, ui] = await Promise.all([metadataAt(packageDirectory), metadataAt(uiDirectory)]);
  const optionalPeers = Object.keys(ui.peerDependencies ?? {}).filter(name => ui.peerDependenciesMeta?.[name]?.optional).sort();
  const require = createRequire(join(uiDirectory, 'package.json'));
  const esbuild = createRequire(require.resolve('@web/dev-server-esbuild'))('esbuild');
  const packages = [[gen, packageDirectory], [ui, uiDirectory]];
  return {
    esbuild, gen, ui, optionalPeers,
    plugin: {
      name: 'published-package-exports',
      setup(build) {
        build.onResolve({ filter: /^@aceshooting\/lyra-(?:gen|ui)(?:\/|$)/ }, args => {
          const selected = packages.find(([metadata]) => args.path === metadata.name || args.path.startsWith(`${metadata.name}/`));
          if (!selected) return undefined;
          return { path: resolve(selected[1], builtExport(selected[0], args.path)) };
        });
      },
    },
  };
}

export function summarizeOutputs(result, workingDirectory) {
  const outputs = new Map(Object.entries(result.metafile.outputs).map(([file, metadata]) => [resolve(workingDirectory, file), metadata]));
  const eager = new Set();
  const edgePath = (owner, path) => outputs.has(resolve(workingDirectory, path)) ? resolve(workingDirectory, path) : resolve(dirname(owner), path);
  const visit = file => {
    if (eager.has(file)) return;
    const output = outputs.get(file);
    if (!output) throw new Error('Missing output in bundle dependency graph.');
    eager.add(file);
    if (output.cssBundle) visit(edgePath(file, output.cssBundle));
    for (const edge of output.imports) if (!edge.external && edge.kind !== 'dynamic-import') visit(edgePath(file, edge.path));
  };
  for (const [file, metadata] of outputs) if (metadata.entryPoint === '<stdin>') visit(file);
  if (!eager.size) throw new Error('Bundle has no measured entry point.');
  const totals = { eagerJsBytes: 0, eagerJsGzipBytes: 0, lazyJsBytes: 0, lazyJsGzipBytes: 0, eagerCssBytes: 0, eagerCssGzipBytes: 0, lazyCssBytes: 0, lazyCssGzipBytes: 0, assetBytes: 0 };
  const files = result.outputFiles.map(file => {
    const kind = file.path.endsWith('.js') ? 'Js' : file.path.endsWith('.css') ? 'Css' : 'asset';
    const phase = eager.has(file.path) ? 'eager' : 'lazy';
    const bytes = file.contents.byteLength;
    const gzipBytes = gzipSync(file.contents, { level: 9 }).byteLength;
    if (kind === 'asset') totals.assetBytes += bytes;
    else { totals[`${phase}${kind}Bytes`] += bytes; totals[`${phase}${kind}GzipBytes`] += gzipBytes; }
    return { file: basename(file.path), kind: kind.toLowerCase(), phase, bytes, gzipBytes, sha256: hash(file.contents) };
  }).sort((left, right) => left.file.localeCompare(right.file));
  const externalImports = [...new Set([...outputs.values()].flatMap(output => output.imports.filter(edge => edge.external).map(edge => `${edge.kind}:${edge.path}`)))].sort();
  return { totals, files, externalImports };
}

function ceilingFor(metric, bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid measured byte count.');
  const percent = metric.includes('Css') ? 4 : metric.includes('Js') ? 2 : 0;
  return Math.floor(bytes * (100 + percent) / 100);
}

function stableVersionParts(version) {
  if (typeof version !== 'string' || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version)) {
    throw new Error('Bundle budget package versions must be stable release versions.');
  }
  const parts = version.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) throw new Error('Bundle budget package version is out of range.');
  return parts;
}

export function deriveBudgets(report) {
  stableVersionParts(report.packageVersion);
  stableVersionParts(report.uiVersion);
  return {
    schemaVersion: 1, packageVersion: report.packageVersion, uiVersion: report.uiVersion, nodeVersion: report.nodeVersion, esbuildVersion: report.esbuildVersion,
    policy: { javascriptHeadroomPercent: 2, cssHeadroomPercent: 4, assetHeadroomPercent: 0, basis: 'Initial companion ceilings use measured production bytes with floor(1.02 × JS) and floor(1.04 × CSS), following repository review limits; assets have no allowance. Gzip is summed per independently transferred file.' },
    profiles: Object.fromEntries(report.profiles.map(profile => [profile.name, {
      measured: profile.totals,
      ceilings: Object.fromEntries(Object.entries(profile.totals).map(([key, value]) => [key, ceilingFor(key, value)])),
      externalImports: profile.externalImports,
    }])),
  };
}

export function checkBudgets(report, budgets) {
  for (const versions of [report, budgets]) {
    stableVersionParts(versions.packageVersion);
    stableVersionParts(versions.uiVersion);
  }
  if (budgets.schemaVersion !== 1 || budgets.packageVersion !== report.packageVersion || budgets.uiVersion !== report.uiVersion || budgets.nodeVersion !== report.nodeVersion || budgets.esbuildVersion !== report.esbuildVersion) throw new Error('Bundle budget toolchain or package version differs; remeasure and review.');
  if (JSON.stringify(Object.keys(budgets.profiles).sort()) !== JSON.stringify(report.profiles.map(profile => profile.name).sort())) throw new Error('Bundle budget profile set differs.');
  for (const profile of report.profiles) {
    const budget = budgets.profiles[profile.name];
    if (JSON.stringify(profile.externalImports) !== JSON.stringify(budget.externalImports)) throw new Error(`External dependency inventory changed: ${profile.name}`);
    const metrics = Object.keys(profile.totals).sort();
    if (JSON.stringify(metrics) !== JSON.stringify(Object.keys(budget.measured).sort())
      || JSON.stringify(metrics) !== JSON.stringify(Object.keys(budget.ceilings).sort())) throw new Error(`Bundle metric inventory changed: ${profile.name}`);
    for (const [metric, measured] of Object.entries(profile.totals)) {
      if (!Number.isSafeInteger(measured) || measured < 0 || !Number.isSafeInteger(budget.ceilings[metric]) || budget.ceilings[metric] < budget.measured[metric] || budget.ceilings[metric] > ceilingFor(metric, budget.measured[metric]) || measured > budget.ceilings[metric]) throw new Error(`Bundle budget exceeded: ${profile.name}/${metric}`);
    }
  }
}

/** Advance release stamps only after checking the original measurements and ceilings. */
export function refreshBudgetVersions(report, budgets) {
  for (const key of ['packageVersion', 'uiVersion']) {
    const previous = stableVersionParts(budgets[key]);
    const next = stableVersionParts(report[key]);
    const difference = next.findIndex((part, index) => part !== previous[index]);
    if (difference >= 0 && next[difference] < previous[difference]) throw new Error('Bundle budget package versions cannot regress.');
  }
  const proposed = { ...budgets, packageVersion: report.packageVersion, uiVersion: report.uiVersion };
  checkBudgets(report, proposed);
  return proposed;
}

/** Refresh one existing file after validating its current baseline; never create a baseline. */
export async function refreshBudgetFile(report, budgetsFile) {
  const handle = await open(budgetsFile, 'r+');
  try {
    const refreshed = refreshBudgetVersions(report, JSON.parse(await handle.readFile('utf8')));
    const contents = Buffer.from(`${JSON.stringify(refreshed, null, 2)}\n`, 'utf8');
    let written = 0;
    while (written < contents.byteLength) {
      const result = await handle.write(contents, written, contents.byteLength - written, written);
      if (!result.bytesWritten) throw new Error('Could not write refreshed bundle budget versions.');
      written += result.bytesWritten;
    }
    await handle.truncate(contents.byteLength);
    return refreshed;
  } finally { await handle.close(); }
}

export async function measureBundles() {
  const pinned = (await readFile(join(root, '.nvmrc'), 'utf8')).trim();
  if (process.versions.node !== pinned) throw new Error('Use the pinned .nvmrc Node version for bundle measurements.');
  const context = await buildContext();
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-gen-bundles-'));
  try {
    const profiles = [];
    for (const [name, contents] of Object.entries(PROFILES)) {
      const result = await context.esbuild.build({
        absWorkingDir: packageDirectory,
        stdin: { contents, resolveDir: packageDirectory, sourcefile: '<stdin>' },
        bundle: true, format: 'esm', platform: 'browser', target: 'es2022', splitting: true,
        minify: true, sourcemap: false, write: false, metafile: true, outdir: join(scratch, name),
        entryNames: 'entry', chunkNames: 'chunk-[hash]', assetNames: 'asset-[hash]',
        conditions: ['browser', 'production'], define: { 'process.env.NODE_ENV': '"production"' },
        external: context.optionalPeers.flatMap(peer => [peer, `${peer}/*`]), plugins: [context.plugin], logLevel: 'silent',
      });
      const measured = summarizeOutputs(result, packageDirectory);
      const eagerExternal = measured.externalImports.filter(edge => !edge.startsWith('dynamic-import:'));
      if (eagerExternal.length) throw new Error(`Unbundled eager dependency in ${name}.`);
      profiles.push({ name, ...measured });
    }
    return {
      schemaVersion: 1, packageVersion: context.gen.version, uiVersion: context.ui.version,
      nodeVersion: process.versions.node, esbuildVersion: context.esbuild.version,
      optionalPeersExcludedFromBytes: context.optionalPeers,
      measurement: 'Minified production browser ESM; built library exports; CSS-in-JS remains in JS; optional peer bytes are excluded and every external import is listed.',
      profiles,
    };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--refresh-versions') && args.includes('--write-budgets')) {
    console.error('Bundle measurement cannot combine --refresh-versions with --write-budgets.');
    process.exitCode = 1;
    return;
  }
  if (args.some(arg => !arg.startsWith('--output=') && !arg.startsWith('--budgets=') && arg !== '--write-budgets' && arg !== '--refresh-versions')) throw new Error('Unknown bundle measurement argument.');
  const budgetsFile = resolve(args.find(arg => arg.startsWith('--budgets='))?.slice(10) ?? join(packageDirectory, 'scripts/bundle-budgets.json'));
  const output = args.find(arg => arg.startsWith('--output='))?.slice(9);
  const report = await measureBundles();
  let refreshed;
  if (!args.includes('--write-budgets')) {
    const budgets = JSON.parse(await readFile(budgetsFile, 'utf8'));
    if (args.includes('--refresh-versions')) refreshed = refreshBudgetVersions(report, budgets);
    else checkBudgets(report, budgets);
  }
  if (output) await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  if (args.includes('--write-budgets')) await writeFile(budgetsFile, `${JSON.stringify(deriveBudgets(report), null, 2)}\n`, { flag: 'wx' });
  else if (refreshed) await refreshBudgetFile(report, budgetsFile);
  console.log(JSON.stringify(report, null, 2));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main().catch(() => { console.error('Bundle measurement failed; verify built packages, pinned toolchain and reviewed budgets.'); process.exitCode = 1; });
}
